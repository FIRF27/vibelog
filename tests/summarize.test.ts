import { describe, it, expect } from "vitest";
import { chunk, mergeResults, buildMessages, batchEntries, summarize } from "../src/core/summarize.js";
import { DEFAULT_CONFIG } from "../src/core/types.js";
import type { ChangeSet, SummarizeResult } from "../src/core/types.js";

describe("chunk", () => {
  it("splits into fixed-size groups", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("mergeResults", () => {
  it("merges sections by category and ORs breaking", () => {
    const a: SummarizeResult = { breaking: false, sections: [{ category: "Added", entries: [{ summary: "x", refs: [] }] }] };
    const b: SummarizeResult = {
      breaking: true,
      sections: [
        { category: "Added", entries: [{ summary: "y", refs: [] }] },
        { category: "Fixed", entries: [{ summary: "z", refs: [] }] },
      ],
    };
    const merged = mergeResults([a, b]);
    expect(merged.breaking).toBe(true);
    expect(merged.sections.find((s) => s.category === "Added")?.entries).toHaveLength(2);
    expect(merged.sections.find((s) => s.category === "Fixed")?.entries).toHaveLength(1);
  });
});

const changeSet: ChangeSet = {
  from: "v1",
  to: "HEAD",
  entries: [
    {
      commit: { sha: "s1", subject: "wip", body: "", author: "a" },
      pr: { number: 12, title: "Add dark mode", body: "Adds a dark theme", labels: ["feature"], author: "a" },
    },
    { commit: { sha: "s2", subject: "fix stuff", body: "", author: "b" } },
  ],
};

describe("buildMessages", () => {
  it("includes commit subjects and PR titles, truncating long bodies", () => {
    const big = { ...changeSet, entries: [{ commit: { sha: "s", subject: "x", body: "y".repeat(5000), author: "a" } }] };
    const msgs = buildMessages(big.entries, { ...DEFAULT_CONFIG, maxBodyChars: 10 });
    const user = msgs.find((m) => m.role === "user")!.content;
    expect(user).toContain("x");
    expect(user).not.toContain("y".repeat(11)); // body truncated to 10 chars
  });

  it("surfaces the PR title in the prompt", () => {
    const msgs = buildMessages(changeSet.entries, DEFAULT_CONFIG);
    const user = msgs.find((m) => m.role === "user")!.content;
    expect(user).toContain("Add dark mode");
  });

  it("truncates on code points, never emitting a lone surrogate", () => {
    // 4 emoji, limit 3 code points: code-unit slicing (the old bug) would cut mid-pair.
    const entries = [{ commit: { sha: "s", subject: "x", body: "🌙🌙🌙🌙", author: "a" } }];
    const msgs = buildMessages(entries, { ...DEFAULT_CONFIG, maxBodyChars: 3 });
    const user = msgs.find((m) => m.role === "user")!.content;
    expect(user).toContain("🌙🌙🌙"); // exactly 3 full emoji kept
    expect(user).not.toContain("🌙🌙🌙🌙"); // truncated
    expect(user).not.toContain("�"); // no U+FFFD
    // No LONE surrogate (valid surrogate pairs are fine).
    expect(user).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
  });
});

describe("batchEntries", () => {
  const mk = (n: number, bodyLen = 0) => ({
    commit: { sha: `s${n}`, subject: "s", body: "y".repeat(bodyLen), author: "a" },
  });

  it("splits when the char budget is exceeded even under batchSize", () => {
    const entries = [mk(1, 1000), mk(2, 1000), mk(3, 1000)];
    const batches = batchEntries(entries, { ...DEFAULT_CONFIG, batchSize: 100, maxBatchChars: 1500 });
    expect(batches.length).toBe(3); // each ~1025 chars; 1500 budget fits only one
    expect(batches.flat()).toHaveLength(3); // nothing dropped
  });

  it("never hangs when batchSize is 0 (clamps to >=1)", () => {
    const entries = [mk(1), mk(2)];
    const batches = batchEntries(entries, { ...DEFAULT_CONFIG, batchSize: 0, maxBatchChars: 999999 });
    expect(batches.length).toBe(2);
    expect(batches.flat()).toHaveLength(2);
  });
});

describe("summarize", () => {
  it("calls the llm per batch, validates, and merges", async () => {
    const batches: number[] = [];
    const llm = async () => {
      batches.push(1);
      return JSON.stringify({
        sections: [{ category: "Added", entries: [{ summary: "Dark mode", refs: [{ type: "pr", id: "12" }] }] }],
      });
    };
    const result = await summarize(changeSet, { ...DEFAULT_CONFIG, batchSize: 1 }, llm);
    expect(batches).toHaveLength(2); // 2 entries, batchSize 1
    expect(result.sections.find((s) => s.category === "Added")?.entries.length).toBe(2);
  });

  it("retries once on invalid JSON then succeeds", async () => {
    let n = 0;
    const llm = async () => {
      n++;
      return n === 1 ? "not json" : JSON.stringify({ sections: [] });
    };
    const result = await summarize(changeSet, { ...DEFAULT_CONFIG, batchSize: 100 }, llm);
    expect(n).toBe(2);
    expect(result.sections).toEqual([]);
  });

  it("throws after the retry when the llm never returns parseable JSON", async () => {
    let n = 0;
    const llm = async () => {
      n++;
      return "not json";
    };
    await expect(summarize(changeSet, { ...DEFAULT_CONFIG, batchSize: 100 }, llm)).rejects.toThrow(
      /LLM returned unparseable output/,
    );
    expect(n).toBe(2);
  });

  it("does not abort the run when the model returns null content (the '{}' fallback)", async () => {
    // makeLlm substitutes "{}" when message.content is null (refusal / length cutoff /
    // some OpenAI-compatible endpoints). That must degrade to an empty result, not crash.
    const llm = async () => "{}";
    const result = await summarize(changeSet, { ...DEFAULT_CONFIG, batchSize: 100 }, llm);
    expect(result.sections).toEqual([]);
  });
});
