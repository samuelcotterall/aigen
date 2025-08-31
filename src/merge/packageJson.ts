import { z } from "zod";

/**
 * Minimal (but permissive) package.json schema used for validation of
 * package.json input/output. We keep it `passthrough()` so unknown fields
 * are preserved, but main fields we merge are validated.
 */
export const PackageJsonSchema = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
    license: z.string().optional(),
    author: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
    scripts: z.record(z.string(), z.string()).optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    peerDependencies: z.record(z.string(), z.string()).optional(),
    optionalDependencies: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export type PackageJson = z.infer<typeof PackageJsonSchema>;

function diffOf(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined
) {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const all = new Set<string>([
    ...Object.keys(a || {}),
    ...Object.keys(b || {}),
  ]);
  for (const k of all) {
    const av = a ? a[k] : undefined;
    const bv = b ? b[k] : undefined;
    if (av === undefined && bv !== undefined) added.push(k);
    else if (av !== undefined && bv === undefined) removed.push(k);
    else if (JSON.stringify(av) !== JSON.stringify(bv)) changed.push(k);
  }
  return { added, removed, changed };
}

/**
 * Conservative package.json merge helper.
 * - Adds missing dependencies/devDependencies and scripts from incoming.
 * - Does not overwrite existing versions or scripts unless `force` is true.
 * - Returns merged object plus a diff describing added/changed/removed keys.
 */
export function mergePackageJsonConservative(
  existingRaw: unknown,
  incomingRaw: unknown,
  opts?: { force?: boolean }
) {
  const existing = PackageJsonSchema.parse(existingRaw || {});
  const incoming = PackageJsonSchema.parse(incomingRaw || {});

  const out: PackageJson = { ...existing } as PackageJson;

  const depTypes: Array<keyof PackageJson> = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ];

  const depDiff: Record<string, ReturnType<typeof diffOf>> = {};
  for (const t of depTypes) {
    const a = (existing[t] as Record<string, string> | undefined) || {};
    const b = (incoming[t] as Record<string, string> | undefined) || {};
    depDiff[t as string] = diffOf(a, b);

    // Work with a strongly-typed temporary object for this dependency map
    const mergedDeps: Record<string, string> = {
      ...((existing[t] as Record<string, string> | undefined) || {}),
    };
    for (const k of Object.keys(b)) {
      if (!(k in mergedDeps)) mergedDeps[k] = b[k];
      else if (opts?.force) mergedDeps[k] = b[k];
    }
    if (Object.keys(mergedDeps).length > 0) {
      (out as any)[t] = mergedDeps;
    } else {
      delete (out as any)[t];
    }
  }

  const existingScripts =
    (existing.scripts as Record<string, string> | undefined) || {};
  const incomingScripts =
    (incoming.scripts as Record<string, string> | undefined) || {};
  const scriptDiff = diffOf(existingScripts, incomingScripts);
  const mergedScripts: Record<string, string> = { ...existingScripts };
  for (const k of Object.keys(incomingScripts)) {
    if (!(k in mergedScripts)) mergedScripts[k] = incomingScripts[k];
    else if (opts?.force) mergedScripts[k] = incomingScripts[k];
  }
  if (Object.keys(mergedScripts).length > 0)
    (out as any).scripts = mergedScripts;
  else delete (out as any).scripts;

  for (const field of ["name", "version", "description", "license", "author"]) {
    if (!(field in out) && (incoming as any)[field])
      (out as any)[field] = (incoming as any)[field];
  }

  const changed =
    depTypes.some(
      (t) =>
        depDiff[t as string].added.length || depDiff[t as string].changed.length
    ) ||
    scriptDiff.added.length ||
    scriptDiff.changed.length;

  return {
    merged: out,
    diff: { deps: depDiff, scripts: scriptDiff },
    changed: Boolean(changed),
  } as const;
}

export default mergePackageJsonConservative;
