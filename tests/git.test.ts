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
  it("parses git log records", () => {
    const log =
      ["sha1", "Add x (#1)", "body one", "Alice"].join("\x1f") +
      "\x1e" +
      ["sha2", "Fix y", "", "Bob"].join("\x1f") +
      "\x1e";
    const runGit: GitRunner = () => log;
    const commits = listCommits("v1", "HEAD", runGit);
    expect(commits).toHaveLength(2);
    expect(commits[0]).toEqual({ sha: "sha1", subject: "Add x (#1)", body: "body one", author: "Alice" });
    expect(commits[1].subject).toBe("Fix y");
  });
});
