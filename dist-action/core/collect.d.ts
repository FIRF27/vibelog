import type { ChangeSet, Commit, GitRunner, PrFetcher } from "./types.js";
export declare function filterCommits(commits: Commit[], ignorePatterns: string[]): Commit[];
export declare function collectChangeSet(opts: {
    runGit: GitRunner;
    fetchPRs?: PrFetcher;
    ignorePatterns: string[];
    from?: string;
    to?: string;
}): Promise<ChangeSet>;
