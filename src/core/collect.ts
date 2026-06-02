import { resolveRange, listCommits, parsePrNumber } from "./git.js";
import type { ChangeEntry, ChangeSet, Commit, GitRunner, PrFetcher, PullRequest } from "./types.js";

export function filterCommits(commits: Commit[], ignorePatterns: string[]): Commit[] {
  const regexes = ignorePatterns.map((p) => new RegExp(p, "i"));
  return commits.filter((c) => !regexes.some((re) => re.test(c.subject)));
}

export async function collectChangeSet(opts: {
  runGit: GitRunner;
  fetchPRs?: PrFetcher;
  ignorePatterns: string[];
  from?: string;
  to?: string;
}): Promise<ChangeSet> {
  const { from, to } = resolveRange({ from: opts.from, to: opts.to }, opts.runGit);
  const commits = filterCommits(listCommits(from, to, opts.runGit), opts.ignorePatterns);

  let prs = new Map<number, PullRequest>();
  if (opts.fetchPRs) {
    const numbers = [
      ...new Set(
        commits.map((c) => parsePrNumber(c.subject)).filter((n): n is number => n !== undefined),
      ),
    ];
    if (numbers.length > 0) prs = await opts.fetchPRs(numbers);
  }

  const entries: ChangeEntry[] = commits.map((commit) => {
    const num = parsePrNumber(commit.subject);
    const pr = num !== undefined ? prs.get(num) : undefined;
    return pr ? { commit, pr } : { commit };
  });

  return { from, to, entries };
}
