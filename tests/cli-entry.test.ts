import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { isDirectRun } from "../src/cli/index.js";

// Regression for the npm-bin-symlink no-op: realpath-resolving both sides must make the
// entry guard fire when the command is run through node_modules/.bin/<name> (a symlink).
describe("isDirectRun", () => {
  it("is true when argv1 is a symlink pointing at the module file (the npm bin case)", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibelog-bin-"));
    try {
      const real = join(dir, "index.js");
      const link = join(dir, "bin-vibelog");
      writeFileSync(real, "// stub");
      symlinkSync(real, link);
      expect(isDirectRun(pathToFileURL(real).href, link)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is false when the module is merely imported by another file", () => {
    const dir = mkdtempSync(join(tmpdir(), "vibelog-bin-"));
    try {
      const real = join(dir, "index.js");
      const other = join(dir, "importer.js");
      writeFileSync(real, "// stub");
      writeFileSync(other, "// importer");
      expect(isDirectRun(pathToFileURL(real).href, other)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("is false when there is no argv1", () => {
    expect(isDirectRun("file:///whatever.js", undefined)).toBe(false);
  });
});
