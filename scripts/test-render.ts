import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { renderTemplates } from "../src/templates.js";

async function run() {
  const argPath = process.argv[2];
  let sampleCfg: any;
  if (argPath) {
    sampleCfg = JSON.parse(await fs.readFile(argPath, "utf8"));
  } else {
    const defaultCfgPath = path.join(process.cwd(), "config", "agent.json");
    try {
      await fs.stat(defaultCfgPath);
      sampleCfg = JSON.parse(await fs.readFile(defaultCfgPath, "utf8"));
      console.log("Loaded config from:", defaultCfgPath);
    } catch (err) {
      sampleCfg = {
        name: "test-agent",
        displayName: "Test Agent",
        preset: "openai",
        libraries: ["react", "zustand"],
        tools: [
          {
            name: "fetch",
            description: "HTTP fetch tool",
            input: { url: "string" },
          },
        ],
        policies: { safetyLevel: "medium", refusalPattern: "none" },
        style: { tsconfig: "strict", naming: "kebab-case", docs: "typedoc" },
        styleRules: [
          {
            id: "projectStructure.srcDir",
            label: "[projectStructure] srcDir",
            description: "Primary source directory (e.g. 'src')",
            appliesTo: ["typescript", "node"],
            doText: "Place source files under 'src/'.",
            dontText: "Put production TS code in the repo root.",
          },
          {
            id: "fileConventions.coLocateAssets",
            label: "[fileConventions] coLocateAssets",
            description:
              "Prefer co-locating small assets (CSS/images) with components",
            appliesTo: "react",
            doText: "Co-locate small assets with components where practical.",
            dontText: "Scatter assets across unrelated directories.",
          },
        ],
      } as any;
    }
  }

  const outputs = await renderTemplates(sampleCfg);

  const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "render-test-"));
  console.log("Writing rendered templates to:", outDir);
  for (const [p, content] of Object.entries(outputs)) {
    const target = path.join(outDir, p);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
    console.log("-", p);
  }

  console.log("\nPreview of agent.md:\n");
  const agent = outputs["agent.md"] || "";
  console.log(agent.split("\n").slice(0, 80).join("\n"));
  console.log("\nDone.");
  console.log("Output dir:", outDir);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
