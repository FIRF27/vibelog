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
  const idx = existing.indexOf("\n## ");
  if (idx === -1) return existing.trimEnd() + "\n\n" + normalized;
  const head = existing.slice(0, idx + 1);
  const rest = existing.slice(idx + 1);
  return head + "\n" + normalized + "\n" + rest;
}
