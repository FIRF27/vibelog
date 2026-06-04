import { type ChangeEntry, type ChangeSet, type ChatMessage, type Config, type Llm, type SummarizeResult } from "./types.js";
export declare function mergeResults(results: SummarizeResult[]): SummarizeResult;
export declare function entryBlock(e: ChangeEntry, maxBodyChars: number): string;
export declare function buildMessages(entries: ChangeEntry[], config: Config): ChatMessage[];
export declare function batchEntries(entries: ChangeEntry[], config: Config): ChangeEntry[][];
export declare function summarize(changeSet: ChangeSet, config: Config, llm: Llm): Promise<SummarizeResult>;
