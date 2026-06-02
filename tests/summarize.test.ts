import { describe, it, expect } from "vitest";
import { chunk, mergeResults, buildMessages, summarize } from "../src/core/summarize.js";
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
});
