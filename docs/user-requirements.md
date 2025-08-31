# Aigen — User Requirements & Implementation Plan

Date: 2025-08-26

This document captures the user-facing requirements and a concrete implementation plan for the Aigen CLI/generator. Keep this in the `docs/` folder so code and docs can refer to it.

## User-facing requirements

1. Executable via npx

   - CLI must be runnable with `npx <pkg>` (pack/publish-friendly `bin` entry and small wrapper).

2. Understand the user's environment

   - Detect existing agent artifacts (e.g. `config/agent.json`, `agent.md`, `tools.md`, `examples/`, `policies.md`).
   - Extract useful metadata (name, displayName, slug, tools, examples, policies).

3. Generate agent instructions and guardrails using that knowledge

   - Produce instruction pack files (agent.md, config/agent.json, policies.md, tools.md, examples/...) from templates.
   - Use detected metadata to prefill inputs.

4. Provide an interactive CLI walkthrough

   - `aigen create` interactive wizard (prefill from detection, ask minimal questions, preview, write/backup).
   - `aigen detect` to show the detected metadata.

5. Be configurable with JSON

   - Stable preset format `aigen.config.json` that records: schemaVersion, generatorVersion, createdAt, templateFingerprint, seed, inputs, and options.
   - Publish a JSON Schema `schema/aigen.config.json.schema` for editor integration.

6. Be updatable / idempotent

   - Re-runnable to make incremental changes.
   - Deterministic generation via seeded RNG so outputs are reproducible.
   - Template fingerprinting to detect drift and avoid accidental non-reproducible replays.
   - Merge strategies and backup behavior for safe incremental writes.

7. Be safe
   - `--dry-run` mode to preview outputs without writing.
   - Merge behavior creates timestamped backups and emits a merge summary.
   - Confirmation prompts; `--yes` to skip.
   - Default dev output under `./out` to avoid root clutter.

## Implementation plan (concrete)

High-level goal: add a small, publishable CLI surface that integrates detection, deterministic template rendering, safe write/merge, JSON presets, and both interactive and scripted flows.

### 1) npx support

- Add `bin/aigen` wrapper and `package.json` `bin` entry.
- Test locally with `npm link` or `npx ./aigen-<version>.tgz`.

### 2) Environment detection

- Centralize detection in `src/detectAgent.ts` with exported `detectAgent(root)` returning typed `DetectResult`.
- `aigen detect [dir]` prints a compact JSON/human summary.

### 3) Generator & guardrails

- Templates live in `templates/` and render through `src/templates.ts`.
- Use seeded RNG (`src/random.ts`) and deterministic helpers (`src/templates/helpers.ts`).
- Generate `policies.md` / `guardrails.json` and other instruction files from templates.

### 4) CLI walkthrough

- Commands:
  - `aigen create` (interactive)
  - `aigen detect` (inspection)
  - `aigen apply-config <file>` (replay)
  - `aigen export-config <file>` (save preset)
- Flags:
  - `--dry-run`, `--seed`, `--out`, `--yes`, `--update-config`, `--ignore-template-drift`.

### 5) JSON configuration

- Add `src/cli/config.ts` helpers for compute/load/save and fingerprinting.
- Provide JSON schema in `schema/` for editors.

### 6) Updatable & idempotent behavior

- Deterministic templates + seed => reproducible outputs.
- Compute `templateFingerprint` (SHA) and store in presets.
- On apply: if fingerprint mismatch => abort by default; support `--update-config` to refresh fingerprint interactively or via flag.
- Merge writes create backups and only change templated regions where possible.

### 7) Safety

- Keep `--dry-run` and `out` defaults.
- Backups and merge summaries.
- Unit and integration tests validate dry-run and idempotency.

## Schema & files to add / update

- `package.json` -> add `bin` entry
- `bin/aigen` -> executable wrapper
- `src/detectAgent.ts` -> detection API (typed)
- `src/index.ts` -> CLI wiring for detect/create/apply/export
- `src/cli/config.ts` -> preset load/save, fingerprint helpers
- `src/templates.ts`, `src/random.ts`, `src/templates/helpers.ts` -> template rendering (seeded)
- `src/write.ts` -> merge/write safety
- `schema/aigen.config.json.schema` -> JSON Schema for presets
- `docs/quickstart.md` -> user quickstart (separate)

## Tests

- Unit tests for `detectAgent()` and `config` helpers.
- Integration tests: replay/idempotency, dry-run safety, merge backups.
- CI job to run replay/idempotency test.

## Next actionable steps (you can pick one)

- A) Make CLI npx-ready (add `bin/aigen` and `package.json` changes).
- B) Add `aigen detect` command and pretty output.
- C) Add schema and preset validation.
- D) Implement `--update-config` flow (interactive + flag).
- E) Draft `docs/quickstart.md` with copy-paste commands.

---

Notes:

- Keep templates as text (avoid executing template-provided code).
- For publishing to npm (npx), package must be published or used via tarball; I can help prepare the package but will not publish.
