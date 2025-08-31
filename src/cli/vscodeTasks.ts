import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// Simple Zod schemas for the few VS Code files we generate. Keep them permissive
// but typed so callers can rely on shapes.
export const VscodeSettingsSchema = z.record(z.string(), z.unknown());
export type VscodeSettings = z.infer<typeof VscodeSettingsSchema>;

export const VscodeExtensionsSchema = z.object({
  recommendations: z.array(z.string()).optional(),
  unwantedRecommendations: z.array(z.string()).optional(),
});
export type VscodeExtensions = z.infer<typeof VscodeExtensionsSchema>;

export const VscodeTaskSchema = z.object({
  version: z.string(),
  tasks: z.array(z.record(z.string(), z.unknown())),
});
export type VscodeTasks = z.infer<typeof VscodeTaskSchema>;

export type VscodeGeneratorOptions = {
  outDir?: string;
  force?: boolean;
  settings?: VscodeSettings;
  extensions?: VscodeExtensions;
  tasks?: VscodeTasks;
  readme?: string;
};

const defaultSettings: VscodeSettings = {
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.trimTrailingWhitespace": true,
  "typescript.tsc.autoDetect": "off",
  "extensions.ignoreRecommendations": false,
};

const defaultExtensions: VscodeExtensions = {
  recommendations: [
    "github.copilot",
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "pmneo.tsimporter",
  ],
};

const defaultTasks: VscodeTasks = {
  version: "2.0.0",
  tasks: [
    {
      label: "pnpm: test",
      type: "shell",
      command: "pnpm test",
      group: "test",
      problemMatcher: [],
    },
    {
      label: "pnpm: build",
      type: "shell",
      command: "pnpm build",
      group: "build",
      problemMatcher: [],
    },
    {
      label: "pnpm: dev",
      type: "shell",
      command: "pnpm dev",
      isBackground: true,
    },
  ],
};

const defaultReadme = `# VS Code workspace helpers

This folder contains lightweight recommended workspace settings, tasks and
extensions for working with this repository. Use the CLI command
\`aigen vscode-tasks\` to re-generate these files if needed.
`;

export async function generateVscodeConfigs(opts: VscodeGeneratorOptions = {}) {
  const target = path.resolve(opts.outDir || process.cwd());
  const dir = path.join(target, ".vscode");
  await fs.mkdir(dir, { recursive: true });

  const settings = VscodeSettingsSchema.parse({
    ...defaultSettings,
    ...(opts.settings || {}),
  });

  const extensions = VscodeExtensionsSchema.parse({
    ...defaultExtensions,
    ...(opts.extensions || {}),
  });

  const tasks = VscodeTaskSchema.parse({ ...(opts.tasks || defaultTasks) });

  const filesToWrite: Array<{ file: string; contents: string; mode?: number }> =
    [
      {
        file: path.join(dir, "settings.json"),
        contents: JSON.stringify(settings, null, 2) + "\n",
      },
      {
        file: path.join(dir, "extensions.json"),
        contents: JSON.stringify(extensions, null, 2) + "\n",
      },
      {
        file: path.join(dir, "tasks.json"),
        contents: JSON.stringify(tasks, null, 2) + "\n",
      },
      {
        file: path.join(dir, "README.md"),
        contents: (opts.readme || defaultReadme) + "\n",
      },
    ];

  const written: string[] = [];
  for (const f of filesToWrite) {
    try {
      const exists = await fs
        .stat(f.file)
        .then(() => true)
        .catch(() => false);
      if (exists && !opts.force) {
        throw new Error(`File exists: ${f.file}. Use --force to overwrite.`);
      }
      await fs.writeFile(f.file, f.contents, "utf8");
      written.push(path.relative(process.cwd(), f.file));
    } catch (e) {
      // bubble error unless force is false and file exists
      throw e;
    }
  }

  return { dir, written };
}

export default generateVscodeConfigs;
