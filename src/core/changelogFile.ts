// Side-effect-free changelog-file helpers. Kept out of the CLI entry module so the
// GitHub Action bundle never pulls in the CLI's self-invocation guard (which would
// otherwise fire inside the single ncc bundle and double-run main()).

export const HEADER =
  "# Changelog\n\nAll notable changes to this project are documented in this file.\n\n";

export function prependChangelog(existing: string, block: string): string {
  // Normalize CRLF on BOTH inputs so output never ends up with mixed line endings.
  const normalized = block.replace(/\r\n/g, "\n").trimEnd() + "\n";
  const doc = existing.replace(/\r\n/g, "\n");
  // Only the truly-empty case gets a fresh header — NEVER overwrite a non-empty file
  // just because it lacks the literal "# Changelog" title (e.g. "# Release Notes").
  if (doc.trim() === "") {
    return HEADER + normalized + "\n";
  }

  // Find the first "## " heading not inside a fenced code block, so a "## " line in an
  // intro example (```...```) can't become a bogus insertion anchor. Track the fence by
  // its MARKER CHARACTER (a fence closes only on the same char it opened with), so a
  // "~~~" line inside a "```" fence is literal content, not a toggle.
  const lines = doc.split("\n");
  let fenceChar = "";
  let anchor = -1;
  let firstHeadingAny = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    const marker = trimmed.startsWith("```") ? "`" : trimmed.startsWith("~~~") ? "~" : "";
    if (marker) {
      if (fenceChar === "") fenceChar = marker;
      else if (fenceChar === marker) fenceChar = "";
      continue;
    }
    if (lines[i].startsWith("## ")) {
      if (firstHeadingAny === -1) firstHeadingAny = i;
      if (fenceChar === "") {
        anchor = i;
        break;
      }
    }
  }
  // Only fall back to the first heading when a fence was left UNCLOSED (malformed input):
  // then a heading "inside" the fence is probably real. With all fences closed, a heading
  // seen inside a fence is genuine code and must NOT be promoted to an anchor.
  if (anchor === -1 && fenceChar !== "") anchor = firstHeadingAny;

  if (anchor === -1) {
    // Non-empty file with no version heading: preserve it, add the new block after it.
    // (No header is forced on, so a file titled "# Release Notes" keeps its own title.)
    return doc.trimEnd() + "\n\n" + normalized;
  }
  // trimEnd()/single "\n\n" joins keep repeated prepends from accumulating blank lines.
  const head = lines.slice(0, anchor).join("\n").trimEnd();
  const rest = lines.slice(anchor).join("\n");
  return head + "\n\n" + normalized + "\n" + rest;
}
