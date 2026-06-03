import { describe, it, expect } from "vitest";
import { prependChangelog } from "../src/core/changelogFile.js";

describe("prependChangelog", () => {
  it("creates a file with a header when none exists", () => {
    const out = prependChangelog("", "## [1.0.0] - 2026-06-02\n\n### Added\n- X\n");
    expect(out.startsWith("# Changelog")).toBe(true);
    expect(out).toContain("## [1.0.0] - 2026-06-02");
  });

  it("inserts the new block above the most recent existing version", () => {
    const existing = "# Changelog\n\nIntro line.\n\n## [0.9.0] - 2026-01-01\n\n### Fixed\n- old\n";
    const block = "## [1.0.0] - 2026-06-02\n\n### Added\n- new\n";
    const out = prependChangelog(existing, block);
    expect(out.indexOf("## [1.0.0]")).toBeLessThan(out.indexOf("## [0.9.0]"));
    expect(out).toContain("Intro line.");
  });
});
