import { z } from "zod";

export const PolicyCheck = z.object({
  kind: z.string(),
  pattern: z.string().optional(),
  scope: z.string().optional(),
});

export const PolicySchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string().optional(),
  severity: z.enum(["info", "medium", "high"]).default("medium"),
  description: z.string().optional(),
  checks: z.array(PolicyCheck).optional(),
  examples: z.record(z.string(), z.string()).optional(),
});

export const GuardrailsSchema = z.object({
  schemaVersion: z.string().default("1.0"),
  level: z.enum(["minimal", "standard", "strict"]).default("standard"),
  timestamp: z.string().optional(),
  policies: z.array(PolicySchema).default([]),
  metadata: z
    .object({
      source: z.string().optional(),
      templateFingerprint: z.string().optional(),
    })
    .optional(),
});

export type Policy = z.infer<typeof PolicySchema>;
export type Guardrails = z.infer<typeof GuardrailsSchema>;
