import { describe, it, expect } from "vitest";
import { parsePrNumber, resolveRange, listCommits } from "../src/core/git.js";
import type { GitRunner } from "../src/core/types.js";

describe("parsePrNumber", () => {
  it("prefers the trailing (#N) squash convention", () => {
    expect(parsePrNumber("Add dark mode (#123)")).toBe(123);
  });
  it("falls back to an inline #N", () => {
    expect(parsePrNumber("Fixes #45 in the parser")).toBe(45);
  });
  it("returns undefined when absent", () => {
    expect(parsePrNumber("wip stuff")).toBeUndefined();
  });
  it("returns the trailing PR for a revert with a quoted inner number", () => {
    expect(parsePrNumber('Revert "Add thing (#10)" (#20)')).toBe(20);
  });
  it("catches (#N) followed by trailing punctuation or tags", () => {
    expect(parsePrNumber("Add feature (#5).")).toBe(5);
    expect(parsePrNumber("fix(api): handle null (#88) [skip ci]")).toBe(88);
  });
  it("does not misattribute an inline issue ref when a real (#N) is present", () => {
    expect(parsePrNumber("feat: add export (#42), closes #40")).toBe(42);
  });
  it("rejects a precision-unsafe >15-digit PR number", () => {
    expect(parsePrNumber("feat: x (#99999999999999999999)")).toBeUndefined();
  });
});

describe("resolveRange", () => {
  it("uses last tag as from and HEAD as to by default", () => {
    const runGit: GitRunner = (args) => (args[0] === "describe" ? "v1.0.0\n" : "");
    expect(resolveRange({}, runGit)).toEqual({ from: "v1.0.0", to: "HEAD" });
  });
  it("honors explicit from/to", () => {
    const runGit: GitRunner = () => "v9\n";
    expect(resolveRange({ from: "a", to: "b" }, runGit)).toEqual({ from: "a", to: "b" });
  });

  it("falls back to all history (from='') when there are no tags", () => {
    const runGit: GitRunner = (args) => {
      if (args[0] === "describe") throw new Error("fatal: No names found, cannot describe anything.");
      return "";
    };
    expect(resolveRange({}, runGit)).toEqual({ from: "", to: "HEAD" });
  });

  it("still surfaces a hard git failure when an explicit from is given", () => {
    const runGit: GitRunner = (args) => {
      if (args[0] === "log") throw new Error("fatal: bad revision 'nope..HEAD'");
      return "";
    };
    expect(() => listCommits("nope", "HEAD", runGit)).toThrow(/bad revision/);
  });
});

describe("listCommits", () => {
  // Fields are %H %s %an %b joined by \x1f, records terminated by NUL (-z).
  it("parses NUL-terminated git log records", () => {
    const log =
      ["sha1", "Add x (#1)", "Alice", "body one"].join("\x1f") +
      "\0" +
      ["sha2", "Fix y", "Bob", ""].join("\x1f") +
      "\0";
    const runGit: GitRunner = () => log;
    const commits = listCommits("v1", "HEAD", runGit);
    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({ sha: "sha1", subject: "Add x (#1)", body: "body one", author: "Alice" });
    expect(commits[1].subject).toBe("Fix y");
  });

  it("lists ALL history (no 'from..' prefix) when from is empty, range after --end-of-options", () => {
    let loggedArgs: string[] = [];
    const runGit: GitRunner = (args) => {
      loggedArgs = args;
      return ["sha1", "First commit", "Alice", ""].join("\x1f") + "\0";
    };
    const commits = listCommits("", "HEAD", runGit);
    const eoo = loggedArgs.indexOf("--end-of-options");
    expect(eoo).toBeGreaterThan(-1); // sentinel present
    expect(loggedArgs[eoo + 1]).toBe("HEAD"); // range immediately after it, not "..HEAD"
    expect(commits).toHaveLength(1);
  });

  it("passes a leading-dash ref as a revision (after --end-of-options), never as a git flag", () => {
    let loggedArgs: string[] = [];
    const runGit: GitRunner = (args) => {
      loggedArgs = args;
      return "";
    };
    listCommits("", "--output=/tmp/PWNED", runGit);
    const eoo = loggedArgs.indexOf("--end-of-options");
    expect(eoo).toBeGreaterThan(-1);
    expect(loggedArgs[eoo + 1]).toBe("--output=/tmp/PWNED"); // sits after the sentinel = treated as a rev
    // nothing dangerous precedes the sentinel
    expect(loggedArgs.slice(0, eoo).some((a) => a.startsWith("--output"))).toBe(false);
  });

  it("keeps a multi-line body and one containing the field separator intact (no phantom commit)", () => {
    const body = "line one\nline two with \x1f embedded sep";
    const log = ["sha3", "Add z", "Carol", body].join("\x1f") + "\0";
    const runGit: GitRunner = () => log;
    const commits = listCommits("v1", "HEAD", runGit);
    expect(commits).toHaveLength(1);
    expect(commits[0].body).toBe(body);
    expect(commits[0].author).toBe("Carol");
  });
});
