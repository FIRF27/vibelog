# vibelog — AI Changelog Generator (Design Spec)

> Working name: `vibelog` (rename freely; not load-bearing).
> Date: 2026-06-02
> Status: Approved-to-plan (user delegated all recommendations).

## 1. Purpose & Wedge

A changelog generator whose core differentiation is: **it turns messy, inconsistent
git history into clean, human-readable, user-facing release notes — without requiring
the team to adopt Conventional Commits.**

Existing tools (`git-cliff`, `release-please`, `conventional-changelog`, `semantic-release`)
are deterministic and produce poor output when commit history is messy (`fix stuff`,
`wip`, `update`). Our wedge is the AI step: combine commit messages + associated PR
metadata, then have an LLM filter noise, classify changes, and write human bullets.

This is the unique value deterministic tools cannot provide.

## 2. Scope

**In scope (v1):**
- CLI (`npx vibelog`) and GitHub Action, sharing one core library.
- Input: commit messages in a range + associated PR metadata (title/body/labels) via
  GitHub API. Graceful fallback to commits-only when no token / not a GitHub repo.
- LLM via an OpenAI-compatible endpoint (default OpenAI; `base_url` + `model`
  overridable → also supports Azure / Ollama / OpenRouter / vLLM / LM Studio).
- Output structure: **Keep a Changelog** standard
  (Added / Changed / Fixed / Removed / Deprecated / Security).
- Default range: `last-tag..HEAD`, with `--from` / `--to` overrides.
- Output: markdown to stdout (CLI default), `--write` prepends into `CHANGELOG.md`;
  Action also exposes the markdown as a step output for use as GitHub Release notes.

**Out of scope (YAGNI, explicit non-goals):**
- No version-number decisions, no semver bumping, no tagging, no editing
  `package.json`. Versioning/release is left to the user or to release-please /
  semantic-release.
- No configurable output templates in v1 (fixed Keep a Changelog).
- No multi-provider abstraction layer (the OpenAI-compatible endpoint covers it).
- No code-diff ingestion in v1 (commit + PR metadata only).

## 3. Architecture

Single TypeScript/Node package: one `core` library plus two thin adapters
(CLI shell, Action shell). Node chosen because it runs both via `npx` and as a
native GitHub JS action.

```
vibelog/
  src/
    core/
      collect.ts     # resolve range -> list commits -> attach PR metadata -> ChangeSet
      git.ts         # resolve last-tag..HEAD; list commits in range
      github.ts      # Octokit: fetch PR title/body/labels for commits (token-gated)
      summarize.ts   # LLM: ChangeSet -> classified, human bullets (structured JSON)
      render.ts      # structured result -> Keep a Changelog markdown
      config.ts      # precedence: flags > env > config file > defaults
      types.ts       # ChangeSet, Commit, PullRequest, ChangelogSection, Config
      index.ts       # generateChangelog(opts): Promise<string>  (the markdown)
    cli/index.ts     # commander shell: stdout by default; --write prepends CHANGELOG.md
    action/index.ts  # @actions/core shell: read inputs -> core -> set output / write file
  action.yml         # GitHub Action metadata
  tests/
  README.md
  package.json
```

Each unit has one purpose and a clear interface:
- `collect` depends on `git` + `github`, returns a `ChangeSet`.
- `summarize` depends only on the LLM client + a `ChangeSet`, returns structured sections.
- `render` is pure: structured sections -> markdown string. Easiest to golden-test.
- `index.generateChangelog` orchestrates and returns the markdown; both shells call it.

## 4. Data Flow

1. **Resolve range** — default `last-tag..HEAD`; honor `--from`/`--to`.
2. **Collect commits** — `git log` over the range (via `simple-git` or spawned git).
3. **Attach PR metadata** — if a GitHub token + repo are detected, extract PR numbers
   from commit subjects (GitHub's squash/merge convention puts `(#123)` in the subject),
   then fetch those PRs via the API to gather title/body/labels/author. Commits without
   a PR reference use the commit message alone. Without a token / non-GitHub repo, fall
   back to commits-only.
4. **Build ChangeSet** — list of entries: `{ sha, message, prNumber?, prTitle?,
   prBody?, labels?, author }`.
5. **Summarize (LLM)** — prompt the model to (a) drop noise (merge commits, pure
   chore/formatting), (b) classify each meaningful change into a Keep a Changelog
   category, (c) write a concise, present-tense, user-facing bullet, (d) flag breaking
   changes. Returns structured JSON, validated with zod.
6. **Render** — structured result -> Keep a Changelog markdown for the new version
   (heading = provided version label or `Unreleased` + date), with PR / compare links.
7. **Output** — CLI: stdout, or `--write` to prepend into `CHANGELOG.md` (create if
   missing, preserve existing content). Action: set `changelog` output; optional
   `--write`.

### Structured LLM output schema

```json
{
  "breaking": false,
  "sections": [
    {
      "category": "Added|Changed|Fixed|Removed|Deprecated|Security",
      "entries": [
        { "summary": "string", "refs": [ { "type": "pr|commit", "id": "string" } ] }
      ]
    }
  ]
}
```

Temperature low (0–0.3) for stability. `response_format` = JSON; zod-validated; one
retry on validation failure.

### Large-release handling

Batch the ChangeSet into groups of `batchSize` entries (default 100): map (summarize
each batch) -> reduce (merge + dedupe categories). PR/commit bodies are truncated to
`maxBodyChars` (default 2000) before being sent, to bound per-entry token cost. This
count-based approach is simpler and more testable than token estimation for v1.

## 5. Configuration

Precedence: **CLI flags > environment variables > config file > defaults.**

Config file: `vibelog.config.json`.

| Key | Purpose | Default |
|---|---|---|
| `model` | LLM model id | `gpt-4.1-mini` |
| `baseUrl` | OpenAI-compatible endpoint override | OpenAI default |
| `repoUrl` | base URL for PR/compare links | inferred from git remote |
| `ignorePatterns` | commit-message regexes to drop pre-LLM | merge/chore defaults |
| `includeAuthors` | append author handles to bullets | false |
| `batchSize` | entries per LLM batch | 100 |
| `maxBodyChars` | truncate each commit/PR body before sending | 2000 |

Secrets (`OPENAI_API_KEY`, `GITHUB_TOKEN`) come from env only, never a config file.

## 6. Error Handling

- **No changes in range** → friendly message, exit 0 (never fail CI on an empty release).
- **No GitHub token** → warn, fall back to commits-only.
- **LLM call fails** → retry with backoff a few times; persistent failure → non-zero
  exit (CLI) / failed step (Action) with a clear message.
- **Not a git repo** → clear, actionable error.
- **Oversized changeset** → batch; if still over, truncate + warn (see §4).

## 7. Testing (verify intent, not just behavior)

- **Core value test:** given messy commits (`fix stuff`, `wip`) plus descriptive PR
  titles, with the model **stubbed** to return categorized output, the pipeline
  produces categorized human bullets. This proves the "messy history → human notes"
  promise end-to-end without a live API.
- **Fallback test:** with no GitHub token, it runs commits-only without crashing.
- **CI-safety test:** an empty range exits 0 and does not fail.
- **Render golden tests:** structured sections → exact expected Keep a Changelog markdown.
- **Config precedence test:** flags override env override file override defaults.
- **Batching test:** map-reduce merges/dedupes across batches (with a fake summarizer).
- Live-API integration tests gated behind an env var; excluded from CI.

## 8. Tech Stack

- **Language/runtime:** TypeScript + Node (npx + native JS Action).
- **Libraries:** `commander` (CLI), `@actions/core` + `@actions/github` (Action),
  `openai` (LLM, base_url/model overridable), `@octokit/rest` (PR metadata; may reuse
  the Action's octokit), `zod` (validate structured output + config),
  `simple-git` or spawned `git`.
- **Test:** `vitest`.
- **Packaging:** `@vercel/ncc` bundles the Action entry into a single dist file
  (standard for JS actions).

## 9. Git / Repo Note

The project directory is currently **not a git repository**. Per the user's standing
instruction ("commit only when asked"), `git init` and the first commit (including
this spec) will be the **first step of the implementation plan**, not done implicitly
here.

## 10. Why This Fits Codex for OSS

The tool is itself a maintainer utility (helps any project ship clean release notes),
which is the kind of ecosystem-useful OSS the program rewards. It defaults to the
OpenAI API (on-theme) while staying provider-flexible, and is small enough to ship
quickly and accumulate stars.
