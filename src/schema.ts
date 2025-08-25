import { z } from "zod";

export const ToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  input: z.record(z.string(), z.any()).describe("JSON schema-like shape"),
  output: z.record(z.string(), z.any()).optional(),
  examples: z
    .array(
      z.object({
        call: z.record(z.string(), z.any()),
        result: z.record(z.string(), z.any()).optional(),
      })
    )
    .default([]),
});

export const AgentConfigSchema = z.object({
  name: z.string(),
  // user-facing display name (optional; kept for compatibility with `name`)
  displayName: z.string().optional(),
  // filesystem-safe slug for output directories
  slug: z.string().optional(),
  preset: z
    .enum([
      "openai",
      "langchain",
      "llamaindex",
      "autogen",
      "mcp",
      "vscode",
      "custom",
    ])
    .optional(),
  style: z.object({
    tsconfig: z.enum(["strict", "balanced", "loose"]).default("strict"),
    naming: z.enum(["camelCase", "snake_case"]).default("camelCase"),
    docs: z.enum(["tsdoc", "jsdoc", "none"]).default("tsdoc"),
    tests: z.enum(["vitest", "none"]).default("vitest"),
    linter: z.enum(["biome", "eslint", "none"]).default("biome"),
  }),
  structure: z
    .object({
      layout: z.enum(["single", "monorepo"]).default("single"),
      folders: z
        .array(z.string())
        .default(["src", "tools", "prompts", "config"]),
    })
    .optional(),
  libraries: z
    .array(z.enum(["langchain", "openai", "autogen", "llamaindex", "none"]))
    .default([]),
  tools: z.array(ToolSchema).default([]),
  policies: z
    .object({
      safetyLevel: z
        .enum(["minimal", "standard", "strict"])
        .default("standard"),
      privacyNotes: z.string().optional(),
      refusalPattern: z
        .string()
        .default("Explain why and suggest safe alternatives."),
    })
    .default(() => ({} as any)),
  outputs: z
    .array(z.enum(["markdown", "json", "yaml"]))
    .default(["markdown", "json"]),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
