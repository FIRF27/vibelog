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
