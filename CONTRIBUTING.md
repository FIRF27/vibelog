# Contributing to vibelog

Thanks for your interest! vibelog is a small TypeScript project — a core library with
thin CLI and GitHub Action shells.

## Setup

```bash
npm install
npm test        # vitest
npm run build   # tsc -> dist/
```

## Workflow

- Use TDD: add or update a test, watch it fail, then implement.
- Keep the core library pure and side-effect free; side effects (git, network, LLM,
  process exit) live in the CLI/Action shells, injected as functions so the core stays
  testable.
- Run `npm test` and `npm run build` before opening a PR.

## Changing the Action or core

The GitHub Action runs from the committed bundle at `dist-action/index.js`. If you change
anything under `src/action`, `src/core`, or `src/cli` that the Action imports, rebuild
and commit the bundle:

```bash
npm run build:action
git add dist-action
```

CI verifies the committed bundle matches a fresh build, so a stale bundle fails the
`bundle-sync` job.

## Commit messages

Conventional-commit prefixes (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) are
appreciated but not required — vibelog itself can summarize messy history. 🙂
