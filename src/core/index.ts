import { collectChangeSet } from "./collect.js";
import { summarize } from "./summarize.js";
import { renderChangelog } from "./render.js";
import type { Config, GitRunner, Llm, PrFetcher } from "./types.js";

export * from "./types.js";
export { renderChangelog } from "./render.js";
export { collectChangeSet } from "./collect.js";
export { summarize } from "./summarize.js";

export async function generateChangelog(opts: {
  config: Config;
  version: string;
  date?: string;
  from?: string;
  to?: string;
  deps: { runGit: GitRunner; llm: Llm; fetchPRs?: PrFetcher };
}): Promise<string | null> {
  const changeSet = await collectChangeSet({
    runGit: opts.deps.runGit,
    fetchPRs: opts.deps.fetchPRs,
    ignorePatterns: opts.config.ignorePatterns,
    from: opts.from,
    to: opts.to,
  });

  if (changeSet.entries.length === 0) return null;

  const result = await summarize(changeSet, opts.config, opts.deps.llm);
  // The model may classify everything as noise (or return nothing). Treat "no user-facing
  // entries" as no release rather than writing a meaningless heading-only version block.
  if (result.sections.every((s) => s.entries.length === 0)) return null;
  return renderChangelog(result, {
    version: opts.version,
    date: opts.date,
    repoUrl: opts.config.repoUrl,
  });
}
