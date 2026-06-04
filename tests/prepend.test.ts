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

  it("preserves an existing file that is not titled exactly '# Changelog' (no data loss)", () => {
    const existing = "# Release Notes\n\n## [1.2.0] - 2026-01-01\n\n### Added\n- prior real notes\n";
    const out = prependChangelog(existing, "## [1.3.0]\n\n### Added\n- new\n");
    expect(out).toContain("prior real notes"); // old content NOT wiped
    expect(out).toContain("# Release Notes"); // keeps its own title (no forced "# Changelog")
    expect(out.indexOf("## [1.3.0]")).toBeLessThan(out.indexOf("## [1.2.0]"));
  });

  it("preserves non-empty content with no version heading at all", () => {
    const out = prependChangelog("# 更新日志\n\nsome prose\n", "## [1.0.0]\n\n- x\n");
    expect(out).toContain("some prose");
    expect(out).toContain("## [1.0.0]");
  });

  it("prepends (not appends) even when an unclosed code fence is in the intro", () => {
    const existing = "# Changelog\n\n```\nunclosed fence ## oops\n\n## [1.0.0]\n\n- old\n";
    const out = prependChangelog(existing, "## [2.0.0]\n\n- new\n");
    expect(out.indexOf("## [2.0.0]")).toBeLessThan(out.indexOf("## [1.0.0]")); // newest on top
    expect(out).toContain("- old");
  });

  it("normalizes CRLF in both existing and block so output has no mixed endings", () => {
    const existing = "# Changelog\r\n\r\n## [1.0.0]\r\n\r\n- old\r\n";
    const out = prependChangelog(existing, "## [1.1.0]\r\n\r\n- new\r\n");
    expect(out).not.toContain("\r");
    expect(out.indexOf("## [1.1.0]")).toBeLessThan(out.indexOf("## [1.0.0]"));
  });

  it("does not desync on mixed fence markers (~~~ inside a ``` example)", () => {
    const existing = "# Changelog\n\nex:\n```\n## [9.9.9] fake\n~~~\n```\n\n## [1.0.0]\n\n- real\n";
    const out = prependChangelog(existing, "## [2.0.0]\n\n- new\n");
    // new block anchors at the REAL heading after the closed fence, not inside it
    expect(out.indexOf("## [2.0.0]")).toBeGreaterThan(out.lastIndexOf("```"));
    expect(out.indexOf("## [2.0.0]")).toBeLessThan(out.indexOf("## [1.0.0]"));
    expect(out).toContain("- real");
  });

  it("does NOT splice into a closed fence whose code is the only '## ' line", () => {
    const existing = "# Changelog\n\nUsage:\n\n```md\n## [1.2.3]\n- example\n```\n\nThanks.\n";
    const out = prependChangelog(existing, "## [2.0.0]\n\n- new\n");
    // the new block goes AFTER all existing content, not between the ``` fences
    expect(out.indexOf("## [2.0.0]")).toBeGreaterThan(out.lastIndexOf("```"));
    expect(out).toContain("## [1.2.3]"); // example preserved verbatim inside the fence
    expect(out).toContain("Thanks.");
  });
});
