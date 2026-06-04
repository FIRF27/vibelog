import { execFileSync } from "node:child_process";
import type { Commit, GitRunner } from "./types.js";

const FIELD = "\x1f";

export const realGitRunner: GitRunner = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    // Capture stderr instead of inheriting it, so git's own error text
    // (e.g. "No such remote 'origin'") doesn't leak to our output on a caught failure.
    stdio: ["ignore", "pipe", "pipe"],
  });

export function parsePrNumber(subject: string): number | undefined {
  // Prefer the LAST parenthesized "(#N)": a revert's quoted inner number
  // (Revert "Add x (#10)" (#20)) resolves to the real PR (#20), while still
  // catching "(#N)" followed by trailing punctuation/tags ("(#5).", "(#88) [skip ci]").
  const paren = [...subject.matchAll(/\(#(\d+)\)/g)];
  if (paren.length) return Number(paren[paren.length - 1][1]);
  const inline = subject.match(/(?:^|\s)#(\d+)\b/);
  return inline ? Number(inline[1]) : undefined;
}

export function resolveRange(
  opts: { from?: string; to?: string },
  runGit: GitRunner,
): { from: string; to: string } {
  const from = opts.from ?? runGit(["describe", "--tags", "--abbrev=0"]).trim();
  const to = opts.to ?? "HEAD";
  return { from, to };
}

export function listCommits(from: string, to: string, runGit: GitRunner): Commit[] {
  // Use git's -z NUL record terminator (NUL cannot appear in commit content) and put
  // the free-form body LAST, so a FIELD separator embedded in the body can't spawn a
  // phantom commit — it's reassembled via parts.slice(3).join(FIELD).
  const format = ["%H", "%s", "%an", "%b"].join(FIELD);
  const out = runGit(["log", `${from}..${to}`, "-z", `--format=${format}`]);
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
