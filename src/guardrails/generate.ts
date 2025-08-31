import path from "node:path";
import { GuardrailsSchema, Guardrails } from "./schema";
import { renderTemplates } from "../templates";
import { computeTemplatesFingerprint } from "../cli/config";

export async function generateGuardrails(
  cfg: any,
  opts?: { level?: string; seed?: string | number }
) {
  const level = opts?.level || "standard";
  // render templates located under templates/guardrails/<level>
  const templatesDir = path.join(
    process.cwd(),
    "templates",
    "guardrails",
    level
  );
  const rendered = await renderTemplates(cfg, { seed: opts?.seed });
  // pick guardrails outputs (guardrails.json and policies.md)
  const guardJsonKey = Object.keys(rendered).find((k) =>
    k.endsWith("guardrails.json")
  );
  const policiesKey = Object.keys(rendered).find((k) =>
    k.endsWith("policies.md")
  );
  const result: any = {
    guardrailsJson: guardJsonKey ? rendered[guardJsonKey] : null,
    policiesMd: policiesKey ? rendered[policiesKey] : null,
    templateFingerprint: undefined as string | undefined,
  };
  try {
    result.templateFingerprint = await computeTemplatesFingerprint().catch(
      () => undefined
    );
  } catch {}

  // validate guardrails.json if present
  if (result.guardrailsJson) {
    try {
      const parsed =
        typeof result.guardrailsJson === "string"
          ? JSON.parse(result.guardrailsJson)
          : result.guardrailsJson;
      // attach metadata if missing
      if (!parsed.metadata) parsed.metadata = {};
      if (!parsed.metadata.templateFingerprint && result.templateFingerprint)
        parsed.metadata.templateFingerprint = result.templateFingerprint;
      const validated = GuardrailsSchema.parse(parsed) as Guardrails;
      result.guardrails = validated;
    } catch (e) {
      result.validationError = e;
    }
  }
  return result;
}
