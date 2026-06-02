import { type ChangeEntry, type ChangeSet, type ChatMessage, type Config, type Llm, type SummarizeResult } from "./types.js";
export declare function chunk<T>(items: T[], size: number): T[][];
export declare function mergeResults(results: SummarizeResult[]): SummarizeResult;
export declare function buildMessages(entries: ChangeEntry[], config: Config): ChatMessage[];
export declare function summarize(changeSet: ChangeSet, config: Config, llm: Llm): Promise<SummarizeResult>;
