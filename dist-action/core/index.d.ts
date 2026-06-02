import type { Config, GitRunner, Llm, PrFetcher } from "./types.js";
export * from "./types.js";
export { renderChangelog } from "./render.js";
export { collectChangeSet } from "./collect.js";
export { summarize } from "./summarize.js";
export declare function generateChangelog(opts: {
    config: Config;
    version: string;
    date?: string;
    from?: string;
    to?: string;
    deps: {
        runGit: GitRunner;
        llm: Llm;
        fetchPRs?: PrFetcher;
    };
}): Promise<string | null>;
