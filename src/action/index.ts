import { writeFileSync, readFileSync, existsSync } from "node:fs";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import OpenAI from "openai";
import {
  generateChangelog,
  DEFAULT_CONFIG,
  type ChatMessage,
  type Config,
  type PullRequest,
} from "../core/index.js";
import { realGitRunner } from "../core/git.js";
import { fetchPullRequests, type OctokitLike } from "../core/github.js";
import { configFromEnv, mergeConfig } from "../core/config.js";
import { prependChangelog } from "../core/changelogFile.js";

async function run(): Promise<void> {
  try {
    const apiKey = core.getInput("openai-api-key", { required: true });
    const token = core.getInput("github-token");
    const flags: Partial<Config> = {
      model: core.getInput("model") || undefined,
      baseUrl: core.getInput("base-url") || undefined,
    };
    const config = mergeConfig({ defaults: DEFAULT_CONFIG, env: configFromEnv(process.env), flags });

    const { owner, repo } = context.repo;
    // serverUrl is the GitHub host (github.com or a GitHub Enterprise Server host), so
    // PR/commit links are correct on GHE too.
    const serverUrl = context.serverUrl || "https://github.com";
    config.repoUrl ??= `${serverUrl}/${owner}/${repo}`;

    let fetchPRs: ((numbers: number[]) => Promise<Map<number, PullRequest>>) | undefined;
    if (token) {
      const octokit = getOctokit(token) as unknown as OctokitLike;
      fetchPRs = (numbers) =>
        fetchPullRequests(numbers, { octokit, owner, repo, onWarn: (m) => core.warning(m) });
    }

    const llm = async (messages: ChatMessage[]): Promise<string> => {
      const client = new OpenAI({ apiKey, baseURL: config.baseUrl });
      const res = await client.chat.completions.create({
        model: config.model,
        temperature: 0, // deterministic-as-possible so regenerating yields a stable changelog
        seed: 1,
        response_format: { type: "json_object" },
        messages,
      });
      return res.choices[0]?.message?.content ?? "{}";
    };

    const markdown = await generateChangelog({
      config,
      version: core.getInput("version-name") || "Unreleased",
      date: new Date().toISOString().slice(0, 10),
      from: core.getInput("from") || undefined,
      to: core.getInput("to") || undefined,
      deps: { runGit: realGitRunner, llm, fetchPRs },
    });

    if (markdown === null) {
      core.info("vibelog: no changes in range.");
      core.setOutput("changelog", "");
      return;
    }

    core.setOutput("changelog", markdown);

    if (core.getInput("write") === "true") {
      const file = core.getInput("output-file");
      const existing = existsSync(file) ? readFileSync(file, "utf8") : "";
      writeFileSync(file, prependChangelog(existing, markdown));
      core.info(`vibelog: wrote ${file}`);
    }
  } catch (err) {
    core.setFailed(err instanceof Error ? err.message : String(err));
  }
}

run();
