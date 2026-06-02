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

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

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

export function buildMessages(entries: ChangeEntry[], config: Config): ChatMessage[] {
  const trunc = (s: string) => s.slice(0, config.maxBodyChars);
  const blocks = entries.map((e) => {
    const lines = [`- commit ${e.commit.sha.slice(0, 7)}: ${e.commit.subject}`];
    if (e.commit.body) lines.push(`  body: ${trunc(e.commit.body)}`);
    if (e.pr) {
      lines.push(`  pr #${e.pr.number}: ${e.pr.title}`);
      if (e.pr.labels.length) lines.push(`  labels: ${e.pr.labels.join(", ")}`);
      if (e.pr.body) lines.push(`  pr-body: ${trunc(e.pr.body)}`);
    }
    return lines.join("\n");
  });
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Changes:\n${blocks.join("\n\n")}` },
  ];
}

async function summarizeBatch(entries: ChangeEntry[], config: Config, llm: Llm): Promise<SummarizeResult> {
  const messages = buildMessages(entries, config);
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await llm(messages);
    try {
      return SummarizeResultSchema.parse(JSON.parse(raw));
    } catch (err) {
      if (attempt === 1) throw new Error(`LLM returned unparseable output: ${String(err)}`);
    }
  }
  throw new Error("unreachable");
}

export async function summarize(changeSet: ChangeSet, config: Config, llm: Llm): Promise<SummarizeResult> {
  const batches = chunk(changeSet.entries, config.batchSize);
  const results: SummarizeResult[] = [];
  for (const batch of batches) results.push(await summarizeBatch(batch, config, llm));
  return mergeResults(results);
}
