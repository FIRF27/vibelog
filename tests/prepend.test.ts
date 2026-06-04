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

  it("ignores a '## ' line inside a fenced code block in the intro", () => {
    const existing = "# Changelog\n\nExample:\n```\n## not a real header\n```\n\n## [1.0.0]\n\n- old\n";
    const block = "## [2.0.0] - 2026-06-04\n\n### Added\n- new\n";
    const out = prependChangelog(existing, block);
    // new block lands after the closing fence, before the real version, not inside the fence
    expect(out.indexOf("## [2.0.0]")).toBeGreaterThan(out.indexOf("```\n## not a real header"));
    expect(out.indexOf("## [2.0.0]")).toBeLessThan(out.indexOf("## [1.0.0]"));
  });

  it("does not accumulate blank lines across repeated prepends", () => {
    let doc = "# Changelog\n\nIntro.\n\n## [1.0.0]\n\n- a\n";
    doc = prependChangelog(doc, "## [1.1.0]\n\n### Added\n- b\n");
    doc = prependChangelog(doc, "## [1.2.0]\n\n### Added\n- c\n");
    expect(doc).not.toMatch(/\n{3,}/); // never three consecutive newlines
    expect(doc.indexOf("## [1.2.0]")).toBeLessThan(doc.indexOf("## [1.1.0]"));
  });
});
