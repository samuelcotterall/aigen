import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const DEFAULT_CONFIG_FILENAME = "aigen.config.json";

export type Preset = Record<string, any>;

export type PresetManifest = {
  schemaVersion: string;
  generatorVersion?: string;
  templateFingerprint?: string;
  templateVersion?: string;
  timestamp?: string;
  name?: string;
  displayName?: string;
  slug?: string;
  preset?: string;
  libraries?: string[];
  environments?: string[];
  tools?: any[];
  randomSeed?: string | number;
};

// imports consolidated above

// compute a fingerprint (sha1) of all files under the templates directory
export async function computeTemplatesFingerprint(templatesDir?: string) {
  const dir = path.resolve(
    templatesDir || path.join(process.cwd(), "templates")
  );
  async function walk(p: string, list: string[] = []) {
    try {
      const entries = await fs.readdir(p, { withFileTypes: true });
      for (const e of entries) {
        const fp = path.join(p, e.name);
        if (e.isDirectory()) await walk(fp, list);
        else list.push(fp);
      }
    } catch {}
    return list;
  }
  const files = await walk(dir, []);
  const hash = crypto.createHash("sha1");
  for (const f of files.sort()) {
    try {
      const content = await fs.readFile(f);
      hash.update(f.replace(dir, ""));
      hash.update("\0");
      hash.update(content);
      hash.update("\0");
    } catch {}
  }
  return hash.digest("hex");
}

export async function loadPreset(filePath?: string): Promise<Preset> {
  const p = path.resolve(
    filePath || path.join(process.cwd(), DEFAULT_CONFIG_FILENAME)
  );
  const raw = await fs.readFile(p, "utf8").catch(() => "");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export async function savePreset(filePath: string | undefined, preset: Preset) {
  const target = path.resolve(
    filePath || path.join(process.cwd(), DEFAULT_CONFIG_FILENAME)
  );
  await fs.writeFile(target, JSON.stringify(preset, null, 2) + "\n", "utf8");
  return target;
}
