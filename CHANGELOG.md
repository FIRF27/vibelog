# Changelog

All notable changes to this project are documented in this file.

> 中文版: [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)

## [v0.1.0] - 2026-06-05

### Added

- Adds a `--language` option, `VIBELOG_LANGUAGE` env var, and config setting to generate summaries in a chosen language while preserving code identifiers and proper nouns. ([`18fa738`](https://github.com/FIRF27/vibelog/commit/18fa738))
- Adds GitHub Action support with a bundled shell entrypoint. ([`7c3881d`](https://github.com/FIRF27/vibelog/commit/7c3881d))
- Adds CLI support for writing output to stdout or a file and wires in real git, LLM, and Octokit integrations. ([`328f158`](https://github.com/FIRF27/vibelog/commit/328f158))
- Adds the changelog generation orchestrator, including empty-range handling that returns no output. ([`eae71d2`](https://github.com/FIRF27/vibelog/commit/eae71d2))
- Adds LLM-based summarization with batching, validation, and merge handling. ([`4fdc7b4`](https://github.com/FIRF27/vibelog/commit/4fdc7b4))
- Adds commit-to-ChangeSet assembly with PR metadata support. ([`4c1d7ef`](https://github.com/FIRF27/vibelog/commit/4c1d7ef))
- Adds PR metadata fetching and normalization through Octokit. ([`c86072b`](https://github.com/FIRF27/vibelog/commit/c86072b))
- Adds git range resolution, commit listing, and PR number parsing. ([`ba71340`](https://github.com/FIRF27/vibelog/commit/ba71340))
- Adds config loading with flags-over-env-over-file-over-defaults precedence. ([`f06c385`](https://github.com/FIRF27/vibelog/commit/f06c385))
- Adds rendering of structured results to Keep a Changelog markdown. ([`b58cfd3`](https://github.com/FIRF27/vibelog/commit/b58cfd3))
- Adds the core types and Zod schemas used by the changelog generator. ([`b93e8e2`](https://github.com/FIRF27/vibelog/commit/b93e8e2))

### Changed

- Stabilizes changelog generation by requesting temperature 0 and a fixed seed. ([`4f61987`](https://github.com/FIRF27/vibelog/commit/4f61987))
- Improves changelog rendering and prepend logic to handle fence markers, CRLF line endings, and empty or out-of-range references more safely. ([`8f13f98`](https://github.com/FIRF27/vibelog/commit/8f13f98))
- Improves git parsing, PR detection, batching, truncation, and retry feedback for more robust changelog generation. ([`45b4647`](https://github.com/FIRF27/vibelog/commit/45b4647))
- Validates config files with Zod and rejects invalid ignore-pattern regular expressions with clearer errors. ([`e9d40e0`](https://github.com/FIRF27/vibelog/commit/e9d40e0))
- Makes the published package executable correctly by adding a prepack build hook and package metadata exports. ([`0fc0cb8`](https://github.com/FIRF27/vibelog/commit/0fc0cb8))
- Captures git stderr so handled failures no longer leak raw error text. ([`693e9de`](https://github.com/FIRF27/vibelog/commit/693e9de))

### Fixed

- Handles JSON-mode no-op responses correctly and drops summaries that contain no visible content. ([`1d9fd90`](https://github.com/FIRF27/vibelog/commit/1d9fd90))
- Fails loudly when an LLM returns valid JSON in the wrong shape instead of silently reporting no changes. ([`263d5ea`](https://github.com/FIRF27/vibelog/commit/263d5ea))
- Prevents git argument injection, sanitizes version headings and links, and avoids empty version blocks when no entries are generated. ([`6b78327`](https://github.com/FIRF27/vibelog/commit/6b78327))
- Prevents changelog output from being overwritten when the existing file does not use the expected title and handles first-run history correctly. ([`28f0d3a`](https://github.com/FIRF27/vibelog/commit/28f0d3a))
- Sanitizes changelog output to prevent forged headers and link breakout, and improves error reporting for git ENOBUFS failures. ([`2f8323c`](https://github.com/FIRF27/vibelog/commit/2f8323c))
- Tolerates malformed LLM output, including bad refs, junk ids, and stringified breaking flags. ([`081c1ef`](https://github.com/FIRF27/vibelog/commit/081c1ef))
- Fixes the published CLI entrypoint so `npx vibelog` works after install and hardens LLM schema handling for blank summaries and empty results. ([`830fa48`](https://github.com/FIRF27/vibelog/commit/830fa48))
- Fixes the Action bundle so the CLI main function does not run twice and adds the `to` input. ([`04b2818`](https://github.com/FIRF27/vibelog/commit/04b2818))
- Fixes the broken published CLI symlink resolution used by the package entry guard. ([`0fc0cb8`](https://github.com/FIRF27/vibelog/commit/0fc0cb8))
- Drops control-only summaries and prevents empty bullets from being rendered. ([`1d9fd90`](https://github.com/FIRF27/vibelog/commit/1d9fd90))
- Preserves existing config defaults when environment or flag values are empty and improves no-changes messaging for repositories without tags. ([`8f13f98`](https://github.com/FIRF27/vibelog/commit/8f13f98))

