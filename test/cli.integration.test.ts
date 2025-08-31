import { describe, it, expect, vi } from "vitest";
import makeClackMock from "./utils/mockPrompts";

vi.mock("@clack/prompts", async () =>
  makeClackMock({
    preset: "openai",
    tsconfig: "strict",
    searchMore: "no",
    textValue: "done",
  })
);

import { run } from "../src/index";

describe("CLI integration (dev mode)", () => {
  it("runs programmatically with mocked prompts and writes dev output", async () => {
    // call run directly with options to avoid spawning a TTY; provide name and dev
    const opts = { dev: true, name: "Integration Agent" } as any;
    // capture console output
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(" "));
      origLog.apply(console, args);
    };

    try {
      await run(opts);
      const all = logs.join("\n");
      expect(all).toContain("Dev output written to:");
      // ensure we don't accidentally print duplicated path segments like 'config/config/agent.json'
      expect(all).not.toMatch(/([\w-]+)\/\1\//);
    } finally {
      console.log = origLog;
    }
  }, 30000);
});
