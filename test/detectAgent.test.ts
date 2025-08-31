import fs from "fs/promises";
import path from "path";
import { describe, it, expect } from "vitest";
import { detectAgent } from "../src/detectAgent";

const FIXTURE_DIR = path.join(__dirname, "fixtures", "detect-agent");

async function setupFixture(name: string) {
  const dir = path.join(FIXTURE_DIR, name);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe("detectAgent", () => {
  it("reads config/agent.json when present", async () => {
    const dir = await setupFixture("cfg-json");
    const cfgDir = path.join(dir, "config");
    await fs.mkdir(cfgDir, { recursive: true });
    const agent = {
      name: "my-agent",
      displayName: "My Agent",
      tools: [{ name: "tool1" }],
    };
    await fs.writeFile(
      path.join(cfgDir, "agent.json"),
      JSON.stringify(agent, null, 2)
    );

    const res = await detectAgent(dir);
    expect(res).toBeDefined();
    expect(res.name).toBe("my-agent");
    expect(res.displayName).toBe("My Agent");
    expect(res.tools?.length).toBe(1);
  });

  it("parses agent.md when only agent.md exists", async () => {
    const dir = await setupFixture("md-only");
    const md = `# My Agent\n\nThis is an agent.\n`;
    await fs.writeFile(path.join(dir, "agent.md"), md);

    const res = await detectAgent(dir);
    expect(res).toBeDefined();
    expect(res.displayName).toBeDefined();
    expect(typeof res.displayName).toBe("string");
  });
});
