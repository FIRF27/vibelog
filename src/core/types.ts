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

// Chars with no visible content: C0/C1 controls + bidi/directional formatting. Built via
// RegExp() to avoid embedding literal control characters in source.
const NON_DISPLAY = new RegExp(
  "[\\u0000-\\u001f\\u007f-\\u009f\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]",
  "g",
);

// Single-line, display-safe form of a summary/heading: whitespace collapsed, control/bidi
// stripped, trimmed. Empty result means "no visible content". Used both to drop empty
// entries at parse time and to render safe bullets, so the two stay consistent.
export function visibleText(s: string): string {
  return s.replace(/\s+/g, " ").replace(NON_DISPLAY, "").trim();
}

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
              ? id >= 0n
              : typeof id === "number"
                ? // safe non-negative integer only: rejects Infinity/NaN and scientific
                  // forms like 1e21 that would coerce to a malformed "1e+21" link
                  Number.isSafeInteger(id) && id >= 0
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
              // drop entries whose summary has no VISIBLE content (whitespace- or
              // control/bidi-only), so they can't render as an empty "- " bullet.
              visibleText((e as { summary: string }).summary).length > 0,
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
  // Output language for summaries (e.g. "中文", "Spanish"). Unset = model default.
  language?: string;
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
  language: z.string().min(1).optional(),
});

export type ChatMessage = { role: "system" | "user"; content: string };
export type GitRunner = (args: string[]) => string;
export type Llm = (messages: ChatMessage[]) => Promise<string>;
export type PrFetcher = (numbers: number[]) => Promise<Map<number, PullRequest>>;
