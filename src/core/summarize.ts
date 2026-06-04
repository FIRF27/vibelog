import {
  CATEGORIES,
  SummarizeResultSchema,
  type ChangeEntry,
  type ChangeSet,
  type ChatMessage,
  type Config,
  type Llm,
  type Section,
  type SummarizeResult,
} from "./types.js";

export function mergeResults(results: SummarizeResult[]): SummarizeResult {
  const byCategory = new Map<string, Section>();
  let breaking = false;
  for (const r of results) {
    breaking ||= r.breaking;
    for (const section of r.sections) {
      const existing = byCategory.get(section.category);
      if (existing) existing.entries.push(...section.entries);
      else byCategory.set(section.category, { category: section.category, entries: [...section.entries] });
    }
  }
  return {
    breaking,
    sections: CATEGORIES.map((c) => byCategory.get(c)).filter((s): s is Section => s !== undefined),
  };
}

const SYSTEM_PROMPT = `You write release notes. Given a list of code changes (commit \
subjects plus any associated pull-request title/body/labels), produce a JSON object \
describing user-facing changes.

Rules:
- Output ONLY JSON matching: {"breaking": boolean, "sections": [{"category": "Added|Changed|Deprecated|Removed|Fixed|Security", "entries": [{"summary": string, "refs": [{"type":"pr"|"commit","id": string}]}]}]}.
- Write each summary as a concise, present-tense, user-facing sentence. Ignore noise \
(merge commits, formatting, internal chores) — omit entries that do not affect users.
- Classify into the correct Keep a Changelog category. Set "breaking" true if any change \
is backward-incompatible.
- Put the PR number in refs as type "pr" when present, otherwise the commit sha as type "commit".`;

// Code-point-safe truncation (Array.from iterates by code point, so it never splits
// a surrogate pair into a lone surrogate / U+FFFD).
function truncate(s: string, max: number): string {
  return Array.from(s).slice(0, max).join("");
}

export function entryBlock(e: ChangeEntry, maxBodyChars: number): string {
  const lines = [`- commit ${e.commit.sha.slice(0, 7)}: ${e.commit.subject}`];
  if (e.commit.body) lines.push(`  body: ${truncate(e.commit.body, maxBodyChars)}`);
  if (e.pr) {
    lines.push(`  pr #${e.pr.number}: ${e.pr.title}`);
    if (e.pr.labels.length) lines.push(`  labels: ${e.pr.labels.join(", ")}`);
    if (e.pr.body) lines.push(`  pr-body: ${truncate(e.pr.body, maxBodyChars)}`);
  }
  return lines.join("\n");
}

export function buildMessages(entries: ChangeEntry[], config: Config): ChatMessage[] {
  const blocks = entries.map((e) => entryBlock(e, config.maxBodyChars));
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Changes:\n${blocks.join("\n\n")}` },
  ];
}

// Greedy size-aware batching: close a batch when it would exceed either the entry
// count (batchSize, clamped to >=1 so a bad config can never produce a non-advancing
// loop) or the approximate char budget (maxBatchChars). A single oversized entry still
// gets its own batch rather than being dropped.
export function batchEntries(entries: ChangeEntry[], config: Config): ChangeEntry[][] {
  const maxCount = Math.max(1, Math.floor(config.batchSize));
  const maxChars = Math.max(1, Math.floor(config.maxBatchChars));
  const batches: ChangeEntry[][] = [];
  let current: ChangeEntry[] = [];
  let chars = 0;
  for (const e of entries) {
    const size = entryBlock(e, config.maxBodyChars).length;
    if (current.length > 0 && (current.length >= maxCount || chars + size > maxChars)) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(e);
    chars += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function summarizeBatch(entries: ChangeEntry[], config: Config, llm: Llm): Promise<SummarizeResult> {
  const messages = buildMessages(entries, config);
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await llm(messages);
    try {
      return SummarizeResultSchema.parse(JSON.parse(raw));
    } catch (err) {
      if (attempt === 1) throw new Error(`LLM returned unparseable output: ${String(err)}`);
      // Feed the failure back so the retry can repair its output instead of
      // (at low temperature) likely reproducing the same invalid response.
      messages.push({ role: "user", content: `Your previous response was invalid: ${String(err)}. Respond with ONLY valid JSON matching the schema.` });
    }
  }
  throw new Error("unreachable");
}

export async function summarize(changeSet: ChangeSet, config: Config, llm: Llm): Promise<SummarizeResult> {
  const batches = batchEntries(changeSet.entries, config);
  const results: SummarizeResult[] = [];
  for (const batch of batches) results.push(await summarizeBatch(batch, config, llm));
  return mergeResults(results);
}
