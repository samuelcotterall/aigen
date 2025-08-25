import { describe, it, expect, vi } from "vitest";
import makeClackMock from "./utils/mockPrompts";

vi.mock("@clack/prompts", async () =>
  makeClackMock({
    preset: "custom",
    tsconfig: "balanced",
    multiselectValue: ["openai", "langchain"],
    textValue: "CustomTool",
  })
);

import { run } from "../src/index";

describe("CLI custom-selection journeys", () => {
  it("accepts custom libraries and tools and writes outputs", async () => {
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(" "));
      origLog.apply(console, args as any);
    };
    try {
      await run({ dev: true } as any);
      const all = logs.join("\n");
      expect(all).toContain("Dev output written to:");
    } finally {
      console.log = origLog;
    }
  }, 30000);
});
