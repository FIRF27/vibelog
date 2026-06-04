// Side-effect-free changelog-file helpers. Kept out of the CLI entry module so the
// GitHub Action bundle never pulls in the CLI's self-invocation guard (which would
// otherwise fire inside the single ncc bundle and double-run main()).

export const HEADER =
  "# Changelog\n\nAll notable changes to this project are documented in this file.\n\n";

export function prependChangelog(existing: string, block: string): string {
  const normalized = block.trimEnd() + "\n";
  // Normalize CRLF so a Windows-authored file doesn't end up with mixed line endings.
  const doc = existing.replace(/\r\n/g, "\n");
  // Only the truly-empty case gets a fresh header — NEVER overwrite a non-empty file
  // just because it lacks the literal "# Changelog" title (e.g. "# Release Notes").
  if (doc.trim() === "") {
    return HEADER + normalized + "\n";
  }

  // Find the first "## " heading not inside a fenced code block, so a "## " line in an
  // intro example (```...```) can't become a bogus insertion anchor. Track the first
  // "## " line overall as a fallback for malformed input (e.g. an unclosed fence).
  const lines = doc.split("\n");
  let inFence = false;
  let anchor = -1;
  let firstHeadingAny = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inFence = !inFence;
      continue;
    }
    if (lines[i].startsWith("## ")) {
      if (firstHeadingAny === -1) firstHeadingAny = i;
      if (!inFence) {
        anchor = i;
        break;
      }
    }
  }
  // If the fence-aware scan found nothing but headings exist (e.g. an unclosed fence
  // suppressed the scan), still prepend at the first heading rather than appending.
  if (anchor === -1) anchor = firstHeadingAny;

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
