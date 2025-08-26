import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

export type EnvironmentInfo = {
  cwd: string;
  foundPackageJson: boolean;
  packageJson?: {
    name?: string;
    version?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    engines?: Record<string, string>;
    workspaces?: unknown;
  };
  packageManager?: "pnpm" | "npm" | "yarn" | "bun" | "unknown";
  monorepo?: boolean;
  framework?: string | null;
  language?: "typescript" | "javascript" | "mixed" | "unknown";
  hasVSCodeFolder: boolean;
  hasCopilotSettings: boolean;
  lockfiles: string[];
  hints: string[];
};

async function exists(file: string) {
  try {
    await fs.stat(file);
    return true;
  } catch {
    return false;
  }
}

function depsContain(pkgJson: any, names: string[]) {
  const deps = {
    ...(pkgJson?.dependencies || {}),
    ...(pkgJson?.devDependencies || {}),
  };
  return names.find((n) => Object.prototype.hasOwnProperty.call(deps, n));
}

export async function detectEnvironment(
  cwd = process.cwd()
): Promise<EnvironmentInfo> {
  const info: EnvironmentInfo = {
    cwd,
    foundPackageJson: false,
    packageJson: undefined,
    packageManager: "unknown",
    monorepo: false,
    framework: null,
    language: "unknown",
    hasVSCodeFolder: false,
    hasCopilotSettings: false,
    lockfiles: [],
    hints: [],
  };

  const packageJsonPath = path.join(cwd, "package.json");
  if (await exists(packageJsonPath)) {
    info.foundPackageJson = true;
    try {
      const raw = await fs.readFile(packageJsonPath, "utf8");
      const json = JSON.parse(raw);
      info.packageJson = {
        name: json.name,
        version: json.version,
        scripts: json.scripts,
        dependencies: json.dependencies,
        devDependencies: json.devDependencies,
        engines: json.engines,
        workspaces: json.workspaces,
      };
      if (json.workspaces) info.monorepo = true;
    } catch (err) {
      info.hints.push("failed-to-parse-package-json");
    }
  }

  // Lockfiles -> package manager
  const lockfileChecks: Array<[string, string]> = [
    ["pnpm-lock.yaml", "pnpm"],
    ["package-lock.json", "npm"],
    ["yarn.lock", "yarn"],
    ["bun.lockb", "bun"],
    ["bun.lock.json", "bun"],
  ];
  for (const [fname, pm] of lockfileChecks) {
    const p = path.join(cwd, fname);
    if (await exists(p)) {
      info.lockfiles.push(fname);
      info.packageManager = pm as EnvironmentInfo["packageManager"];
    }
  }

  // Monorepo signals
  const monorepoFiles = ["pnpm-workspace.yaml", "turbo.json", "lerna.json"];
  for (const f of monorepoFiles)
    if (await exists(path.join(cwd, f))) info.monorepo = true;

  // Framework detection - check package.json deps first, then files
  const pj = info.packageJson;
  const frameworkMap: Array<[string, string[]]> = [
    ["next", ["next"]],
    ["vite", ["vite"]],
    [
      "create-react-app",
      ["react-scripts", "react-scripts-start", "react-scripts build"],
    ],
    ["nestjs", ["@nestjs/core", "nestjs"]],
    ["sveltekit", ["@sveltejs/kit", "sveltekit"]],
    ["astro", ["astro"]],
    ["remix", ["@remix-run/*", "remix"]],
    ["node", ["express", "koa", "hapi"]],
  ];

  if (pj) {
    for (const [name, keys] of frameworkMap) {
      const hit = depsContain(pj, keys as string[]);
      if (hit) {
        info.framework = name;
        info.hints.push(`detected-by-deps:${name}`);
        break;
      }
    }
  }

  // File-based hints
  const fileFrameworkChecks: Array<[string, string]> = [
    ["next.config", "next"],
    ["vite.config", "vite"],
    ["svelte.config", "sveltekit"],
    ["astro.config", "astro"],
    ["remix.config", "remix"],
  ];
  for (const [base, name] of fileFrameworkChecks) {
    const patterns = [`${base}.js`, `${base}.cjs`, `${base}.mjs`, `${base}.ts`];
    for (const p of patterns) {
      if (await exists(path.join(cwd, p))) {
        info.framework = info.framework || name;
        info.hints.push(`detected-by-file:${p}`);
      }
    }
  }

  // Language detection
  if (
    (await exists(path.join(cwd, "tsconfig.json"))) ||
    (pj && depsContain(pj, ["typescript"]))
  ) {
    info.language = "typescript";
  } else if (info.packageJson) {
    info.language = "javascript";
  }

  // VS Code and Copilot checks
  const vscodeFolder = path.join(cwd, ".vscode");
  info.hasVSCodeFolder = await exists(vscodeFolder);
  if (info.hasVSCodeFolder) {
    const settings = path.join(vscodeFolder, "settings.json");
    const extensions = path.join(vscodeFolder, "extensions.json");
    if (await exists(settings)) {
      try {
        const txt = await fs.readFile(settings, "utf8");
        if (/copilot/i.test(txt) || /github.copilot/i.test(txt))
          info.hasCopilotSettings = true;
      } catch {}
    }
    if (!info.hasCopilotSettings && (await exists(extensions))) {
      try {
        const txt = await fs.readFile(extensions, "utf8");
        if (/copilot/i.test(txt) || /github.copilot/i.test(txt))
          info.hasCopilotSettings = true;
      } catch {}
    }
  }

  // Additional hints
  if (!info.packageManager) info.hints.push("unknown-package-manager");
  if (!info.framework) info.hints.push("unknown-framework");

  return info;
}

// If executed directly (CLI mode), print JSON to stdout for easy integration/tests.
// Use import.meta URL -> file path check so this works under ESM/tsx.
const _scriptPath = fileURLToPath(import.meta.url);
if (process.argv.includes(_scriptPath) || process.argv[1] === _scriptPath) {
  (async () => {
    const target = process.argv[2] || process.cwd();
    const res = await detectEnvironment(target);
    console.log(JSON.stringify(res, null, 2));
  })();
}
