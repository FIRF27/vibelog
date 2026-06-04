import { CATEGORIES, type SummarizeResult, type Ref } from "./types.js";

export interface RenderMeta {
  version: string;
  date?: string;
  repoUrl?: string;
}

function renderRef(ref: Ref, repoUrl?: string): string {
  if (ref.type === "pr") {
    return repoUrl ? `[#${ref.id}](${repoUrl}/pull/${ref.id})` : `#${ref.id}`;
  }
  const short = ref.id.slice(0, 7);
  return repoUrl ? `[\`${short}\`](${repoUrl}/commit/${ref.id})` : `\`${short}\``;
}

export function renderChangelog(result: SummarizeResult, meta: RenderMeta): string {
  const lines: string[] = [];
  const heading =
    meta.version === "Unreleased" || !meta.date
      ? `## [${meta.version}]`
      : `## [${meta.version}] - ${meta.date}`;
  lines.push(heading, "");

  if (result.breaking) {
    lines.push("> ⚠️ This release contains breaking changes.", "");
  }

  for (const category of CATEGORIES) {
    const section = result.sections.find((s) => s.category === category);
    if (!section || section.entries.length === 0) continue;
    lines.push(`### ${category}`, "");
    for (const entry of section.entries) {
      const refs = entry.refs.map((r) => renderRef(r, meta.repoUrl)).join(", ");
      lines.push(refs ? `- ${entry.summary} (${refs})` : `- ${entry.summary}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
