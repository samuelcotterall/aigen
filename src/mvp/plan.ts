import path from "node:path";
import fs from "node:fs/promises";
import { renderTemplates } from "../templates";
import { detectAgent } from "../detectAgent";
import mergePkg, { PackageJson } from "../merge/packageJson";

function jsonDiff(oldObj: any, newObj: any) {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const allKeys = new Set<string>([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {}),
  ]);
  for (const k of allKeys) {
    const ov = oldObj ? oldObj[k] : undefined;
    const nv = newObj ? newObj[k] : undefined;
    if (ov === undefined && nv !== undefined) added.push(k);
    else if (ov !== undefined && nv === undefined) removed.push(k);
    else if (JSON.stringify(ov) !== JSON.stringify(nv)) changed.push(k);
  }
  return { added, removed, changed };
}

export async function planMvp(opts: {
  outDir?: string;
  seed?: string | number;
  pretty?: boolean;
}) {
  const root = process.cwd();
  const detected = await detectAgent(root).catch(() => ({}));

  const d = detected as any;
  const cfg: any = {
    name: d.name || "agent",
    displayName: d.displayName || "Agent",
    slug: d.slug || "agent",
  };
  // Render templates with seed
  const preview = await renderTemplates(cfg, { seed: opts.seed });

  // Determine target parent out
  let parentOut = root;
  if (opts.outDir) parentOut = path.resolve(opts.outDir);
  else {
    const outRoot = path.join(root, "out");
    await fs.mkdir(outRoot, { recursive: true }).catch(() => {});
    parentOut = path.join(outRoot, `create-agent-plan-${Date.now()}`);
  }
  const candidateDir = path.join(
    parentOut,
    (cfg.slug || cfg.name).toString().toLowerCase()
  );

  const files = Object.keys(preview).map((k) => k.replace(/\\/g, "/"));

  const wouldOverwrite: string[] = [];
  for (const f of files) {
    const abs = path.join(candidateDir, f);
    try {
      const st = await fs.stat(abs).catch(() => null);
      if (st && st.isFile()) wouldOverwrite.push(f);
    } catch {}
  }

  // Package manager detection
  const pm =
    (await fs
      .stat(path.join(root, "pnpm-lock.yaml"))
      .then(() => "pnpm")
      .catch(() => null)) ||
    (await fs
      .stat(path.join(root, "yarn.lock"))
      .then(() => "yarn")
      .catch(() => null)) ||
    (await fs
      .stat(path.join(root, "package-lock.json"))
      .then(() => "npm")
      .catch(() => null)) ||
    "npm";

  // Package.json diff if present in preview
  const pkgKey = files.find(
    (k) => k === "package.json" || k.endsWith("/package.json")
  );
  let pkgDiff: any = null;
  if (pkgKey) {
    try {
      const existingRaw = await fs
        .readFile(path.join(root, "package.json"), "utf8")
        .catch(() => "");
      let existingObj: unknown = {};
      try {
        existingObj = existingRaw ? JSON.parse(existingRaw) : {};
      } catch (_) {
        existingObj = {};
      }
      const incomingRaw = preview[pkgKey];
      let incomingObj: unknown = {};
      try {
        incomingObj = incomingRaw ? JSON.parse(incomingRaw) : {};
      } catch (_) {
        incomingObj = {};
      }
      const merged = mergePkg(existingObj, incomingObj, { force: false });
      pkgDiff = merged.diff || { deps: {}, scripts: {} };
    } catch (e) {
      pkgDiff = { error: String(e) };
    }
  }

  // Recommend install commands
  let installCmd = null;
  if (
    pkgDiff &&
    (pkgDiff.added.length || (pkgDiff.dev && pkgDiff.dev.added.length))
  ) {
    const adds = pkgDiff.added || [];
    const devAdds = (pkgDiff.dev && pkgDiff.dev.added) || [];
    if (pm === "pnpm")
      installCmd = `pnpm add ${adds.join(" ")} && pnpm add -D ${devAdds.join(
        " "
      )}`;
    else if (pm === "yarn")
      installCmd = `yarn add ${adds.join(" ")} && yarn add -D ${devAdds.join(
        " "
      )}`;
    else
      installCmd = `npm install ${adds.join(
        " "
      )} && npm install -D ${devAdds.join(" ")}`;
  } else if (pkgKey) {
    installCmd = `${pm} install  # no new dependencies detected or lockfile will handle installs`;
  }

  // Print plan
  console.log(`Plan preview for target: ${candidateDir}`);
  console.log(`Files to be created: ${files.length}`);
  for (const f of files.slice(0, 50)) console.log(` - ${f}`);
  if (files.length > 50) console.log(` ...and ${files.length - 50} more`);
  if (wouldOverwrite.length) {
    console.log(
      `\nFiles that would be overwritten (${wouldOverwrite.length}):`
    );
    for (const f of wouldOverwrite.slice(0, 50)) console.log(` * ${f}`);
  }
  if (pkgDiff) {
    console.log("\npackage.json dependency changes:");
    console.log(`  deps added: ${pkgDiff.added.join(", ")}`);
    console.log(`  deps removed: ${pkgDiff.removed.join(", ")}`);
    console.log(`  deps changed: ${pkgDiff.changed.join(", ")}`);
    console.log(
      `  dev deps added: ${((pkgDiff.dev && pkgDiff.dev.added) || []).join(
        ", "
      )}`
    );
  }
  if (installCmd) console.log(`\nRecommended install command: ${installCmd}`);
  console.log(
    "\nThis is a non-destructive preview (dry-run). No files were written."
  );
}

export default planMvp;
