import type { PullRequest } from "./types.js";

// Minimal shape we rely on; real callers pass an @octokit/rest instance.
export interface OctokitLike {
  rest: {
    pulls: {
      get: (args: { owner: string; repo: string; pull_number: number }) => Promise<{
        data: {
          number: number;
          title: string;
          body: string | null;
          labels: Array<{ name?: string } | string>;
          user: { login: string } | null;
        };
      }>;
    };
  };
}

export async function fetchPullRequests(
  numbers: number[],
  ctx: { octokit: OctokitLike; owner: string; repo: string },
): Promise<Map<number, PullRequest>> {
  const map = new Map<number, PullRequest>();
  for (const pull_number of numbers) {
    try {
      const { data } = await ctx.octokit.rest.pulls.get({
        owner: ctx.owner,
        repo: ctx.repo,
        pull_number,
      });
      map.set(pull_number, {
        number: data.number,
        title: data.title,
        body: data.body ?? "",
        labels: data.labels
          .map((l) => (typeof l === "string" ? l : l.name ?? ""))
          .filter(Boolean),
        author: data.user?.login ?? "",
      });
    } catch {
      // Missing/forbidden PR: skip, fall back to commit message alone.
    }
  }
  return map;
}
