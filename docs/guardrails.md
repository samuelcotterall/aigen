# Guardrails: Design & Implementation Plan

This document summarizes the guardrails feature, the data model, templates, CLI UX, validation, merge behavior, and the immediate implementation tasks completed here.

## Goals

- Generate human-readable and machine-readable guardrails alongside agent instructions.
- Provide three strictness levels: `minimal`, `standard`, `strict`.
- Ensure deterministic generation via seeded RNG and template fingerprinting.
- Allow preview (`--dry-run`) and safe merges with backups.
- Validate guardrails JSON before writing.

## Artifacts

- `policies.md` — human-facing explanation and examples.
- `guardrails.json` — machine-friendly JSON manifest with policies and checks.

## Data model (summary)

- `schemaVersion` (string)
- `level` ("minimal" | "standard" | "strict")
- `timestamp` (ISO string)
- `policies` (array of policy objects): each policy has `id`, `title`, `type`, `severity`, `description`, `checks`, `examples`.
- `metadata` with `source` and `templateFingerprint`.

## Templates

Templates are placed under `templates/guardrails/<level>/`:

- `policies.md.eta` — narrative markdown
- `guardrails.json.eta` — JSON manifest

Templates are rendered using the same Eta context as the rest of the generator and receive the project `cfg`, detected metadata, `guardrailLevel`, and deterministic helpers (rng, helpers).

## Validation

Guardrails JSON is validated with Zod before writing.

## CLI UX

- Flag: `--guardrail-level <minimal|standard|strict>` (default: `standard`).
- `--guardrails-only` to emit only guardrails.
- Preview with `--dry-run`.

## Merge & idempotency

- Guardrails are deterministic when using the same seed + templates.
- Re-running with the same preset should produce identical `guardrails.json` and `policies.md`.
- On merge, policy entries are deduplicated by `id` and updated if changed. Backups are created.

## Files added in this iteration

- `src/guardrails/schema.ts` — Zod schema + TypeScript types
- `src/guardrails/generate.ts` — simple generator that renders guardrails templates
- `templates/guardrails/standard/guardrails.json.eta`
- `templates/guardrails/standard/policies.md.eta`
- `test/guardrails.test.ts` — unit test validating generation + schema

## Next steps

- Add minimal + strict templates and more examples per policy.
- Wire CLI flags (`--guardrail-level`, `--guardrails-only`) into `src/index.ts` prompts and `renderTemplates` flow.
- Add integration/replay tests and merge logic for partial updates.
