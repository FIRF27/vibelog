import { describe, it, expect } from "vitest";
import { fetchPullRequests } from "../src/core/github.js";

describe("fetchPullRequests", () => {
  it("maps PR numbers to normalized PullRequest objects", async () => {
    const calls: number[] = [];
    const octokit = {
      rest: {
        pulls: {
          get: async ({ pull_number }: { pull_number: number }) => {
            calls.push(pull_number);
            return {
              data: {
                number: pull_number,
                title: `PR ${pull_number}`,
                body: "desc",
                labels: [{ name: "bug" }, { name: "ui" }],
                user: { login: "alice" },
              },
            };
          },
        },
      },
    };
    const map = await fetchPullRequests([7, 8], { octokit: octokit as never, owner: "o", repo: "r" });
    expect(calls).toEqual([7, 8]);
    expect(map.get(7)).toEqual({ number: 7, title: "PR 7", body: "desc", labels: ["bug", "ui"], author: "alice" });
  });

  it("skips PRs that error (e.g. not found) instead of throwing", async () => {
    const octokit = {
      rest: {
        pulls: {
          get: async () => {
            throw new Error("404");
          },
        },
      },
    };
    const map = await fetchPullRequests([99], { octokit: octokit as never, owner: "o", repo: "r" });
    expect(map.size).toBe(0);
  });
});
