import { renderTemplates } from "../src/templates";
import { AgentConfigSchema } from "../src/schema";

async function main() {
  const cfg = AgentConfigSchema.parse({
    name: "Test Agent",
    displayName: "Test Agent",
    slug: "test-agent",
    preset: "openai",
    libraries: ["openai"],
    style: {
      tsconfig: "strict",
      naming: "camelCase",
      docs: "tsdoc",
      tests: "vitest",
      linter: "biome",
    },
    tools: [{ name: "vitest", description: "testing", input: {} }],
  } as any);

  const outputs = await renderTemplates(cfg as any);
  const mdFiles = Object.entries(outputs).filter(([p]) => p.endsWith(".md"));
  for (const [p, content] of mdFiles) {
    const fences = (content.match(/```/g) || []).length;
    if (fences % 2 !== 0) {
      console.log(`UNBALANCED: ${p} -> ${fences} fences`);
      console.log("---start---");
      console.log(content);
      console.log("---end---");
    } else {
      console.log(`${p} -> ${fences} fences`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
