import type { Commit, GitRunner } from "./types.js";
export declare const realGitRunner: GitRunner;
export declare function parsePrNumber(subject: string): number | undefined;
export declare function resolveRange(opts: {
    from?: string;
    to?: string;
}, runGit: GitRunner): {
    from: string;
    to: string;
};
export declare function listCommits(from: string, to: string, runGit: GitRunner): Commit[];
