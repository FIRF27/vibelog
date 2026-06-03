import { z } from "zod";
export declare const CATEGORIES: readonly ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"];
export type Category = (typeof CATEGORIES)[number];
export declare const RefSchema: z.ZodObject<{
    type: z.ZodEnum<{
        pr: "pr";
        commit: "commit";
    }>;
    id: z.ZodString;
}, z.core.$strip>;
export type Ref = z.infer<typeof RefSchema>;
export declare const EntrySchema: z.ZodObject<{
    summary: z.ZodString;
    refs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            pr: "pr";
            commit: "commit";
        }>;
        id: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type Entry = z.infer<typeof EntrySchema>;
export declare const SectionSchema: z.ZodObject<{
    category: z.ZodEnum<{
        Added: "Added";
        Changed: "Changed";
        Deprecated: "Deprecated";
        Removed: "Removed";
        Fixed: "Fixed";
        Security: "Security";
    }>;
    entries: z.ZodArray<z.ZodObject<{
        summary: z.ZodString;
        refs: z.ZodDefault<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<{
                pr: "pr";
                commit: "commit";
            }>;
            id: z.ZodString;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type Section = z.infer<typeof SectionSchema>;
export declare const SummarizeResultSchema: z.ZodObject<{
    breaking: z.ZodDefault<z.ZodBoolean>;
    sections: z.ZodPreprocess<z.ZodArray<z.ZodObject<{
        category: z.ZodEnum<{
            Added: "Added";
            Changed: "Changed";
            Deprecated: "Deprecated";
            Removed: "Removed";
            Fixed: "Fixed";
            Security: "Security";
        }>;
        entries: z.ZodArray<z.ZodObject<{
            summary: z.ZodString;
            refs: z.ZodDefault<z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    pr: "pr";
                    commit: "commit";
                }>;
                id: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type SummarizeResult = z.infer<typeof SummarizeResultSchema>;
export interface Commit {
    sha: string;
    subject: string;
    body: string;
    author: string;
}
export interface PullRequest {
    number: number;
    title: string;
    body: string;
    labels: string[];
    author: string;
}
export interface ChangeEntry {
    commit: Commit;
    pr?: PullRequest;
}
export interface ChangeSet {
    from: string;
    to: string;
    entries: ChangeEntry[];
}
export interface Config {
    model: string;
    baseUrl?: string;
    repoUrl?: string;
    ignorePatterns: string[];
    includeAuthors: boolean;
    batchSize: number;
    maxBodyChars: number;
    maxBatchChars: number;
}
export declare const DEFAULT_CONFIG: Config;
export declare const PartialConfigSchema: z.ZodObject<{
    model: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodString>;
    repoUrl: z.ZodOptional<z.ZodString>;
    ignorePatterns: z.ZodOptional<z.ZodArray<z.ZodString>>;
    includeAuthors: z.ZodOptional<z.ZodBoolean>;
    batchSize: z.ZodOptional<z.ZodNumber>;
    maxBodyChars: z.ZodOptional<z.ZodNumber>;
    maxBatchChars: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
export type ChatMessage = {
    role: "system" | "user";
    content: string;
};
export type GitRunner = (args: string[]) => string;
export type Llm = (messages: ChatMessage[]) => Promise<string>;
export type PrFetcher = (numbers: number[]) => Promise<Map<number, PullRequest>>;
