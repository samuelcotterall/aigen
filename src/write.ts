import fs from "node:fs/promises";
import path from "node:path";
import { AgentConfig } from "./schema.js";
import { renderTemplates } from "./templates.js";
import mergePkg, { PackageJson } from "./merge/packageJson.js";
import crypto from "node:crypto";

/**
 * Return true when the value is a plain object (not null and not an array).
 *
 * @param v - value to test
 */
export function isObject(v: any) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Deep-merge two values. Works for objects and arrays with some heuristics:
 * - Arrays of objects with a `name` property are merged by name.
 * - Primitive arrays are deduplicated.
 * - Objects are merged recursively, preferring values from `a` when scalar.
 *
 * This is used to merge incoming generated config/docs with existing files
 * when the CLI is asked to `merge` instead of overwrite.
 *
 * @param a - base value (preferred when scalars conflict)
 * @param b - incoming value to merge into `a`
 */
export function deepMerge(a: any, b: any) {
  // merge b into a, prefer existing values in a when conflict for scalars,
  // but merge objects and dedupe arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    // If array items are objects with `name`, merge by name
    const allObjects = a
      .concat(b)
      .every((it) => isObject(it) && typeof it.name === "string");
    if (allObjects) {
      const map: Record<string, any> = {};
      for (const item of a) map[item.name] = deepMerge(item, {});
      for (const item of b) {
        if (map[item.name]) map[item.name] = deepMerge(map[item.name], item);
        else map[item.name] = deepMerge(item, {});
      }
      return Object.values(map);
    }
    // fallback: dedupe primitives
    const set = new Set(a.concat(b));
    return Array.from(set);
  }
  if (isObject(a) && isObject(b)) {
    const out: any = { ...a };
    for (const k of Object.keys(b)) {
      if (!(k in out)) out[k] = b[k];
      else out[k] = deepMerge(out[k], b[k]);
    }
    return out;
  }
  // default: prefer existing (a)
  return a === undefined ? b : a;
}

// Merge markdown using an AST-based approach (remark/unified). This function
// is async and dynamically imports remark/unified to avoid static type
// dependencies at build time.
/**
 * Merge two markdown documents by section headings using remark/unist.
 *
 * The function will attempt to dedupe lines within matching sections and
 * insert a small HTML comment marker with metadata when new nodes are
 * appended. The function dynamically imports remark/unified to avoid a
 * hard dependency unless this feature is used.
 *
 * @param existing - current markdown content
 * @param incoming - new markdown content to merge
 * @param options - optional runId or seed used to create merge markers
 * @returns merged markdown content
 */
export async function mergeMarkdownSections(
  existing: string,
  incoming: string,
  options?: { runId?: string; seed?: string | number }
): Promise<string> {
  // quick path
  if ((existing || "").includes((incoming || "").trim())) return existing;

  // determine deterministic run id: prefer explicit, then CI env vars, then seed-derived, else random
  let runId =
    options?.runId ??
    process.env.CI_RUN_ID ??
    process.env.CI_JOB_ID ??
    process.env.GITHUB_RUN_ID;
  if (!runId && options?.seed !== undefined) {
    try {
      runId = crypto
        .createHash("sha1")
        .update(String(options.seed))
        .digest("hex")
        .slice(0, 8);
    } catch {
      runId = String(options.seed).slice(0, 8);
    }
  }
  if (!runId) runId = Math.random().toString(16).slice(2, 8);

  const modUnified = (await import("unified")) as any;
  const modParse = (await import("remark-parse")) as any;
  const modStringify = (await import("remark-stringify")) as any;
  const modToString = (await import("mdast-util-to-string")) as any;

  const unified = (modUnified &&
    (modUnified.unified ?? modUnified.default ?? modUnified)) as any;
  const remarkParse = (modParse && (modParse.default ?? modParse)) as any;
  const remarkStringify = (modStringify &&
    (modStringify.default ?? modStringify)) as any;
  const mdToString = (modToString &&
    (modToString.default ?? modToString)) as any;

  const u = unified().use(remarkParse);
  const existingTree: any = u.parse(existing || "");
  const incomingTree: any = u.parse(incoming || "");

  // split into sections: a section is { headerNode | null, nodes[] }
  function sectionsFrom(tree: any) {
    const secs: Array<any> = [];
    let current: any = { header: null, nodes: [] };
    for (const node of tree.children || []) {
      if (node.type === "heading") {
        // start a new section
        if (current.header !== null || current.nodes.length) secs.push(current);
        current = { header: node, nodes: [] };
      } else {
        current.nodes.push(node);
      }
    }
    if (current.header !== null || current.nodes.length) secs.push(current);
    return secs;
  }

  const eSecs = sectionsFrom(existingTree);
  const iSecs = sectionsFrom(incomingTree);

  const keyOf = (h: any) => {
    if (!h) return "__intro__";
    return `${h.depth}::${mdToString(h)}`;
  };

  const eMap = new Map<string, number>();
  eSecs.forEach((s: any, i: number) => eMap.set(keyOf(s.header), i));

  const outSecs = eSecs.map((s: any) => ({
    header: s.header,
    nodes: s.nodes.slice(),
  }));

  for (const isec of iSecs) {
    const key = keyOf(isec.header);
    if (eMap.has(key)) {
      const idx = eMap.get(key)!;
      const dest = outSecs[idx];
      // for each incoming node, attempt to dedupe by string content
      for (const inode of isec.nodes) {
        const inodeText = mdToString(inode).trim();
        const exists = dest.nodes.some(
          (n: any) => mdToString(n).trim() === inodeText
        );
        if (!exists) {
          // insert a metadata marker before the incoming node
          const ts = new Date().toISOString();
          const user = process.env.USER || "unknown";
          const marker = `<!-- merged-by-create-agent ts=${ts} user=${user} run=${runId} -->`;
          dest.nodes.push({ type: "html", value: marker });
          dest.nodes.push(inode);
        }
      }
    } else {
      // append new section
      outSecs.push({ header: isec.header, nodes: isec.nodes.slice() });
    }
  }

  // rebuild children
  const outChildren: any[] = [];
  for (const s of outSecs) {
    if (s.header) outChildren.push(s.header);
    for (const n of s.nodes) outChildren.push(n);
  }

  const root = { type: "root", children: outChildren };
  const md = unified().use(remarkStringify).stringify(root);
  return md;
}

/**
 * Render templates and write output files for an AgentConfig.
 *
 * The function will create the target directory if necessary, write files
 * produced by `renderTemplates`, and when `opts.skipIfExists` or
 * `opts.astMerge` are provided, perform merging behavior for JSON and
 * markdown files so user content is preserved.
 *
 * @param parentDir - parent directory where the agent folder will be created
 * @param cfg - parsed AgentConfig
 * @param opts - optional behavior modifiers (skipIfExists, astMerge, runId, seed)
 * @returns the created/used output directory path
 */
export async function writeOutputs(
  parentDir: string,
  cfg: AgentConfig,
  opts?: {
    skipIfExists?: boolean;
    allowOverwrite?: boolean;
    backupOnOverwrite?: boolean;
    astMerge?: boolean;
    runId?: string;
    seed?: string | number;
    // new options
    force?: boolean; // non-interactive override to apply package.json overwrites
    interactive?: boolean; // when true, prompt for per-change approval
  }
) {
  const dirName = (cfg.slug || cfg.name)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_.]/g, "")
    .toLowerCase();
  const outDir = path.join(parentDir, dirName || `agent-${Date.now()}`);
  // If outDir exists and is non-empty, throw so caller can confirm overwrite
  // unless caller explicitly requested to skip writing existing files.
  try {
    const stat = await fs.stat(outDir);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(outDir);
      // If directory exists and is non-empty, only proceed when either
      // skipIfExists is true (merge) or allowOverwrite is true (explicit overwrite).
      if (entries.length > 0 && !opts?.skipIfExists && !opts?.allowOverwrite) {
        throw new Error(`Target directory ${outDir} exists and is not empty`);
      }
    }
  } catch (e) {
    if ((e as any).code === "ENOENT") {
      // doesn't exist, we'll create it
    } else {
      throw e;
    }
  }
  await fs.mkdir(outDir, { recursive: true });

  const files = await renderTemplates(cfg, {
    emitAgents: !!(opts as any)?.emitAgents,
    seed: (opts as any)?.seed,
  });
  const mergedFiles: string[] = [];
  const backupFiles: string[] = [];
  await Promise.all(
    Object.entries(files).map(([rel, content]) =>
      fs
        .mkdir(path.dirname(path.join(outDir, rel)), { recursive: true })
        .then(async () => {
          const target = path.join(outDir, rel);
          // If overwriting and backupOnOverwrite is requested, create backups
          if (opts?.allowOverwrite && opts?.backupOnOverwrite) {
            try {
              await fs.stat(target);
              const ts = new Date().toISOString().replace(/[:.]/g, "-");
              const bak = `${target}.${ts}.bak`;
              await fs.copyFile(target, bak);
              backupFiles.push(bak);
              try {
                await fs.copyFile(target, `${target}.bak`);
                backupFiles.push(`${target}.bak`);
              } catch {}
            } catch {}
          }

          if (opts?.skipIfExists) {
            try {
              await fs.stat(target);
              // file exists: apply merge logic for known files
              // create timestamped backup before any merging (also keep .bak for compatibility)
              try {
                const ts = new Date().toISOString().replace(/[:.]/g, "-");
                const bak = `${target}.${ts}.bak`;
                await fs.copyFile(target, bak);
                backupFiles.push(bak);
                // also write a stable .bak for compatibility
                try {
                  await fs.copyFile(target, `${target}.bak`);
                  backupFiles.push(`${target}.bak`);
                } catch {}
              } catch {}

              if (
                rel.replace(/\\\\/g, "/").startsWith("config/") &&
                rel.endsWith(".json")
              ) {
                // merge any JSON under config/
                // merge JSON
                try {
                  const existingRaw = await fs.readFile(target, "utf8");
                  const existing = JSON.parse(existingRaw || "{}") as Record<
                    string,
                    unknown
                  >;
                  const incoming = JSON.parse(content || "{}") as Record<
                    string,
                    unknown
                  >;
                  const merged = deepMerge(existing, incoming);
                  await fs.writeFile(
                    target,
                    JSON.stringify(merged, null, 2),
                    "utf8"
                  );
                } catch (e) {
                  // if parsing fails, skip to avoid clobbering user file
                  return;
                }
                return;
              }
              // handle package.json conservatively when present at repo root
              if (rel === "package.json" || rel.endsWith("/package.json")) {
                try {
                  const existingRaw = await fs.readFile(target, "utf8");
                  let existingObj: unknown = {};
                  try {
                    existingObj = existingRaw ? JSON.parse(existingRaw) : {};
                  } catch (_) {
                    return; // skip if JSON invalid
                  }
                  let incomingObj: unknown = {};
                  try {
                    incomingObj = content ? JSON.parse(content) : {};
                  } catch (_) {
                    return;
                  }

                  const res = mergePkg(existingObj, incomingObj, {
                    force: !!opts?.force,
                  });

                  // If interactive and not forced, prompt per-change
                  let finalMerged = res.merged as PackageJson;
                  if (opts && opts.interactive && !opts.force) {
                    try {
                      const mod = (await import(
                        "@clack/prompts"
                      )) as unknown as {
                        confirm: (opts: {
                          message: string;
                          initialValue?: boolean;
                        }) => Promise<boolean>;
                        isCancel: (v: unknown) => boolean;
                      };
                      const { confirm, isCancel } = mod;

                      // handle deps per type
                      const depTypes = Object.keys(res.diff?.deps || {});
                      for (const t of depTypes) {
                        const added = res.diff.deps[t].added || [];
                        const changed = res.diff.deps[t].changed || [];
                        for (const name of added) {
                          const ver = (incomingObj as any)?.[t]?.[name];
                          const ok = await confirm({
                            message: `Add ${t} ${name}@${ver}?`,
                            initialValue: true,
                          });
                          if (isCancel(ok) || !ok) {
                            const map = (
                              finalMerged as Record<string, unknown>
                            )[t] as Record<string, string> | undefined;
                            if (map && name in map) delete map[name];
                          } else {
                            (finalMerged as Record<string, unknown>)[t] =
                              (finalMerged as Record<string, unknown>)[t] || {};
                            (
                              (finalMerged as Record<string, unknown>)[
                                t
                              ] as Record<string, string>
                            )[name] = (incomingObj as any)[t][name];
                          }
                        }
                        for (const name of changed) {
                          const from = (existingObj as any)?.[t]?.[name];
                          const to = (incomingObj as any)?.[t]?.[name];
                          const ok = await confirm({
                            message: `Update ${t} ${name} from ${from} -> ${to}?`,
                            initialValue: false,
                          });
                          if (isCancel(ok) || !ok) {
                            const map = (
                              finalMerged as Record<string, unknown>
                            )[t] as Record<string, string> | undefined;
                            if (
                              map &&
                              (existingObj as any)[t] &&
                              name in (existingObj as any)[t]
                            )
                              map[name] = (existingObj as any)[t][name];
                          } else {
                            (finalMerged as Record<string, unknown>)[t] =
                              (finalMerged as Record<string, unknown>)[t] || {};
                            (
                              (finalMerged as Record<string, unknown>)[
                                t
                              ] as Record<string, string>
                            )[name] = to;
                          }
                        }
                      }

                      // scripts
                      const addedScripts = res.diff?.scripts?.added || [];
                      const changedScripts = res.diff?.scripts?.changed || [];
                      for (const s of addedScripts) {
                        const cmd = (incomingObj as any)?.scripts?.[s];
                        const ok = await confirm({
                          message: `Add script '${s}': ${cmd}?`,
                          initialValue: true,
                        });
                        if (isCancel(ok) || !ok) {
                          const scripts = (
                            finalMerged as Record<string, unknown>
                          ).scripts as Record<string, string> | undefined;
                          if (scripts) delete scripts[s];
                        } else {
                          (finalMerged as Record<string, unknown>).scripts =
                            (finalMerged as Record<string, unknown>).scripts ||
                            {};
                          (
                            (finalMerged as Record<string, unknown>)
                              .scripts as Record<string, string>
                          )[s] = cmd;
                        }
                      }
                      for (const s of changedScripts) {
                        const from = (existingObj as any)?.scripts?.[s];
                        const to = (incomingObj as any)?.scripts?.[s];
                        const ok = await confirm({
                          message: `Update script '${s}' from '${from}' -> '${to}'?`,
                          initialValue: false,
                        });
                        if (isCancel(ok) || !ok) {
                          const scripts = (
                            finalMerged as Record<string, unknown>
                          ).scripts as Record<string, string> | undefined;
                          if (
                            scripts &&
                            (existingObj as any).scripts &&
                            s in (existingObj as any).scripts
                          )
                            scripts[s] = (existingObj as any).scripts[s];
                        } else {
                          (finalMerged as Record<string, unknown>).scripts =
                            (finalMerged as Record<string, unknown>).scripts ||
                            {};
                          (
                            (finalMerged as Record<string, unknown>)
                              .scripts as Record<string, string>
                          )[s] = to;
                        }
                      }
                    } catch (e) {
                      // if prompting fails, fallback to conservative merge (no overwrites)
                      finalMerged = res.merged as PackageJson;
                    }
                  }

                  // Write file if something changed compared to existing
                  if (
                    JSON.stringify(finalMerged) !== JSON.stringify(existingObj)
                  ) {
                    await fs.writeFile(
                      target,
                      JSON.stringify(finalMerged, null, 2),
                      "utf8"
                    );
                    mergedFiles.push(target);
                  }
                } catch (e) {
                  return;
                }
                return;
              }
              if (rel.endsWith("policies.md")) {
                // policies.md: prefer AST merge when requested, otherwise append-only
                try {
                  const existingRaw = await fs.readFile(target, "utf8");
                  if (opts?.astMerge) {
                    try {
                      const merged = await mergeMarkdownSections(
                        existingRaw,
                        content,
                        { runId: opts?.runId, seed: opts?.seed }
                      );
                      await fs.writeFile(target, merged, "utf8");
                      mergedFiles.push(target);
                    } catch (e) {
                      // fallback to append if AST merge fails
                      const appended =
                        existingRaw +
                        "\n\n<!-- merged-policies-by-aigen -->\n" +
                        content;
                      await fs.writeFile(target, appended, "utf8");
                    }
                  } else if (!existingRaw.includes(content.trim())) {
                    const appended =
                      existingRaw +
                      "\n\n<!-- merged-policies-by-aigen -->\n" +
                      content;
                    await fs.writeFile(target, appended, "utf8");
                    mergedFiles.push(target);
                  }
                } catch (e) {
                  return;
                }
                return;
              }
              if (rel.endsWith(".md")) {
                // default markdown behavior: AST merge optional, else append
                try {
                  const existingRaw = await fs.readFile(target, "utf8");
                  if (opts?.astMerge) {
                    try {
                      const merged = await mergeMarkdownSections(
                        existingRaw,
                        content,
                        { runId: opts?.runId, seed: opts?.seed }
                      );
                      await fs.writeFile(target, merged, "utf8");
                      mergedFiles.push(target);
                    } catch (e) {
                      const appended =
                        existingRaw + "\n\n<!-- added-by-aigen -->\n" + content;
                      await fs.writeFile(target, appended, "utf8");
                      mergedFiles.push(target);
                    }
                  } else if (!existingRaw.includes(content.trim())) {
                    const appended =
                      existingRaw + "\n\n<!-- added-by-aigen -->\n" + content;
                    await fs.writeFile(target, appended, "utf8");
                    mergedFiles.push(target);
                  }
                } catch (e) {
                  return;
                }
                return;
              }
              // other files: skip
              return;
            } catch (e) {
              if ((e as any).code !== "ENOENT") throw e;
              // doesn't exist: continue to write
            }
          }
          await fs.writeFile(target, content, "utf8");
        })
    )
  );

  // summary log
  try {
    if (mergedFiles.length || backupFiles.length) {
      console.log(
        `Merge summary: ${mergedFiles.length} files merged, ${backupFiles.length} backups created.`
      );
      if (mergedFiles.length) console.log("Merged:", mergedFiles.join(", "));
      if (backupFiles.length) console.log("Backups:", backupFiles.join(", "));
    }
  } catch {}

  return outDir;
}
