# vibelog

[![CI](https://github.com/FIRF27/vibelog/actions/workflows/ci.yml/badge.svg)](https://github.com/FIRF27/vibelog/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

> Turn messy git history into clean release notes — with AI.

Most changelog tools (`git-cliff`, `release-please`, `conventional-changelog`) are
deterministic: they produce great output **only if** your team religiously follows
Conventional Commits. Real history rarely looks like that — it looks like `fix stuff`,
`wip`, `update`, `more changes`.

**vibelog** takes that messy history *plus* the associated pull-request titles, bodies,
and labels, and asks an LLM to filter the noise, classify each real change, and write
human, user-facing release notes in the [Keep a Changelog](https://keepachangelog.com)
format. **No commit convention required.**

It ships as both a **CLI** and a **GitHub Action**, sharing one core.

---

## Quick start (CLI)

```bash
export OPENAI_API_KEY=sk-...
# Optional: needed to enrich notes with PR titles/bodies/labels
export GITHUB_TOKEN=ghp_...

# Print release notes for "last tag → HEAD" to stdout
npx @firf27/vibelog --version-name v1.2.0

# Or write them into CHANGELOG.md (prepended above the latest version)
npx @firf27/vibelog --version-name v1.2.0 --write
```

Published as the scoped package **`@firf27/vibelog`**; the installed command is
`vibelog` (`npm i -g @firf27/vibelog`, then run `vibelog`).

No `GITHUB_TOKEN` or non-GitHub repo? vibelog automatically falls back to
commit-messages-only.

## Works with any OpenAI-compatible endpoint

vibelog defaults to the OpenAI API but talks to **any OpenAI-compatible endpoint** —
just override the base URL and model. That covers Azure OpenAI, Ollama, OpenRouter,
vLLM, LM Studio, and more:

```bash
# Local Ollama
OPENAI_API_KEY=ollama \
OPENAI_BASE_URL=http://localhost:11434/v1 \
npx @firf27/vibelog --model llama3.1 --version-name v1.2.0
```

## CLI options

| Flag | Description | Default |
|---|---|---|
| `--from <ref>` | Start ref, exclusive (like git) | last tag, or all history if the repo has no tags |
| `--to <ref>` | End ref | `HEAD` |
| `--version-name <name>` | Version heading text | `Unreleased` |
| `--model <model>` | LLM model id | `gpt-4.1-mini` |
| `--base-url <url>` | OpenAI-compatible base URL | OpenAI default |
| `--repo-url <url>` | Base URL for PR/commit links | inferred from `origin` |
| `--language <lang>` | Language for the generated summaries (e.g. `中文`) | model default |
| `--config <file>` | Path to a config file | `vibelog.config.json` |
| `--write` | Prepend into the changelog file instead of printing | off |
| `--output <file>` | File to write when `--write` is set | `CHANGELOG.md` |

### Environment variables

- `OPENAI_API_KEY` — API key (required to call the model).
- `OPENAI_BASE_URL` — OpenAI-compatible endpoint override.
- `GITHUB_TOKEN` — enables fetching PR metadata.
- `VIBELOG_MODEL`, `VIBELOG_BASE_URL`, `VIBELOG_REPO_URL`, `VIBELOG_LANGUAGE`
  — config overrides (lower precedence than CLI flags).

### Config file (`vibelog.config.json`)

```json
{
  "model": "gpt-4.1-mini",
  "repoUrl": "https://github.com/me/proj",
  "ignorePatterns": ["^Merge ", "^chore", "^ci", "^build", "^style", "^docs"],
  "language": "中文",
  "batchSize": 100,
  "maxBodyChars": 2000
}
```

Precedence: **CLI flags > environment variables > config file > built-in defaults.**

> `ignorePatterns` are trusted, maintainer-supplied regexes run against commit subjects.
> Keep them simple and anchored (like the defaults); avoid nested quantifiers such as
> `(a+)+`, which can backtrack catastrophically on crafted commit subjects.

## GitHub Action

```yaml
name: Release notes
on:
  workflow_dispatch:
jobs:
  notes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 } # full history + tags
      - id: changelog
        uses: FIRF27/vibelog@v0 # pin to a published tag/release, or a commit SHA
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          version-name: ${{ github.ref_name }}
      - run: echo "${{ steps.changelog.outputs.changelog }}"
```

The `changelog` output is the generated markdown — feed it to a GitHub Release, a PR
comment, or set `write: "true"` to prepend it into `CHANGELOG.md`.

> **`write: "true"` only edits the file in the workspace — it does not commit or push.**
> To persist it, give the job `permissions: { contents: write }` and add your own commit
> step (e.g. `stefanzweifel/git-auto-commit-action`, or `git commit`/`git push`), or open
> a PR. This keeps vibelog out of your release/commit policy by design.

## What it does *not* do

By design (so it composes cleanly with your existing release flow), vibelog does **not**
pick version numbers, bump `package.json`, or create tags/releases. It only generates
the notes. Pair it with `release-please` / `semantic-release` or your own tagging if you
want full automation.

## Scope of the LLM input

vibelog sends commit subjects/bodies and associated PR titles/bodies/labels (bodies
truncated to `maxBodyChars`). It does **not** send code diffs.

## Reproducibility

The notes are AI-generated. vibelog requests `temperature: 0` and a fixed `seed`, which
keeps the section structure stable, but output is **not byte-for-byte reproducible** —
regenerating can reword or regroup entries. Generate the changelog once per release and
commit it (rather than regenerating and diffing on every run).

## Development

```bash
npm install
npm test          # vitest
npm run build     # tsc -> dist/
npm run build:action  # ncc -> dist-action/ (committed; the Action runs from it)
npm run dev -- --from <sha> --to HEAD --version-name v0.1.0
```

## License

MIT
