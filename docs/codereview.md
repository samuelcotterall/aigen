## Codebase Review — aigen (2025-08-26)

This review focuses on maintainability, naming, file sizes, duplication, type safety, documentation, separation of concerns, and general clean code practices, with extra attention to the `docs/` content. It includes prioritized actions and concrete fixes.

### Executive summary

- Strengths

  - Clear project goal and good test coverage; replay/determinism and guardrails are thoughtfully designed.
  - Templating is isolated, seeded RNG is used for reproducibility, and Zod schemas validate core config.
  - Documentation breadth is high (quickstart, planning, requirements, style guide, guardrails).

- Top issues to address next
  1. Typecheck breaks on a missing type export from `src/tools/catalog.ts` (imported in `src/tool-list.ts`).
  2. Output listing logic duplicates path segments (e.g., `config/config/...`) in console summaries.
  3. Docs have content and formatting defects (duplicate sections, conflicting Do/Don’t, stale commands like `aigen create`).
  4. `src/index.ts` is very large and mixes prompting, rules, detection, writing, and reporting.
  5. Very large generated file `src/tools/catalog.ts` (>3k lines) impacts diffs and typecheck time; consider moving to JSON or lazy-loading.
  6. Node engines target 18 (now EOL); update to >=20 for security and ecosystem support.

---

## Priority fixes (short term)

1. Typecheck error: missing `ToolCatalogItem` export

- Symptom: `src/tool-list.ts` imports `ToolCatalogItem` from `./tools/catalog.js`, but only `TOOL_CATALOG` is exported.
- Impact: `pnpm exec tsc --noEmit` fails. Tests still pass (they don’t enforce typecheck), so this can slip.
- Recommended fix: derive the item type locally instead of importing a non-existent type: `type CatalogItem = (typeof TOOL_CATALOG)[number]` and annotate the map with `CatalogItem`.

2. Duplicate output paths in logs (cosmetic, but confusing)

- Symptom: `config/config/agent.json`, `guardrails/guardrails/...` and similar duplication in console output.
- Root cause: In `src/index.ts`, `listFiles()` returns paths already relative to the outDir. When recursing, the parent call then joins `p` with `s` again, doubling segments.
- Fix: When merging sub-results, append `...sub` directly, not `path.join(p, s)`. Alternatively, make `listFiles` accept a base param and always return paths relative to that base.

3. Docs: correctness and consistency

- Quickstart and README reference `aigen create`, but the CLI doesn’t define a `create` subcommand (root command runs the wizard). Update to `npx aigen` (root) or add an explicit `create` alias.
- `README.md` has duplicated “CLI flags” and malformed code fences; `README.docs.md` overlaps conceptually. Consolidate into a single canonical README and link to Docusaurus pages where applicable.
- Generated pages (e.g., `docs/agent-instructions.md`, `docs/styleguide-from-schema.md`) contain contradictory guidance such as “Do: prefer global variables” under “Disallowed Practices”. Tweak the generator to invert Do/Don’t for negated categories.
- Remove committed backups and `.bak` variants in `cliname/` (use `.gitignore`).

4. Node engine update

- Node 18 is EOL. Bump `package.json` engines to `">=20"` (or `">=22"`) and adjust CI matrix accordingly.

---

## Detailed findings

### Naming conventions

- Files and folders mostly follow kebab-case, which is good. However, sample/fixture directories include spaces or PascalCase (`My Agent/`, `DryRunAgent/`). If these are fixtures, add a note or move them under a dedicated `fixtures/` path to avoid confusion for contributors.
- `docs` recommends script prefix `ci:`. `package.json` uses `docs:*`, `tools:*`, etc. Either update the style doc to reflect reality, or adopt a consistent prefix scheme (e.g., `ci:*` for CI-only scripts, `docs:*` for doc tasks).

### File sizes and duplication

- `src/tools/catalog.ts` is a very large generated list (thousands of lines). Options:
  - Store it as a `.json` asset under `src/tools/catalog.json` and `import` (with `resolveJsonModule`) or load at runtime.
  - Split into multiple chunks (by ecosystem) and lazy-load by environment selection.
  - Add a brief README to explain regeneration and why it’s checked in (pros/cons) to set contributor expectations.
- Docs duplication: `README.md` and `README.docs.md` overlap. Consolidate and have a clear source of truth; point to `website/` for deep docs.

### Type safety

- Good: Zod schemas for `AgentConfig` and front-matter parsing; `deepMerge` is careful.
- Gaps:
  - `src/index.ts` uses `any` heavily (`opts: any`, many `any` casts). Extract types for CLI options, rule objects, and detection results.
  - ESM import extensions are inconsistent: most imports end with `.js`, but `src/templates.ts` imports from `"./cli/config"` without the extension. Standardize to `.js` for runtime ESM correctness.
  - `loadToolList` normalization returns partials; expose a narrow return type and normalize fully to avoid `undefined` checks downstream.
  - Consider enabling `exactOptionalPropertyTypes` in `tsconfig` to reduce accidental `undefined` propagation.

### Separation of concerns

- `src/index.ts` is carrying a lot: environment detection, rule selection, prompts (two libraries), recommendations, config export, plan rendering, and output writing confirmation.
- Refactor proposal:
  - `src/cli/options.ts` — type and parse CLI flags (Commander config + types).
  - `src/cli/prompts.ts` — interactive prompts and Enquirer/Clack adapters.
  - `src/cli/rules.ts` — rule loading, selection, and Do/Don’t text derivation.
  - `src/cli/tools.ts` — tool list loading, inference, and recommendation logic.
  - Keep `src/index.ts` as a thin command router.
  - This will reduce cognitive load and make tests more focused.

### Documentation (docs/)

- Strengths: Multiple perspectives (requirements, planning, guardrails), and generator scripts for style material.
- Issues and fixes:
  - “Conflicting or odd Do/Don’t” in `agent-instructions.md` and `styleguide-from-schema.md`. Update `schema-to-agent-instructions.mjs` to handle negative categories like `disallowedPractices` by defaulting to “Do: avoid … / Don’t: introduce …”. Also avoid repeating raw field names in the prose.
  - `styleguide.md` has dangling references (“ . ”) and generic advice likely copied with placeholder citations. Tighten to concrete, repo-specific rules and link to automated enforcement where applicable.
  - `quickstart.md` uses `aigen create`. Adjust to `npx aigen` unless you add a `create` command alias.
  - Add a small “Docs conventions” note: file naming, generated vs hand-written docs, and how to regenerate (`docs:gen-styleguide`, `docs:gen-agent-instructions`).
  - Remove backed-up `.bak` files and timestamped copies from version control.

### Build, scripts, and CI

- Update `engines.node` to `>=20` and adjust website tooling if needed.
- Add a `typecheck` script (alias to `tsc --noEmit`) and run it in CI before tests.
- Consider adding Biome or ESLint config and a `lint` script; docs and code reference Biome—adopt it or update docs.
- CI matrix: if dropping Node 18, update workflows accordingly.

### Templating and outputs

- Good: Front-matter (`---json ... ---`) with `outPath` and conditional `when` is clear.
- The output path duplication seen in logs is likely only a reporting issue; writing code uses a correct `rel` path (e.g., `config/agent.json`). Still, correct the list function to avoid confusion in demos and tests.
- Consider adding a “dry-run HTML report” writer for visual diffs (optional future nicety).

### Tests

- Coverage is solid (unit and integration). Add a small assertion to catch the duplicate path listing regression if you fix `listFiles()`.
- Add a quick test for `loadToolList()` type narrowing and remote cache TTL behavior (can be mocked).

---

## Concrete quick wins

- Fix typecheck error by deriving the catalog item type locally (done in this review branch).
- Standardize ESM import extension in `src/templates.ts` (use `.js`) to match other modules.
- Update docs where they diverge from the actual CLI (`aigen create` → `aigen`).
- Add `.gitignore` entries: `out/`, `dist/`, `tmp-*`, `tmp-replay-*`, `*.bak`, `*.tgz`, `website/node_modules`, `.DS_Store`.
- Bump Node engines to `>=20` in `package.json`.

---

## Proposed follow-ups (medium)

- Refactor `src/index.ts` into smaller modules; add types for CLI option shapes and rule/tool records.
- Rework `schema-to-agent-instructions.mjs` to avoid contradictory Do/Don’t lines, especially for `disallowedPractices`.
- Move `TOOL_CATALOG` to JSON or lazy-load by ecosystem; document regeneration workflow.
- Consider `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` for tighter TS safety.
- Add a “docs health” CI step: check for broken links, orphan pages, and ensure generated docs are up-to-date.

---

## Quality gates snapshot

- Build: tsup build ok (based on current scripts; not executed here).
- Typecheck: previously FAIL due to `ToolCatalogItem` import; addressed by deriving the type locally.
- Tests: pass locally (20 files, 36 tests) with minor cosmetic path duplication noted in logs only.

Requirements coverage

- Naming conventions: Reviewed; actionable alignment suggested.
- File sizes: Highlighted `catalog.ts`; options provided.
- Duplication: Identified in docs and logging; fixes proposed.
- Type safety: Identified gaps; immediate and medium fixes proposed.
- Documentation: Reviewed each doc file; prioritized corrections listed.
- Separation of concerns: Concrete refactor proposal provided.

---

If you want, I can open issues for each recommendation and submit small PRs to fix the typecheck, logging duplication, and doc corrections.
