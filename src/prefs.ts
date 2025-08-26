import Conf from "conf";
const conf = new Conf({ projectName: "agent-cli" });

/**
 * Load persisted user defaults for the CLI.
 *
 * Returns an object containing previously saved defaults (if any).
 */
export async function loadDefaults(): Promise<any> {
  return (conf.get("defaults") as any) ?? {};
}
/**
 * Save a partial defaults object, merging with existing saved defaults.
 *
 * @param d - partial defaults to persist
 */
export async function saveDefaults(d: any): Promise<void> {
  const cur = (conf.get("defaults") as any) ?? {};
  const merged = { ...cur, ...d };
  conf.set("defaults", merged);
}

/**
 * Load persisted rule feedback (mapping of ruleId -> enabled boolean).
 */
export async function loadRuleFeedback(): Promise<Record<string, boolean>> {
  return (conf.get("ruleFeedback") as any) ?? {};
}

/**
 * Save rule feedback mapping (ruleId -> enabled boolean).
 */
export async function saveRuleFeedback(feedback: Record<string, boolean>) {
  conf.set("ruleFeedback", feedback);
}
