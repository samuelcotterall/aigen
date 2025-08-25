import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import makeClackMock from "./utils/mockPrompts";

vi.mock("@clack/prompts", async () =>
  makeClackMock({ preset: "openai", tsconfig: "strict", textValue: "My Agent" })
);

import { run } from "../src/index";

describe("CLI happy-path journeys", () => {
  it("creates dev output and exits cleanly", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(" "));
      origLog.apply(console, args as any);
    };

    try {
      await run({ dev: true, name: "HappyAgent" } as any);
      const out = logs.join("\n");
      expect(out).toContain("Dev output written to:");
    } finally {
      console.log = origLog;
    }
  }, 30000);
});
