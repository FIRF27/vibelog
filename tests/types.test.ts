import { describe, it, expect } from "vitest";
import { SummarizeResultSchema, DEFAULT_CONFIG } from "../src/core/types.js";

describe("SummarizeResultSchema", () => {
  it("accepts a valid result and defaults refs/breaking", () => {
    const parsed = SummarizeResultSchema.parse({
      sections: [{ category: "Fixed", entries: [{ summary: "fix login" }] }],
    });
    expect(parsed.breaking).toBe(false);
    expect(parsed.sections[0].entries[0].refs).toEqual([]);
  });

  it("drops unknown categories instead of failing the whole batch", () => {
    const parsed = SummarizeResultSchema.parse({
      sections: [
        { category: "Performance", entries: [{ summary: "faster" }] },
        { category: "Fixed", entries: [{ summary: "bug" }] },
      ],
    });
    expect(parsed.sections.map((s) => s.category)).toEqual(["Fixed"]);
  });

  it("degrades a null-content '{}' response to an empty no-op result", () => {
    expect(SummarizeResultSchema.parse(JSON.parse("{}"))).toEqual({ breaking: false, sections: [] });
  });

  it("coerces a numeric ref id to a string instead of failing the batch", () => {
    const parsed = SummarizeResultSchema.parse({
      sections: [{ category: "Added", entries: [{ summary: "X", refs: [{ type: "pr", id: 42 }] }] }],
    });
    expect(parsed.sections[0].entries[0].refs[0].id).toBe("42");
  });

  it("drops a blank-summary entry but keeps the good ones in the same section", () => {
    const parsed = SummarizeResultSchema.parse({
      sections: [{ category: "Added", entries: [{ summary: "real" }, { summary: "  " }, { summary: "" }] }],
    });
    expect(parsed.sections[0].entries.map((e) => e.summary)).toEqual(["real"]);
  });

  it("drops a malformed ref (missing id / bad type) instead of aborting the batch", () => {
    const parsed = SummarizeResultSchema.parse({
      sections: [
        {
          category: "Added",
          entries: [{ summary: "X", refs: [{ type: "pr" }, { type: "issue", id: "9" }, { type: "pr", id: 7 }] }],
        },
      ],
    });
    expect(parsed.sections[0].entries[0].refs).toEqual([{ type: "pr", id: "7" }]);
  });

  it("accepts a single ref object as a one-element list", () => {
    const parsed = SummarizeResultSchema.parse({
      sections: [{ category: "Added", entries: [{ summary: "X", refs: { type: "pr", id: 5 } }] }],
    });
    expect(parsed.sections[0].entries[0].refs).toEqual([{ type: "pr", id: "5" }]);
  });

  it("drops a ref whose id is a non-scalar (no more [object Object]/null links)", () => {
    const parsed = SummarizeResultSchema.parse({
      sections: [{ category: "Added", entries: [{ summary: "X", refs: [{ type: "pr", id: { n: 1 } }, { type: "commit", id: null }] }] }],
    });
    expect(parsed.sections[0].entries[0].refs).toEqual([]);
  });

  it("coerces assorted truthy/falsy breaking forms; unknown still throws for retry", () => {
    expect(SummarizeResultSchema.parse({ breaking: "true", sections: [] }).breaking).toBe(true);
    expect(SummarizeResultSchema.parse({ breaking: 1, sections: [] }).breaking).toBe(true);
    expect(SummarizeResultSchema.parse({ breaking: "True", sections: [] }).breaking).toBe(true);
    expect(SummarizeResultSchema.parse({ breaking: "yes", sections: [] }).breaking).toBe(true);
    expect(SummarizeResultSchema.parse({ breaking: 0, sections: [] }).breaking).toBe(false);
    expect(() => SummarizeResultSchema.parse({ breaking: "maybe", sections: [] })).toThrow();
  });

  it("drops a non-finite numeric ref id (1e999 -> Infinity)", () => {
    const parsed = SummarizeResultSchema.parse({
      sections: [{ category: "Added", entries: [{ summary: "X", refs: [{ type: "pr", id: 1e999 }, { type: "pr", id: 7 }] }] }],
    });
    expect(parsed.sections[0].entries[0].refs).toEqual([{ type: "pr", id: "7" }]);
  });

  it("drops a numeric ref id beyond safe-integer range (1e21 -> '1e+21')", () => {
    const parsed = SummarizeResultSchema.parse({
      sections: [{ category: "Added", entries: [{ summary: "X", refs: [{ type: "pr", id: 1e21 }, { type: "pr", id: 7 }] }] }],
    });
    expect(parsed.sections[0].entries[0].refs).toEqual([{ type: "pr", id: "7" }]);
  });

  it("degrades a section with a missing entries key to an empty section", () => {
    const parsed = SummarizeResultSchema.parse({ sections: [{ category: "Added" }] });
    expect(parsed.sections[0].entries).toEqual([]);
  });

  it("ships sane defaults", () => {
    expect(DEFAULT_CONFIG.model).toBe("gpt-4.1-mini");
    expect(DEFAULT_CONFIG.batchSize).toBe(100);
  });
});
