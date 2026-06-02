import { type SummarizeResult } from "./types.js";
export interface RenderMeta {
    version: string;
    date?: string;
    repoUrl?: string;
    includeAuthors?: boolean;
}
export declare function renderChangelog(result: SummarizeResult, meta: RenderMeta): string;
