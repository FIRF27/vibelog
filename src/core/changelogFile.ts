// Side-effect-free changelog-file helpers. Kept out of the CLI entry module so the
// GitHub Action bundle never pulls in the CLI's self-invocation guard (which would
// otherwise fire inside the single ncc bundle and double-run main()).

export const HEADER =
  "# Changelog\n\nAll notable changes to this project are documented in this file.\n\n";

export function prependChangelog(existing: string, block: string): string {
  const normalized = block.trimEnd() + "\n";
  if (!existing.includes("# Changelog")) {
    return HEADER + normalized + "\n";
  }
  // Find the first "## " heading that is NOT inside a fenced code block, so a "## "
  // line in an intro example (```...```) can't become a bogus insertion anchor.
  const lines = existing.split("\n");
  let inFence = false;
  let anchor = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && lines[i].startsWith("## ")) {
      anchor = i;
      break;
    }
  }
  if (anchor === -1) return existing.trimEnd() + "\n\n" + normalized;
  // trimEnd()/single "\n\n" joins keep repeated prepends from accumulating blank lines.
  const head = lines.slice(0, anchor).join("\n").trimEnd();
  const rest = lines.slice(anchor).join("\n");
  return head + "\n\n" + normalized + "\n" + rest;
}
