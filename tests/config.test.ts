import { describe, it, expect } from "vitest";
import { configFromEnv, mergeConfig } from "../src/core/config.js";
import { DEFAULT_CONFIG } from "../src/core/types.js";

describe("config", () => {
  it("reads env vars", () => {
    const env = { VIBELOG_MODEL: "gpt-4o", OPENAI_BASE_URL: "http://x", VIBELOG_INCLUDE_AUTHORS: "true" };
    const c = configFromEnv(env);
    expect(c.model).toBe("gpt-4o");
    expect(c.baseUrl).toBe("http://x");
    expect(c.includeAuthors).toBe(true);
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
