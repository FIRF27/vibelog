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
  ctx: {
    octokit: OctokitLike;
    owner: string;
    repo: string;
    onWarn?: (msg: string) => void;
  },
): Promise<Map<number, PullRequest>> {
  const map = new Map<number, PullRequest>();
  let failed = 0;
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
    } catch (err) {
      // 404 = the number is an issue ref or a missing PR — expected, skip quietly.
      // Anything else (401/403/rate-limit/network) is a systemic failure worth surfacing.
      const status = (err as { status?: number })?.status;
      if (status !== 404) failed++;
    }
  }
  if (failed > 0) {
    ctx.onWarn?.(
      `vibelog: failed to fetch ${failed}/${numbers.length} PRs (auth or rate limit?) — notes use commit messages only.`,
    );
  }
  return map;
}
