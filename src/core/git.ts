import { execFileSync } from "node:child_process";
import type { Commit, GitRunner } from "./types.js";

const FIELD = "\x1f";

export const realGitRunner: GitRunner = (args) => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      // Capture stderr instead of inheriting it, so git's own error text
      // (e.g. "No such remote 'origin'") doesn't leak to our output on a caught failure.
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOBUFS") {
      throw new Error(
        "git output exceeded the 64MB buffer — the commit range is too large. Narrow it with --from/--to.",
      );
    }
    throw err;
  }
};

export function parsePrNumber(subject: string): number | undefined {
  // Prefer the LAST parenthesized "(#N)": a revert's quoted inner number
  // (Revert "Add x (#10)" (#20)) resolves to the real PR (#20), while still
  // catching "(#N)" followed by trailing punctuation/tags ("(#5).", "(#88) [skip ci]").
  const paren = [...subject.matchAll(/\(#(\d+)\)/g)];
  const raw = paren.length ? paren[paren.length - 1][1] : subject.match(/(?:^|\s)#(\d+)\b/)?.[1];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  // A >15-digit "PR number" isn't a real PR; reject rather than fetch/link a precision-lost value.
  return Number.isSafeInteger(n) ? n : undefined;
}

export function resolveRange(
  opts: { from?: string; to?: string },
  runGit: GitRunner,
): { from: string; to: string } {
  let from = opts.from;
  if (from === undefined) {
    // Default to the last tag; but a repo with NO tags (the common first-changelog case)
    // should generate over ALL history rather than dying on `git describe`. "" = all history.
    try {
      from = runGit(["describe", "--tags", "--abbrev=0"]).trim();
    } catch {
      from = "";
    }
  }
  const to = opts.to ?? "HEAD";
  return { from, to };
}

export function listCommits(from: string, to: string, runGit: GitRunner): Commit[] {
  // Use git's -z NUL record terminator (NUL cannot appear in commit content) and put
  // the free-form body LAST, so a FIELD separator embedded in the body can't spawn a
  // phantom commit — it's reassembled via parts.slice(3).join(FIELD).
  const format = ["%H", "%s", "%an", "%b"].join(FIELD);
  // An empty `from` means "all history up to `to`" (no tag baseline); this also includes
  // the root commit, which a `from..to` range would exclude.
  const range = from ? `${from}..${to}` : to;
  // "--end-of-options" makes git treat `range` strictly as a revision, never as a flag —
  // so a from/to value beginning with "-" (e.g. "--output=/path") can't inject a git
  // option (arbitrary file write) or silently produce a wrong/empty changelog.
  const out = runGit(["log", "-z", `--format=${format}`, "--end-of-options", range]);
  return out
    .split("\0")
    .filter((r) => r.length > 0)
    .map((record) => {
      const parts = record.split(FIELD);
      const [sha, subject, author] = parts;
      const body = parts.slice(3).join(FIELD).trim();
      return { sha, subject, body, author };
    });
}
