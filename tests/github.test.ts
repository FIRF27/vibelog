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

  it("skips a 404 (issue ref / missing PR) quietly, no warning", async () => {
    const octokit = {
      rest: {
        pulls: {
          get: async () => {
            const e = new Error("Not Found") as Error & { status: number };
            e.status = 404;
            throw e;
          },
        },
      },
    };
    const warns: string[] = [];
    const map = await fetchPullRequests([99], {
      octokit: octokit as never,
      owner: "o",
      repo: "r",
      onWarn: (m) => warns.push(m),
    });
    expect(map.size).toBe(0);
    expect(warns).toEqual([]);
  });

  it("warns once on systemic failures (e.g. 403 rate limit)", async () => {
    const octokit = {
      rest: {
        pulls: {
          get: async () => {
            const e = new Error("rate limited") as Error & { status: number };
            e.status = 403;
            throw e;
          },
        },
      },
    };
    const warns: string[] = [];
    const map = await fetchPullRequests([1, 2], {
      octokit: octokit as never,
      owner: "o",
      repo: "r",
      onWarn: (m) => warns.push(m),
    });
    expect(map.size).toBe(0);
    expect(warns).toHaveLength(1);
    expect(warns[0]).toMatch(/failed to fetch 2\/2 PRs/);
  });
});
