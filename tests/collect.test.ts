import { describe, it, expect } from "vitest";
import { filterCommits, collectChangeSet } from "../src/core/collect.js";
import type { Commit, GitRunner, PullRequest } from "../src/core/types.js";

const commits: Commit[] = [
  { sha: "s1", subject: "Add dark mode (#12)", body: "", author: "a" },
  { sha: "s2", subject: "Merge pull request #99", body: "", author: "a" },
  { sha: "s3", subject: "chore: bump deps", body: "", author: "a" },
  { sha: "s4", subject: "wip", body: "", author: "b" },
];

describe("filterCommits", () => {
  it("drops commits matching ignore patterns", () => {
    const kept = filterCommits(commits, ["^Merge ", "^chore"]);
    expect(kept.map((c) => c.sha)).toEqual(["s1", "s4"]);
  });
});

describe("collectChangeSet", () => {
  const runGit: GitRunner = (args) => {
    if (args[0] === "describe") return "v1\n";
    if (args[0] === "log") {
      // matches listCommits' -z format: %H %s %an %b joined by \x1f, NUL-terminated
      return commits
        .map((c) => [c.sha, c.subject, c.author, c.body].join("\x1f") + "\0")
        .join("");
    }
    return "";
  };

  it("attaches PR metadata when a fetcher is provided", async () => {
    const fetchPRs = async (nums: number[]): Promise<Map<number, PullRequest>> => {
      expect(nums).toEqual([12]);
      return new Map([[12, { number: 12, title: "Dark mode", body: "b", labels: [], author: "a" }]]);
    };
    const cs = await collectChangeSet({ runGit, fetchPRs, ignorePatterns: ["^Merge ", "^chore"] });
    expect(cs.from).toBe("v1");
    expect(cs.entries).toHaveLength(2);
    expect(cs.entries[0].pr?.title).toBe("Dark mode");
    expect(cs.entries[1].pr).toBeUndefined();
  });

  it("works commits-only when no fetcher is given", async () => {
    const cs = await collectChangeSet({ runGit, ignorePatterns: [] });
    expect(cs.entries).toHaveLength(4);
    expect(cs.entries.every((e) => e.pr === undefined)).toBe(true);
  });
});
