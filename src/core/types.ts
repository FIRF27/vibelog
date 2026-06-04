import { z } from "zod";

export const CATEGORIES = [
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const RefSchema = z.object({
  type: z.enum(["pr", "commit"]),
  // Models routinely emit the PR number as a JSON number; coerce 42 -> "42" losslessly.
  id: z.coerce.string(),
});
export type Ref = z.infer<typeof RefSchema>;

export const EntrySchema = z.object({
  summary: z.string().min(1),
  // Tolerate malformed refs: accept a single ref object as a one-element list, and drop
  // refs with a bad type or a missing/non-scalar id — otherwise a junk id either aborts
  // the batch or renders a broken "[object Object]"/"null" link.
  refs: z
    .preprocess((v) => {
      const arr = Array.isArray(v) ? v : v && typeof v === "object" ? [v] : [];
      return arr.filter((r) => {
        if (r === null || typeof r !== "object") return false;
        const { type, id } = r as { type?: unknown; id?: unknown };
        const idOk =
          typeof id === "string"
            ? id.length > 0
            : typeof id === "bigint"
              ? true
              : typeof id === "number"
                ? Number.isFinite(id) // reject 1e999 -> Infinity (would render an "Infinity" link)
                : false;
        return (type === "pr" || type === "commit") && idOk;
      });
    }, z.array(RefSchema))
    .default([]),
});
export type Entry = z.infer<typeof EntrySchema>;

export const SectionSchema = z.object({
  category: z.enum(CATEGORIES),
  // Drop blank/whitespace-only bullets before strict validation, so one empty summary
  // from the model can't reject the whole batch.
  entries: z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v.filter(
            (e) =>
              e !== null &&
              typeof e === "object" &&
              typeof (e as { summary?: unknown }).summary === "string" &&
              (e as { summary: string }).summary.trim().length > 0,
          )
        : // a missing/non-array entries key degrades to an empty (render-skipped) section
          [],
    z.array(EntrySchema),
  ),
});
export type Section = z.infer<typeof SectionSchema>;

export const SummarizeResultSchema = z.object({
  // Coerce common truthy/falsy forms the model may emit ("true"/"True"/1/"1"/"yes" etc.)
  // so a stray scalar for this single field doesn't reject an otherwise-valid batch;
  // genuinely unknown values still throw so the retry can self-correct. Default when absent.
  breaking: z
    .preprocess((v) => {
      const s = typeof v === "string" ? v.trim().toLowerCase() : v;
      if (s === true || s === "true" || s === 1 || s === "1" || s === "yes") return true;
      if (s === false || s === "false" || s === 0 || s === "0" || s === "no") return false;
      return v;
    }, z.boolean())
    .default(false),
  // Tolerate out-of-set categories the model sometimes invents (e.g. "Performance"):
  // drop those sections instead of failing the whole batch/run. The trailing
  // .default([]) makes a null-content "{}" response degrade to a no-op rather than
  // aborting the run (model refusals, length cutoffs, and some compatible endpoints
  // legitimately return empty content).
  sections: z
    .preprocess(
      (v) =>
        Array.isArray(v)
          ? v.filter(
              (s) =>
                s !== null &&
                typeof s === "object" &&
                (CATEGORIES as readonly string[]).includes(
                  (s as { category?: unknown }).category as string,
                ),
            )
          : v,
      z.array(SectionSchema),
    )
    .default([]),
});
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
  batchSize: number;
  maxBodyChars: number;
  maxBatchChars: number;
}

export const DEFAULT_CONFIG: Config = {
  model: "gpt-4.1-mini",
  ignorePatterns: ["^Merge ", "^chore", "^ci", "^build", "^style", "^docs"],
  batchSize: 100,
  maxBodyChars: 2000,
  maxBatchChars: 60000,
};

// Runtime validation for user-supplied config files. strictObject rejects unknown keys
// so typos surface clearly; positive ints guard against hangs (batchSize) and nonsense.
export const PartialConfigSchema = z.strictObject({
  model: z.string().min(1).optional(),
  baseUrl: z.string().optional(),
  repoUrl: z.string().optional(),
  ignorePatterns: z.array(z.string()).optional(),
  batchSize: z.number().int().positive().optional(),
  maxBodyChars: z.number().int().positive().optional(),
  maxBatchChars: z.number().int().positive().optional(),
});

export type ChatMessage = { role: "system" | "user"; content: string };
export type GitRunner = (args: string[]) => string;
export type Llm = (messages: ChatMessage[]) => Promise<string>;
export type PrFetcher = (numbers: number[]) => Promise<Map<number, PullRequest>>;
