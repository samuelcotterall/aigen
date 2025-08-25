import fs from "node:fs/promises";
import path from "node:path";
import { AgentConfig } from "./schema.js";
import { renderTemplates } from "./templates.js";

export async function writeOutputs(parentDir: string, cfg: AgentConfig) {
  const outDir = path.join(
    parentDir,
    cfg.name.replace(/\s+/g, "-").toLowerCase()
  );
  await fs.mkdir(outDir, { recursive: true });

  const files = await renderTemplates(cfg);
  await Promise.all(
    Object.entries(files).map(([rel, content]) =>
      fs
        .mkdir(path.dirname(path.join(outDir, rel)), { recursive: true })
        .then(() => fs.writeFile(path.join(outDir, rel), content, "utf8"))
    )
  );

  return outDir;
}
