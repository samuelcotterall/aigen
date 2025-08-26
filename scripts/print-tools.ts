import { renderTemplates } from "../src/templates";

async function main() {
  const cfg: any = {
    name: "snapshot-agent",
    displayName: "Snapshot Agent",
    preset: "openai",
    libraries: ["react"],
    tools: [{ name: "fetch", description: "HTTP" }],
    policies: { safetyLevel: "low" },
    style: { tsconfig: "strict", naming: "kebab", docs: "typedoc" },
    styleRules: [
      {
        id: "r1",
        label: "[sec] r1",
        description: "desc r1",
        doText: "do r1",
        dontText: "dont r1",
        appliesTo: ["react"],
      },
    ],
  };

  const out = await renderTemplates(cfg as any);
  console.log("--- tools.md ---");
  console.log(out["tools.md"]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
