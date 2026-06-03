#!/usr/bin/env node
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import OpenAI from "openai";
import { Octokit } from "@octokit/rest";
import {
  generateChangelog,
  DEFAULT_CONFIG,
  type ChatMessage,
  type Config,
  type PullRequest,
} from "../core/index.js";
import { realGitRunner } from "../core/git.js";
import { fetchPullRequests } from "../core/github.js";
import { configFromEnv, loadConfigFile, mergeConfig } from "../core/config.js";
import { prependChangelog } from "../core/changelogFile.js";

function detectRepo(): { owner: string; repo: string } | undefined {
  const env = process.env.GITHUB_REPOSITORY;
  if (env && env.includes("/")) {
    const [owner, repo] = env.split("/");
    return { owner, repo };
  }
  try {
    const url = realGitRunner(["remote", "get-url", "origin"]).trim();
    const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/);
    if (m) return { owner: m[1], repo: m[2] };
  } catch {
    /* no remote */
  }
  return undefined;
}

function makeLlm(config: Config): (messages: ChatMessage[]) => Promise<string> {
  return async (messages) => {
    // Construct lazily so commits-only / empty-range runs don't require an API key.
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: config.baseUrl });
    const res = await client.chat.completions.create({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
    });
    return res.choices[0]?.message?.content ?? "{}";
  };
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("vibelog")
    .description("Turn messy git history into clean release notes with AI.")
    .option("--from <ref>", "start ref (default: last tag)")
    .option("--to <ref>", "end ref (default: HEAD)")
    .option("--version-name <name>", "version heading (default: Unreleased)", "Unreleased")
    .option("--model <model>")
    .option("--base-url <url>")
    .option("--repo-url <url>")
    .option("--include-authors")
    .option("--config <file>")
    .option("--write", "prepend into CHANGELOG.md instead of printing")
    .option("--output <file>", "file to write when --write is set", "CHANGELOG.md")
    .parse();

  const opts = program.opts();
  const flags: Partial<Config> = {
    model: opts.model,
    baseUrl: opts.baseUrl,
    repoUrl: opts.repoUrl,
    includeAuthors: opts.includeAuthors ? true : undefined,
  };
  const config = mergeConfig({
    defaults: DEFAULT_CONFIG,
    fileConfig: opts.config ? JSON.parse(readFileSync(opts.config, "utf8")) : loadConfigFile(process.cwd()),
    env: configFromEnv(process.env),
    flags,
  });

  const repo = detectRepo();
  let fetchPRs: ((numbers: number[]) => Promise<Map<number, PullRequest>>) | undefined;
  if (process.env.GITHUB_TOKEN && repo) {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    fetchPRs = (numbers) =>
      fetchPullRequests(numbers, {
        octokit,
        owner: repo.owner,
        repo: repo.repo,
        onWarn: (m) => console.error(m),
      });
  } else {
    console.error("vibelog: no GITHUB_TOKEN/repo detected — using commits only.");
  }

  if (!config.repoUrl && repo) config.repoUrl = `https://github.com/${repo.owner}/${repo.repo}`;

  const date = new Date().toISOString().slice(0, 10);
  const markdown = await generateChangelog({
    config,
    version: opts.versionName,
    date,
    from: opts.from,
    to: opts.to,
    deps: { runGit: realGitRunner, llm: makeLlm(config), fetchPRs },
  });

  if (markdown === null) {
    console.error(`vibelog: no changes since ${opts.from ?? "last tag"}.`);
    process.exit(0);
  }

  if (opts.write) {
    const existing = existsSync(opts.output) ? readFileSync(opts.output, "utf8") : "";
    writeFileSync(opts.output, prependChangelog(existing, markdown));
    console.error(`vibelog: wrote ${opts.output}`);
  } else {
    process.stdout.write(markdown);
  }
}

// Only run when invoked directly as a binary, not when imported (tests / action shell).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(`vibelog: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
