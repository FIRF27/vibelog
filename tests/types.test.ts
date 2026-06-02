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

  it("rejects an unknown category", () => {
    expect(() =>
      SummarizeResultSchema.parse({
        sections: [{ category: "Bogus", entries: [] }],
      }),
    ).toThrow();
  });

  it("ships sane defaults", () => {
    expect(DEFAULT_CONFIG.model).toBe("gpt-4.1-mini");
    expect(DEFAULT_CONFIG.batchSize).toBe(100);
  });
});
