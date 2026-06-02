import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CONFIG, type Config } from "./types.js";

type Env = Record<string, string | undefined>;

function pickDefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function configFromEnv(env: Env): Partial<Config> {
  return pickDefined({
    model: env.VIBELOG_MODEL,
    baseUrl: env.OPENAI_BASE_URL ?? env.VIBELOG_BASE_URL,
    repoUrl: env.VIBELOG_REPO_URL,
    includeAuthors: env.VIBELOG_INCLUDE_AUTHORS
      ? env.VIBELOG_INCLUDE_AUTHORS === "true"
      : undefined,
  });
}

export function loadConfigFile(cwd: string): Partial<Config> {
  const path = join(cwd, "vibelog.config.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as Partial<Config>;
}

export function mergeConfig(opts: {
  defaults?: Config;
  fileConfig?: Partial<Config>;
  env?: Partial<Config>;
  flags?: Partial<Config>;
}): Config {
  return {
    ...(opts.defaults ?? DEFAULT_CONFIG),
    ...pickDefined(opts.fileConfig ?? {}),
    ...pickDefined(opts.env ?? {}),
    ...pickDefined(opts.flags ?? {}),
  };
}
