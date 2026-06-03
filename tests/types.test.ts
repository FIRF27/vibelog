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

  it("ships sane defaults", () => {
    expect(DEFAULT_CONFIG.model).toBe("gpt-4.1-mini");
    expect(DEFAULT_CONFIG.batchSize).toBe(100);
  });
});
