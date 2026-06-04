import { describe, it, expect } from "vitest";
import { renderChangelog } from "../src/core/render.js";
import type { SummarizeResult } from "../src/core/types.js";

const result: SummarizeResult = {
  breaking: true,
  sections: [
    { category: "Added", entries: [{ summary: "Dark mode", refs: [{ type: "pr", id: "12" }] }] },
    { category: "Fixed", entries: [{ summary: "Login crash", refs: [{ type: "commit", id: "abc1234def" }] }] },
  ],
};

describe("renderChangelog", () => {
  it("renders Keep a Changelog with version, date, links, breaking note", () => {
    const md = renderChangelog(result, {
      version: "1.2.0",
      date: "2026-06-02",
      repoUrl: "https://github.com/me/proj",
    });
    expect(md).toContain("## [1.2.0] - 2026-06-02");
    expect(md).toContain("> ⚠️ This release contains breaking changes.");
    expect(md).toContain("### Added");
    expect(md).toContain("- Dark mode ([#12](https://github.com/me/proj/pull/12))");
    expect(md).toContain("### Fixed");
    expect(md).toContain("[`abc1234`](https://github.com/me/proj/commit/abc1234def)");
  });

  it("uses Unreleased heading without a date and skips empty sections", () => {
    const md = renderChangelog(
      { breaking: false, sections: [{ category: "Removed", entries: [] }] },
      { version: "Unreleased" },
    );
    expect(md).toContain("## [Unreleased]");
    expect(md).not.toContain(" - ");
    expect(md).not.toContain("### Removed");
  });

  it("renders refs without repoUrl as plain text", () => {
    const md = renderChangelog(
      { breaking: false, sections: [{ category: "Added", entries: [{ summary: "X", refs: [{ type: "pr", id: "9" }] }] }] },
      { version: "1.0.0", date: "2026-06-02" },
    );
    expect(md).toContain("- X (#9)");
  });

  it("collapses summary newlines so it cannot forge a fake version/section header", () => {
    const md = renderChangelog(
      {
        breaking: false,
        sections: [
          { category: "Added", entries: [{ summary: "real\n\n## [9.9.9] - 2099-01-01\n\n### Security\n- backdoor", refs: [] }] },
        ],
      },
      { version: "1.0.0", date: "2026-06-02" },
    );
    expect(md.match(/^## \[/gm)).toHaveLength(1); // only the real version heading
    expect(md).not.toMatch(/^### Security/m); // no forged section
    expect(md).toContain("- real ## [9.9.9] - 2099-01-01 ### Security - backdoor");
  });

  it("strips a ref id that tries to break out of the markdown link", () => {
    const md = renderChangelog(
      { breaking: false, sections: [{ category: "Added", entries: [{ summary: "X", refs: [{ type: "pr", id: "1](http://evil)" }] }] }] },
      { version: "1.0.0", date: "2026-06-02", repoUrl: "https://github.com/o/r" },
    );
    expect(md).not.toContain("http://evil"); // the injected URL is neutralized
    const bullet = md.split("\n").find((l) => l.startsWith("- "))!;
    expect((bullet.match(/\]\(/g) || []).length).toBe(1); // exactly one link — no injected second link
  });

  it("strips control and bidi-override chars from the summary", () => {
    const md = renderChangelog(
      { breaking: false, sections: [{ category: "Added", entries: [{ summary: "safe‮evil", refs: [] }] }] },
      { version: "1.0.0", date: "2026-06-02" },
    );
    expect(md).not.toMatch(/[‮]/);
    expect(md).toContain("- safeevil");
  });

  it("drops an all-symbol ref id instead of emitting an empty [#]() link", () => {
    const md = renderChangelog(
      { breaking: false, sections: [{ category: "Added", entries: [{ summary: "X", refs: [{ type: "pr", id: "!!!" }] }] }] },
      { version: "1.0.0", date: "2026-06-02", repoUrl: "https://github.com/o/r" },
    );
    expect(md).not.toContain("[#]");
    expect(md).not.toContain("]()");
    expect(md).toContain("- X"); // entry still rendered, just without the bogus ref
  });
});
