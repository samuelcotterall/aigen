import { describe, it, expect, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import makeClackMock from "./utils/mockPrompts";

vi.mock("@clack/prompts", async () =>
  makeClackMock({ preset: "openai", tsconfig: "strict", textValue: "DryRunFS" })
);

import { run } from "../src/index";

describe("CLI dry-run filesystem", () => {
  it("does not create files when --dry-run is used", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dryrun-fs-"));
    try {
      // confirm the temp dir is empty initially
      const before = await fs.readdir(tmp);
      expect(before.length).toBe(0);

      // run CLI in dry-run mode pointing at tmp
      await run({ dryRun: true, outDir: tmp, name: "DryRun FS" } as any);

      // after dry-run, the parent tmp should still be empty (no candidate dir written)
      const after = await fs.readdir(tmp);
      // allow for possible hidden files created by other processes, assert no new named entries
      expect(after.length).toBe(before.length);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  }, 10000);
});
