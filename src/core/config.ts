import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CONFIG, PartialConfigSchema, type Config } from "./types.js";

type Env = Record<string, string | undefined>;

function pickDefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export function configFromEnv(env: Env): Partial<Config> {
  // Treat empty strings as unset (|| not ??), so an empty OPENAI_BASE_URL doesn't mask a
  // valid VIBELOG_BASE_URL and an empty model doesn't reach the LLM call.
  return pickDefined({
    model: env.VIBELOG_MODEL || undefined,
    baseUrl: env.OPENAI_BASE_URL || env.VIBELOG_BASE_URL || undefined,
    repoUrl: env.VIBELOG_REPO_URL || undefined,
    language: env.VIBELOG_LANGUAGE || undefined,
  });
}

export function parseConfigText(raw: string, source: string): Partial<Config> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid JSON in config file ${source}: ${(err as Error).message}`);
  }
  const res = PartialConfigSchema.safeParse(json);
  if (!res.success) {
    const msg = res.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`invalid config (${source}): ${msg}`);
  }
  return res.data;
}

export function readJsonConfig(path: string): Partial<Config> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") throw new Error(`config file not found: ${path}`);
    throw new Error(`cannot read config file ${path}: ${e.message}`);
  }
  return parseConfigText(raw, path);
}

export function loadConfigFile(cwd: string): Partial<Config> {
  const path = join(cwd, "vibelog.config.json");
  if (!existsSync(path)) return {};
  return readJsonConfig(path);
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
