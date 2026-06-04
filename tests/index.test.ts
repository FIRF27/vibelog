import { describe, it, expect } from "vitest";
import { generateChangelog } from "../src/core/index.js";
import { DEFAULT_CONFIG } from "../src/core/types.js";
import type { GitRunner } from "../src/core/types.js";

const okGit: GitRunner = (args) => {
  if (args[0] === "describe") return "v1\n";
  if (args[0] === "log") return ["s1", "Add thing (#3)", "", "a"].join("\x1f") + "\x1e";
  return "";
};

describe("generateChangelog", () => {
  it("produces markdown end-to-end with a stubbed llm", async () => {
    const llm = async () =>
      JSON.stringify({
        sections: [{ category: "Added", entries: [{ summary: "A thing", refs: [{ type: "pr", id: "3" }] }] }],
      });
    const md = await generateChangelog({
      config: DEFAULT_CONFIG,
      version: "1.0.0",
      date: "2026-06-02",
      deps: { runGit: okGit, llm },
    });
    expect(md).toContain("## [1.0.0] - 2026-06-02");
    expect(md).toContain("- A thing");
  });

  it("returns null when the model classifies everything as noise (no entries)", async () => {
    const llm = async () => JSON.stringify({ sections: [{ category: "Added", entries: [] }] });
    const md = await generateChangelog({
      config: DEFAULT_CONFIG,
      version: "1.0.0",
      date: "2026-06-02",
      deps: { runGit: okGit, llm },
    });
    expect(md).toBeNull();
  });

  it("returns null when there are no changes in range", async () => {
    const emptyGit: GitRunner = (args) => (args[0] === "describe" ? "v1\n" : "");
    const md = await generateChangelog({
      config: DEFAULT_CONFIG,
      version: "1.0.0",
      date: "2026-06-02",
      deps: { runGit: emptyGit, llm: async () => "{}" },
    });
    expect(md).toBeNull();
  });
});
