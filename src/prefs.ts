import Conf from "conf";
const conf = new Conf({ projectName: "agent-cli" });

export async function loadDefaults() {
  return (conf.get("defaults") as any) ?? {};
}
export async function saveDefaults(d: any) {
  const cur = (conf.get("defaults") as any) ?? {};
  const merged = { ...cur, ...d };
  conf.set("defaults", merged);
}
