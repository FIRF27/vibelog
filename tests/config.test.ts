import { describe, it, expect } from "vitest";
import { configFromEnv, mergeConfig, parseConfigText, readJsonConfig } from "../src/core/config.js";
import { DEFAULT_CONFIG } from "../src/core/types.js";

describe("config", () => {
  it("reads env vars", () => {
    const env = { VIBELOG_MODEL: "gpt-4o", OPENAI_BASE_URL: "http://x" };
    const c = configFromEnv(env);
    expect(c.model).toBe("gpt-4o");
    expect(c.baseUrl).toBe("http://x");
  });

  it("treats empty env values as unset (no masking, no empty model)", () => {
    const c = configFromEnv({ OPENAI_BASE_URL: "", VIBELOG_BASE_URL: "http://fallback", VIBELOG_MODEL: "" });
    expect(c.baseUrl).toBe("http://fallback"); // empty OPENAI_BASE_URL did not mask the fallback
    expect("model" in c).toBe(false); // empty model dropped, not sent to the LLM
  });

  it("applies precedence flags > env > file > defaults", () => {
    const merged = mergeConfig({
      defaults: DEFAULT_CONFIG,
      fileConfig: { model: "file-model", batchSize: 50 },
      env: configFromEnv({ VIBELOG_MODEL: "env-model" }),
      flags: { model: "flag-model" },
    });
    expect(merged.model).toBe("flag-model"); // flag wins
    expect(merged.batchSize).toBe(50); // from file (no env/flag)
    expect(merged.maxBodyChars).toBe(2000); // from defaults
  });

  it("ignores undefined values so lower layers show through", () => {
    const merged = mergeConfig({
      defaults: DEFAULT_CONFIG,
      env: configFromEnv({ VIBELOG_MODEL: "env-model" }),
      flags: { model: undefined },
    });
    expect(merged.model).toBe("env-model");
  });
});

describe("config validation", () => {
  it("parses a valid config", () => {
    expect(parseConfigText('{"model":"x","batchSize":50}', "t").batchSize).toBe(50);
  });

  it("rejects malformed JSON, naming the file", () => {
    expect(() => parseConfigText("{ bad json", "my.json")).toThrow(/invalid JSON in config file my\.json/);
  });

  it("rejects a wrong-typed value", () => {
    expect(() => parseConfigText('{"batchSize":"100"}', "t")).toThrow(/invalid config/);
  });

  it("rejects batchSize 0 (would hang batching)", () => {
    expect(() => parseConfigText('{"batchSize":0}', "t")).toThrow(/batchSize/);
  });

  it("rejects a non-array ignorePatterns", () => {
    expect(() => parseConfigText('{"ignorePatterns":"^chore"}', "t")).toThrow(/ignorePatterns/);
  });

  it("rejects unknown keys (typo guard)", () => {
    expect(() => parseConfigText('{"modle":"x"}', "t")).toThrow(/invalid config/);
  });

  it("reports a missing config file path", () => {
    expect(() => readJsonConfig("/no/such/dir/vibelog.config.json")).toThrow(/config file not found/);
  });
});
