import { CATEGORIES, visibleText, type SummarizeResult, type Ref } from "./types.js";

export interface RenderMeta {
  version: string;
  date?: string;
  repoUrl?: string;
}

// Ref ids are PR numbers (digits) or commit shas (hex). Strip anything else so a
// crafted id like "1](http://evil)" can't break out of the markdown link.
function safeId(id: string): string {
  return id.replace(/[^\w.-]/g, "");
}

function renderRef(ref: Ref, repoUrl?: string): string {
  const id = safeId(ref.id);
  if (id === "") return ""; // an id that was all symbols -> drop rather than emit "[#]()"
  if (ref.type === "pr") {
    return repoUrl ? `[#${id}](${repoUrl}/pull/${id})` : `#${id}`;
  }
  const short = id.slice(0, 7);
  return repoUrl ? `[\`${short}\`](${repoUrl}/commit/${id})` : `\`${short}\``;
}

export function renderChangelog(result: SummarizeResult, meta: RenderMeta): string {
  const lines: string[] = [];
  // version comes from --version-name / the action input (often a tag/branch name): make it
  // display-safe (collapse whitespace, strip control/bidi) and drop "[]" so it can't forge a
  // heading or break out of the "[version]" wrapper. repoUrl: strip link-breaking chars.
  const version = visibleText(meta.version.replace(/[[\]]/g, "")) || "Unreleased";
  const repoUrl = meta.repoUrl?.replace(/[\s()[\]]/g, "");
  const heading =
    version === "Unreleased" || !meta.date ? `## [${version}]` : `## [${version}] - ${meta.date}`;
  lines.push(heading, "");

  if (result.breaking) {
    lines.push("> ⚠️ This release contains breaking changes.", "");
  }

  for (const category of CATEGORIES) {
    const section = result.sections.find((s) => s.category === category);
    if (!section) continue;
    const bullets: string[] = [];
    for (const entry of section.entries) {
      const summary = visibleText(entry.summary);
      if (!summary) continue; // a summary that sanitized to nothing -> no bullet
      const refs = entry.refs.map((r) => renderRef(r, repoUrl)).filter(Boolean).join(", ");
      bullets.push(refs ? `- ${summary} (${refs})` : `- ${summary}`);
    }
    if (bullets.length === 0) continue; // no visible bullets -> skip the category header
    lines.push(`### ${category}`, "", ...bullets, "");
  }

  return lines.join("\n").trimEnd() + "\n";
}
