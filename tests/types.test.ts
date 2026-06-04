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

  it("ships sane defaults", () => {
    expect(DEFAULT_CONFIG.model).toBe("gpt-4.1-mini");
    expect(DEFAULT_CONFIG.batchSize).toBe(100);
  });
});
