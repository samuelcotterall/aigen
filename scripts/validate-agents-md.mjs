import { readFile } from "node:fs/promises";

export async function loadAgentsMd(file = "AGENTS.md") {
  const txt = await readFile(file, "utf8");
  const match = txt.match(/```json\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return null;
  }
}

export function validateMeta(meta) {
  if (!meta) return { ok: false, reason: "no meta block" };
  const required = [
    "setupCommands",
    "buildCommands",
    "typecheckCommands",
    "testCommands",
    "templatesPath",
  ];
  const missing = required.filter((k) => !meta[k]);
  if (missing.length) return { ok: false, reason: "missing fields", missing };
  return { ok: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const meta = await loadAgentsMd(process.argv[2] || "AGENTS.md");
    const res = validateMeta(meta);
    if (!res.ok) {
      console.error("AGENTS.md validation failed:", res);
      process.exit(2);
    }
    console.log("AGENTS.md OK");
  })();
}
