# Copilot Rails — Specification, Requirements & Rationale

**Version:** 0.1.0
**Date:** 2025-08-26
**Owner:** (You)
**Target:** Projects using VS Code + GitHub Copilot/Agents (Node/JS/TS, Next.js, Vite, CRA, NestJS, plain Node) — initial release scoped to VS Code + GitHub Copilot users only.
**Runtime:** Node.js ≥ 18

---

## 0) Problem Statement

Copilot Agents in VS Code can “trip over” long‑running dev workflows by:

- Leaving CLI tasks running in orphaned terminals.
- Executing new tasks on top of dependent tasks, killing or colliding with them.
- Running tasks against ports that are already in use or failing to follow dynamic port changes (e.g., React dev servers moving from :3000 to :3001).

This causes flaky starts, race conditions in tests, and mysterious port errors.

**Goal:** Provide a simple, idempotent `npx` CLI that adds **guardrails** around tasks, ports, and sequencing so Agents can safely start/stop and chain work across new or existing projects.

---

## 1) Scope

**In scope**

- A one‑shot CLI (`npx copilot-rails`) that:
  - Installs minimal dev dependencies (local, not global).
  - Adds an `ensure-port.mjs` helper for predictable port selection + persistence.
  - Adds or amends `package.json` scripts for web/api/dev/test flows.
  - Writes a `.vscode/tasks.json` with background **problem matchers**, **sequential dependency ordering**, and **dedicated terminals**.
  - Adds `.gitignore` entries for ephemeral `.port.*.json` files.
  - Operates idempotently and safely on existing projects.

**Out of scope (initial)**

- Deep merging of an existing `.vscode/tasks.json` (we overwrite only with `--force`).
- IDEs other than VS Code.
- Auto‑killing arbitrary PIDs (we expose `kill-port` scripts instead to avoid collateral damage).
- Kubernetes/containers process supervision.

---

## 2) User Stories

1. **As a developer**, I want to run `npx copilot-rails` to make my dev tasks predictable so that Copilot/Agents stop spawning overlapping terminals.
2. **As a test engineer**, I want `start-server-and-test` + `wait-on` semantics so end‑to‑end tests don’t start until the dev server is actually ready.
3. **As a team lead**, I want idempotent bootstrapping across many repos with reproducible, minimal changes that are easy to review/undo.
4. **As an agent user**, I want to say “Run the task _dev:all_” and be confident it won’t stomp on running tasks or busy ports.

---

## 3) Functional Requirements

**F1. CLI entry**

- Provide a binary `copilot-rails` runnable via `npx copilot-rails`.
- Exit non‑zero if no `package.json` is found in CWD.

**F2. Detection**

- Detect package manager (`npm`, `pnpm`, `yarn`, `bun`) by lockfile.
- Detect framework: `next`, `vite`, `cra` (react-scripts), `nestjs` (or @nestjs/core), fallback `node`.

**F3. Files added/updated**

- `scripts/ensure-port.mjs` (see Appendix A).
- `.vscode/tasks.json` with:
  - `dev:web` and `dev:api` tasks marked `isBackground: true`.
  - Background **problem matchers** that mark “begins” and “ready” states.
  - `presentation.panel: "dedicated"` so tasks reuse terminals.
  - `dev:all` meta-task with `dependsOn: ["dev:api","dev:web"]` and `dependsOrder: "sequence"`.
- `.gitignore` append: `.port.*.json`.

**F4. `package.json` scripts (merge, not blind overwrite)**

- `dev:web`: framework‑aware command (forces port via `$PORT` and `-p` when available).
- `dev:api`: if not present, scaffold default (`node api/server.js` guarded with `ensure-port`); otherwise respect existing.
- `dev:all`: `concurrently -k -s first -n API,WEB "npm:dev:api" "npm:dev:web"`.
- `wait:web`, `kill:web`, `kill:api` helpers (configurable ports 3000/8787 as defaults).
- `dev:test:e2e`: `start-server-and-test` pipeline example.
- If `type` not set, set `"type": "module"` to allow `.mjs` script; if `"type":"commonjs"` present, also write a `.cjs` shim (see Appendix B).

**F5. Dependencies (dev)**

- `wait-on`, `start-server-and-test`, `kill-port`, `get-port`, `concurrently`.

**F6. Idempotency & Safety**

- Do **not** overwrite existing scripts unless `--force` is passed.
- If `.vscode/tasks.json` exists, leave it unless `--force`.
- Create parent folders as needed.
- All file writes are UTF‑8; create backups when overwriting (`.bak`) if `--force`.

**F7. CLI flags**

- `--dry-run`: print planned changes, write nothing.
- `--no-install`: skip dependency installation.
- `--force`: allow overwrites where applicable.
- `--scope <path>`: run against a subpackage (e.g., monorepo `packages/web`).
- `--pm <npm|pnpm|yarn|bun>`: override auto‑detected package manager.
- `--with-launch`: also write `.vscode/launch.json` with `preLaunchTask: "dev:all"`.
- (Future) `--undo`: revert from `.bak` files.

**F8. Exit codes & messages**

- `0` success, `1` user error (no package.json), `2` write/permission error, `3` install error.

---

## 4) Non‑Functional Requirements

- **NFR1 Cross‑platform:** macOS, Linux, Windows (PowerShell).
- **NFR2 Minimal footprint:** Only local devDependencies; no global install required.
- **NFR3 Transparent:** Clear console logging; `--dry-run` for previews.
- **NFR4 Safe defaults:** Never kill processes by PID; only free ports on request (`kill-port`).
- **NFR5 Performance:** One pass in < 3–10s typical (network dependent) for installs.
- **NFR6 Maintainable:** Templates are plain JSON/JS files; no code generation magic.
- **NFR7 Reviewable:** Small, obvious diffs; backups on forced overwrite.

---

## 5) Design Overview

### 5.1 Flow

1. Validate `package.json` presence (or `--scope`).
2. Detect package manager & framework.
3. Write `scripts/ensure-port.mjs` (unless present or `--force`).
4. Merge `package.json` scripts; set `type` if missing.
5. Write `.vscode/tasks.json` (or skip unless `--force`).
6. Append to `.gitignore` for `.port.*.json`.
7. Install devDependencies (unless `--no-install`).
8. Print next steps.

### 5.2 Framework Commands & Matchers

| Framework | `dev:web` command                                              | Begins pattern                    | Ends (ready) pattern   |
| --------- | -------------------------------------------------------------- | --------------------------------- | ---------------------- | ------------------ |
| Next.js   | `node scripts/ensure-port.mjs web 3000 && next dev -p $PORT`   | `Starting`                        | `Local:\s\*http://     | ready in .\*ms`    |
| Vite      | `node scripts/ensure-port.mjs web 5173 && vite --port $PORT`   | `vite v\d+.*`                     | `Local:\s\*http://     | ready in .\*ms`    |
| CRA       | `node scripts/ensure-port.mjs web 3000 && react-scripts start` | `Starting the development server` | `You can now view      | Local:\s\*http://` |
| Fallback  | `node scripts/ensure-port.mjs web 3000 && node web/server.js`  | `Starting web`                    | `Listening on .\*:\\d+ | http://localhost:` |

> **Rationale:** Problem matchers let VS Code treat tasks as “background” with clear readiness signals so Copilot/Agents won’t re‑launch or overlap tasks.

### 5.3 Port Strategy

- Prefer a **fixed default** (e.g., 3000 for web; 8787 for API).
- If busy, find a free port via `get-port`.
- Set `process.env.PORT` and **persist** to `.port.<role>.json` for other tasks/agents to read (e.g., E2E pipeline).
- Pass explicit CLI flags to frameworks (`-p $PORT`) to avoid ignoring `.env` `PORT` in early boot paths.

### 5.4 Concurrency & Cleanup

- Use `concurrently -k -s first` to group processes and **kill the group** on exit/failure.
- Provide `kill-port` scripts instead of aggressive PID killing (safer, cross‑platform).

### 5.5 VS Code Task Design

- `isBackground: true` with `background.beginsPattern` & `background.endsPattern`.
- `presentation.panel: "dedicated"` enforces terminal reuse (prevents terminal explosion).
- `dependsOrder: "sequence"` ensures API starts before Web (or vice versa if configured).

### 5.6 Idempotent Merging

- `package.json` merges are key‑wise, preserving existing values unless `--force`.
- `.vscode/tasks.json` merging is intentionally **not** implemented (too error‑prone); user opts into overwrite with `--force`.
- Backups (`.bak`) created when overwriting files with `--force`.

---

## 6) Rationale & Alternatives

- **Problem matchers vs sleep/waits:** Matchers integrate with VS Code so Agents see a single long‑running task’s lifecycle. Sleeps are brittle.
- **Dedicated terminals:** Encourages deterministic reuse; keeps logs in one place.
- **`get-port` vs hard‑fail on conflict:** Fewer startup failures; still persists the chosen port for dependent steps.
- **`start-server-and-test` vs bespoke polling:** Proven pattern for “wait until server is ready” in CI and local dev.
- **Not auto‑killing PIDs:** Lower risk of killing unrelated processes in shared dev environments.
- **Templates instead of merging tasks.json:** Avoids complex and lossy merges; explicit `--force` keeps intent clear.

---

## 7) Risks & Mitigations

- **R1 Incorrect matchers** → Provide framework‑specific patterns; allow user edits post‑init.
- **R2 Monorepo variance** → `--scope` to operate per‑package; future peer detection.
- **R3 Script conflicts** → Default to _not overwriting_; `--force` + `.bak` for explicit changes.
- **R4 Windows shell quirks** → Keep commands POSIX‑light; rely on Node; test in PowerShell.
- **R5 Framework flags change** → Keep commands minimal and documented; easy to patch by user.

---

## 8) Testing Strategy

- **Unit (CLI):** detection (PM/framework), flag parsing, merge logic, write guards.
- **Integration:** run against sample projects for Next.js, Vite, CRA, NestJS, Node.
- **E2E (smoke):** `npx copilot-rails --dry-run` (no writes); full run with `--no-install` then with installs; verify tasks run and terminate cleanly.
- **Manual matrix:** macOS/Linux/Windows, npm/pnpm/yarn/bun.

---

## 9) Rollback / Undo

- When `--force` overwrites, create `*.bak` copies.
- (Future) `--undo` will restore from `.bak` where present (spec in §3 F7).

---

## 10) Acceptance Criteria

1. Running `npx copilot-rails` in a Next.js app writes `scripts/ensure-port.mjs`, `.vscode/tasks.json`, merges scripts, installs devDeps.
2. `Tasks: Run Task → dev:all` starts API then Web, reuses terminals, and marks ready states.
3. Starting the dev server twice **does not** spawn another terminal or kill the existing server.
4. If port 3000 is busy, Web starts on a free port and persists it to `.port.web.json`.
5. `npm run dev:test:e2e` waits for the web server and only then runs tests.
6. Re-running the CLI is idempotent; no duplicate scripts; no re-installs if already present.
7. Existing `.vscode/tasks.json` is left alone unless `--force` is specified.

---

## 11) Usage

```bash
# Default
npx copilot-rails

# Preview only
npx copilot-rails --dry-run

# Monorepo package
npx copilot-rails --scope packages/web

# Overwrite tasks.json and conflicting scripts (creates .bak)
npx copilot-rails --force

# Skip dependency installs
npx copilot-rails --no-install

# Also generate launch.json that waits on dev:all
npx copilot-rails --with-launch
```

---

## 12) Future Work

- Optional **tasks.json merge** (prompted, with diff preview).
- Detect more frameworks (SvelteKit, Remix, Astro).
- Pluggable matchers via a config file.
- Telemetry (opt‑in) to capture common failures.
- Agent‑friendly JSON manifest output (`--print-config`).

---

## Appendix A — `scripts/ensure-port.mjs` (template)

```js
import getPort from "get-port";
import fs from "node:fs";

const role = process.argv[2] || "web";
const preferred = Number(process.argv[3] || process.env.PORT || 3000);

const port = await getPort({ port: preferred });
process.env.PORT = String(port);

// Persist for other tasks/agents to consume
fs.writeFileSync(
  `.port.${role}.json`,
  JSON.stringify({ port }, null, 2),
  "utf8"
);
console.log(`${role.toUpperCase()} PORT ${port}`);
```

---

## Appendix B — `.cjs` shim (only if `type: "commonjs"`)

```js
// scripts/ensure-port.cjs
const getPort = require("get-port");
const fs = require("fs");

(async () => {
  const role = process.argv[2] || "web";
  const preferred = Number(process.argv[3] || process.env.PORT || 3000);
  const port = await getPort({ port: preferred });
  process.env.PORT = String(port);
  fs.writeFileSync(
    `.port.${role}.json`,
    JSON.stringify({ port }, null, 2),
    "utf8"
  );
  console.log(`${role.toUpperCase()} PORT ${port}`);
})();
```

---

## Appendix C — `.vscode/tasks.json` (template)

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev:web",
      "type": "shell",
      "command": "npm run dev:web",
      "isBackground": true,
      "problemMatcher": {
        "owner": "custom",
        "fileLocation": ["relative", "${workspaceFolder}"],
        "background": {
          "activeOnStart": true,
          "beginsPattern": "Starting|vite vd+.*|Starting the development server",
          "endsPattern": "Local:s*http://|ready in .*ms|You can now view"
        }
      },
      "presentation": { "reveal": "always", "panel": "dedicated" }
    },
    {
      "label": "dev:api",
      "type": "shell",
      "command": "npm run dev:api",
      "isBackground": true,
      "problemMatcher": {
        "owner": "custom",
        "fileLocation": ["relative", "${workspaceFolder}"],
        "background": {
          "activeOnStart": true,
          "beginsPattern": "API starting|Nest application successfully started",
          "endsPattern": "Listening on .*:d+|http://localhost:"
        }
      },
      "presentation": { "panel": "dedicated" }
    },
    {
      "label": "dev:all",
      "dependsOn": ["dev:api", "dev:web"],
      "dependsOrder": "sequence"
    }
  ]
}
```

---

## Appendix D — `package.json` script snippets (template)

```jsonc
{
  "scripts": {
    "dev:web": "node scripts/ensure-port.mjs web 3000 && next dev -p $PORT",
    "dev:api": "node scripts/ensure-port.mjs api 8787 && node api/server.js",
    "dev:all": "concurrently -k -s first -n API,WEB \"npm:dev:api\" \"npm:dev:web\"",
    "wait:web": "wait-on http://localhost:3000",
    "kill:web": "kill-port 3000",
    "kill:api": "kill-port 8787",
    "dev:test:e2e": "start-server-and-test \"npm run dev:web\" http://localhost:3000 \"npm run test:e2e:run\""
  }
}
```
