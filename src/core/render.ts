import { CATEGORIES, type SummarizeResult, type Ref } from "./types.js";

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
      // Collapse newlines/whitespace so an LLM summary can't forge new "## "/"### "
      // headers or list items inside the changelog (and stays a single clean bullet).
      const summary = entry.summary.replace(/\s+/g, " ").trim();
      const refs = entry.refs.map((r) => renderRef(r, meta.repoUrl)).filter(Boolean).join(", ");
      lines.push(refs ? `- ${summary} (${refs})` : `- ${summary}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
