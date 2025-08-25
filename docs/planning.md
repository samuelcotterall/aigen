# Build Plan — `create-agent-instructions`

> Objective: Ship an `npx`-runnable, TypeScript-based interactive CLI that generates an "agent instruction pack" (Markdown + JSON + examples) from user-selected libraries, structures, and conventions. Plan is deterministic, testable, and leaves no ambiguity.

---

## 0) Ground Rules

- **Node versions supported:** 18.x, 20.x, 22.x (LTS).
  **Verification:** `node -v` prints one of v18._, v20._, v22.\*
- **Package manager:** `npm`.
- **Repo layout (root):**
  - `package.json`, `tsconfig.json`, `src/`, `templates/`, `docs/`, `.github/workflows/ci.yml`, `.gitignore`
- **TypeScript:** ESM (`"type": "module"`).
- **Binary entry:** `bin` → `dist/index.js` with shebang `#!/usr/bin/env node`.
- **Templating engine:** Eta `.eta` files with optional JSON front matter (`---json … ---`).
- **Formatting/lint:** Biome (optional in v1); pretty outputs enforced by tests.
- **Versioning:** SemVer. Initial: `0.2.0`.
- **Branching:** `main` only (fast-follow; feature branches allowed but not mandated). PR checks required before release.

**Definition of Done (DoD) overall:**

- `npx create-agent-instructions@file:.` produces a folder `{kebab-agent-name}/` with at least: `agent.md`, `tools.md`, `policies.md`, `config/agent.json`.
- Choosing OpenAI library also generates `examples/openai.ts`.
- CLI exits `0` and shows `Done. Generated instruction pack for <name>.`
- CI passes on Node 18/20/22.

---

## 1) Initialize Repository

**Tasks**

1. Create repo root with files:
   - `package.json` (as provided in the scaffold; `name`, `version`, `type`, `bin`, `scripts`, deps/devDeps set)
   - `tsconfig.json` (TS strict, moduleResolution `bundler`, target `ES2022`)
   - `.gitignore` (node, dist, .DS_Store)
   - `docs/requirements.md` (already added)
   - `docs/planning.md` (this file)
2. Install deps: `npm i`.

**Verification**

- Run `npm pkg get name` → `"create-agent-instructions"`.
- Run `npm ls` completes without errors.

---

## 2) Source Code Baseline

**Files**

- `src/index.ts` — CLI entry (Commander + @clack/prompts)
- `src/schema.ts` — Zod schemas (`AgentConfigSchema`, `ToolSchema`)
- `src/templates.ts` — file-based template renderer with front matter support
- `src/write.ts` — writes rendered outputs into `{cwd}/{agent-name-kebab}/...`
- `src/prefs.ts` — persist user defaults via `conf`

**Acceptance Criteria**

- All files compile with `tsx src/index.ts` (dev run) and bundle via `tsup`.
- `src/index.ts` prints intro and supports preset/libraries/TS strict prompts.

**Commands**

```bash
npm run dev # tsx src/index.ts, verify interactive flow
npm run build # tsup creates dist/index.js (+ .d.ts)
```

**Verification**

- `node dist/index.js` shows the interactive prompts.

---

## 3) Templates Directory (Structured)

**Layout**

```
templates/
  common/
    agent.md.eta
    tools.md.eta
    policies.md.eta
    config/agent.json.eta
  openai/
    examples/openai.ts.eta
```

**Rules**

- Any `.eta` file may start with JSON front matter delimited by `---json` and `---` lines.
- `outPath` in front matter overrides output path; otherwise mirror `templates/` structure with `.eta` stripped.
- `when` filter supports fields: `preset: string`, `libraries: string[]` (matches if any is present in cfg).

**Acceptance Criteria**

- Rendering with `libraries: ["openai"]` includes `examples/openai.ts`; without it, it does not.
- `agent.json` contains the exact config passed to the renderer (deep-equal).

**Verification**

```bash
# Dry-run render (temporary script):
node -e "import('./dist/index.js');" # then choose a name and options
# Inspect generated folder
ls <agent-name-kebab>/
```

---

## 4) Interactive Flow (MVP)

**Prompts**

1. `preset`: one of `openai|langchain|llamaindex|autogen|mcp|custom`
2. `libraries`: multiselect any of `openai|langchain|llamaindex|autogen`
3. `tsStrict`: `strict|balanced|loose`
4. `name`: default `MyAgent`
5. `toolsRaw`: comma-separated list (optional)

**Config Build**

- Parse with Zod; map tools to `{ name, description: "<name> tool", input: {} }`.

**Acceptance Criteria**

- Cancel on any prompt cleanly exits without stack trace.
- Valid inputs produce `AgentConfig` object and write outputs.

**Verification**

- Run through twice; second run should prefill defaults from `conf`.

---

## 5) Preferences (User Defaults)

**Behavior**

- Store `name`, `preset`, `libraries`, `tsconfig` under project `agent-cli` using `conf`.
- On start, load and use as initial values.

**Acceptance Criteria**

- After first successful run, a second run shows previous choices as defaults.

**Verification**

```bash
node -e "const Conf=require('conf');const c=new Conf({projectName:'agent-cli'});console.log(c.get('defaults'));"
```

---

## 6) Output Writing & Idempotence

**Rules**

- Output directory name = kebab-case of `cfg.name`.
- Create directories recursively; overwrite existing files without prompting (MVP).
- Ensure newline at EOF for all files.

**Acceptance Criteria**

- Re-running with same name overwrites files; no duplicate directories; no crash on existing paths.

**Verification**

```bash
rm -rf myagent && node dist/index.js # generate
HASH1=$(find myagent -type f -exec shasum {} + | shasum)
node dist/index.js # same inputs
HASH2=$(find myagent -type f -exec shasum {} + | shasum)
[ "$HASH1" = "$HASH2" ] && echo OK
```

---

## 7) Formatting (Optional v1, Nice-to-have)

**Plan**

- Add Biome devDependency and a small post-render formatter in `write.ts` (guarded behind try/catch). Format `*.ts`, `*.md`, `*.json`.

**Acceptance Criteria**

- If Biome present, output files are formatted; if not, rendering still succeeds.

**Verification**

```bash
npm i -D @biomejs/biome
npx biome check <agent-name-kebab> --write
```

---

## 8) Tests (Vitest)

**Scope**

- `schema.test.ts`: validates sample configs and rejects invalid enums.
- `templates.test.ts`: renders with/without `openai` and asserts file set.
- `e2e.test.ts`: spawns CLI with mocked stdin to choose defaults and verifies output directory contents.

**Acceptance Criteria**

- `npm test` passes all tests on Node 18/20/22.

**Commands**

```bash
npm run build
npx vitest run
```

---

## 9) CI (GitHub Actions)

**Workflow:** `.github/workflows/ci.yml`

- Matrix: node `18.x`, `20.x`, `22.x` on `ubuntu-latest`.
- Steps: checkout → setup-node → `npm ci` → `npm run build` → `npx vitest run`.

**Acceptance Criteria**

- All matrix jobs green on PR to `main` and on push to `main`.

---

## 10) Packaging & Local `npx`

**Tasks**

- Ensure `dist/index.js` has shebang.
- Add `prepublishOnly`: `tsup src/index.ts --format esm,cjs --dts`.
- Local npx test via `npm pack` and installing the tarball.

**Verification**

```bash
npm run build
npm pack
# Use from a temp directory
TMP=$(mktemp -d)
cd "$TMP"
npm init -y >/dev/null
npm i ../create-agent-instructions-*.tgz
npx create-agent-instructions
```

- Expect interactive prompts and successful generation.

---

## 11) Documentation

**Files**

- `README.md` (usage, options, example session, troubleshooting)
- `docs/requirements.md` (done)
- `docs/planning.md` (this plan)

**Acceptance Criteria**

- README shows copy-paste usage:
  ```bash
  npx create-agent-instructions@latest
  ```
- Includes screenshot/gif (optional later).

---

## 12) Acceptance Tests (Manual)

**Scenarios**

1. **OpenAI only**: libraries `[openai]`; name `MyAgent` → outputs include `examples/openai.ts`.
2. **No tools**: leave tools empty → tools.md says "No tools selected…".
3. **Multiple libs**: `[openai, langchain]` → still only OpenAI example emitted (others TBD).
4. **Re-run**: defaults are pre-populated.

**Verification**

- Confirm exact files exist:
  - `agent.md`, `tools.md`, `policies.md`, `config/agent.json`, optional `examples/openai.ts`.
- Confirm JSON is valid: `node -e "JSON.parse(require('fs').readFileSync('<agent>/config/agent.json','utf8'))"`.

---

## 13) Release 0.2.0

**Steps**

1. Bump version if needed: `npm version patch` (or keep `0.2.0`).
2. Tag and push: `git push --follow-tags`.
3. (When ready for public) `npm publish --access public`.

**Post-Release Verification**

```bash
npx create-agent-instructions@latest
```

- Prompts appear and files are generated.

---

## 14) Backlog (Not in 0.2.0)

- Add LangChain / LlamaIndex / MCP example templates.
- Add plugin API: load `create-agent-instructions-plugin-*` packages; auto-discover and merge questions/templates.
- Add `--ci` non-interactive flag to accept a config file and produce outputs.
- Add prompt linter.

---

## 15) Risk & Rollback

- **Risk:** Users on old Node (≤16).
  **Mitigation:** `"engines": {"node": ">=18"}` in package.json; clear error message on start.
- **Risk:** Windows path issues.
  **Mitigation:** use `path.join`; avoid shell-specific commands in code.
- **Risk:** TTY-less environments.
  **Mitigation:** `--ci` backlog item; for now, detect non-TTY and exit with message.

---

## 16) Checklist (All Must Be True Before Release)

- [ ] `npm run build` produces `dist/index.js` with shebang.
- [ ] Local `npm pack` + `npx create-agent-instructions` works.
- [ ] Rendering includes/excludes `examples/openai.ts` based on libraries.
- [ ] Idempotent re-run yields identical hashes.
- [ ] CI matrix green (18/20/22).
- [ ] README updated with commands and example.
