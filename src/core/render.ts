import { CATEGORIES, type SummarizeResult, type Ref } from "./types.js";

export interface RenderMeta {
  version: string;
  date?: string;
  repoUrl?: string;
}

// C0/C1 control chars (the whitespace ones are handled by the \s collapse first) plus
// bidi/directional formatting chars that could visually reorder rendered text.
// Built via RegExp() to avoid embedding literal control characters in source.
const UNSAFE_CHARS = new RegExp(
  "[\\u0000-\\u001f\\u007f-\\u009f\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]",
  "g",
);

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
  // version comes from --version-name / the action input (often a tag/branch name): collapse
  // whitespace, strip control/bidi chars, and drop "[]" so it can't forge a heading or break
  // out of the "[version]" wrapper. repoUrl: strip chars that would break the markdown link.
  const version = meta.version.replace(/\s+/g, " ").replace(UNSAFE_CHARS, "").replace(/[[\]]/g, "").trim();
  const repoUrl = meta.repoUrl?.replace(/[\s()[\]]/g, "");
  const heading =
    version === "Unreleased" || !meta.date ? `## [${version}]` : `## [${version}] - ${meta.date}`;
  lines.push(heading, "");

  if (result.breaking) {
    lines.push("> ⚠️ This release contains breaking changes.", "");
  }

  for (const category of CATEGORIES) {
    const section = result.sections.find((s) => s.category === category);
    if (!section || section.entries.length === 0) continue;
    lines.push(`### ${category}`, "");
    for (const entry of section.entries) {
      // Collapse newlines/whitespace (so an LLM summary can't forge "## "/"### " headers
      // or list items), THEN strip remaining control + bidi chars (so e.g. U+202E can't
      // visually reorder the rendered changelog).
      const summary = entry.summary.replace(/\s+/g, " ").replace(UNSAFE_CHARS, "").trim();
      const refs = entry.refs.map((r) => renderRef(r, repoUrl)).filter(Boolean).join(", ");
      lines.push(refs ? `- ${summary} (${refs})` : `- ${summary}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}
