import { loadAgentsMd, validateMeta } from "../scripts/validate-agents-md.mjs";
import { test } from "vitest";

test("AGENTS.md has machine metadata block and required fields", async () => {
  const meta = await loadAgentsMd("AGENTS.md");
  const res = validateMeta(meta);
  if (!res.ok) {
    throw new Error("AGENTS.md validation failed: " + JSON.stringify(res));
  }
});
