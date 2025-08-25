import { describe, it, expect, vi } from "vitest";

// Mock @clack/prompts to simulate interactive answers.
vi.mock("@clack/prompts", async () => {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    isCancel: () => false,
    select: vi.fn().mockImplementation((opts: any) => {
      if (opts.message?.includes("Choose a preset"))
        return Promise.resolve("openai");
      if (opts.message?.includes("TypeScript strictness"))
        return Promise.resolve("strict");
      if (opts.message?.includes("Search for more tools?"))
        return Promise.resolve("no");
      // default to initialValue when present
      return Promise.resolve(
        opts.initialValue ?? (opts.options && opts.options[0]?.value)
      );
    }),
    multiselect: vi.fn().mockResolvedValue([]),
    text: vi.fn().mockResolvedValue("done"),
  };
});

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
    } finally {
      console.log = origLog;
    }
  }, 30000);
});
