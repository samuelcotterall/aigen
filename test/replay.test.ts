// Ensure code paths that detect test env see we're under Vitest so prompts avoid TTY calls
process.env.VITEST = "true";
import fs from "node:fs/promises";
import path from "node:path";
import { test, expect } from "vitest";
import { run } from "../src/index.js";
import { loadPreset, savePreset } from "../src/cli/config.js";

test("replay: applying the same preset twice produces identical files", async () => {
  // build a small preset that maps to existing default selections
  const preset = {
    name: "replay-agent",
    displayName: "Replay Agent",
    slug: "replay-agent",
    preset: "openai",
    libraries: ["openai"],
    environments: ["typescript"],
  };
  const outRoot = path.join(process.cwd(), "out");
  await fs.mkdir(outRoot, { recursive: true }).catch(() => {});
  const tmpDir = await fs.mkdtemp(path.join(outRoot, "tmp-replay-"));

  // first run: supply a fully non-interactive opts object to avoid prompts
  await run({
    nonInteractive: true,
    outDir: tmpDir,
    force: true,
    name: preset.name,
    displayName: preset.displayName,
    slug: preset.slug,
    preset: preset.preset,
    libraries: preset.libraries,
    environments: preset.environments,
  });
  // capture tree
  async function tree(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory())
        out.push(...(await tree(p)).map((s) => path.join(e.name, s)));
      else out.push(e.name);
    }
    out.sort();
    return out;
  }
  const first = await tree(tmpDir);

  // second run using same preset should result in same set of files
  await run({
    nonInteractive: true,
    outDir: tmpDir,
    force: true,
    name: preset.name,
    displayName: preset.displayName,
    slug: preset.slug,
    preset: preset.preset,
    libraries: preset.libraries,
    environments: preset.environments,
  });
  const second = await tree(tmpDir);
  expect(first).toEqual(second);
});
