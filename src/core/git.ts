import { execFileSync } from "node:child_process";
import type { Commit, GitRunner } from "./types.js";

const FIELD = "\x1f";
const RECORD = "\x1e";

export const realGitRunner: GitRunner = (args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

export function parsePrNumber(subject: string): number | undefined {
  const squash = subject.match(/\(#(\d+)\)/);
  if (squash) return Number(squash[1]);
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
  const format = ["%H", "%s", "%b", "%an"].join(FIELD) + RECORD;
  const out = runGit(["log", `${from}..${to}`, `--format=${format}`]);
  return out
    .split(RECORD)
    .map((r) => r.replace(/^\n/, ""))
    .filter((r) => r.trim().length > 0)
    .map((record) => {
      const [sha, subject, body, author] = record.split(FIELD);
      return { sha, subject, body: (body ?? "").trim(), author };
    });
}
