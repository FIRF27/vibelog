import type { PullRequest } from "./types.js";
export interface OctokitLike {
    rest: {
        pulls: {
            get: (args: {
                owner: string;
                repo: string;
                pull_number: number;
            }) => Promise<{
                data: {
                    number: number;
                    title: string;
                    body: string | null;
                    labels: Array<{
                        name?: string;
                    } | string>;
                    user: {
                        login: string;
                    } | null;
                };
            }>;
        };
    };
}
export declare function fetchPullRequests(numbers: number[], ctx: {
    octokit: OctokitLike;
    owner: string;
    repo: string;
}): Promise<Map<number, PullRequest>>;
