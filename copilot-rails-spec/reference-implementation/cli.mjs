#!/usr/bin/env node
// cli.mjs — “copilot-rails”: make long-running tasks agent-safe across projects.
// Node 18+ recommended (fs/promises, native fetch not required)
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CWD = process.cwd();
const log = (...a) => console.log('[copilot-rails]', ...a);
const warn = (...a) => console.warn('[copilot-rails]', ...a);
const err = (...a) => console.error('[copilot-rails]', ...a);

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('-')));
const DRY = flags.has('--dry-run');
const FORCE = flags.has('--force');
const NO_INSTALL = flags.has('--no-install');

const PKG_PATH = path.join(CWD, 'package.json');

const DEPS = {
  dev: [
    'wait-on',
    'start-server-and-test',
    'kill-port',
    'get-port',
    'concurrently'
  ]
};

const TEMPLATE = {
  ensurePort: `// scripts/ensure-port.mjs
import getPort from 'get-port';
import fs from 'node:fs';

const role = process.argv[2] || 'web';
const preferred = Number(process.argv[3] || process.env.PORT || 3000);

const port = await getPort({ port: preferred });
process.env.PORT = String(port);

// Persist for other tasks/agents to consume
fs.writeFileSync(\`.port.\${role}.json\`, JSON.stringify({ port }, null, 2), 'utf8');
console.log(\`\${role.toUpperCase()} PORT \${port}\`);
`,
  tasksJSON: ({ webStart, apiStart, webBegins, webEnds, apiBegins, apiEnds }) => `{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "dev:web",
      "type": "shell",
      "command": "${webStart}",
      "isBackground": true,
      "problemMatcher": {
        "owner": "custom",
        "fileLocation": ["relative", "${workspaceFolder}"],
        "background": {
          "activeOnStart": true,
          "beginsPattern": "${escapeForJSON(webBegins)}",
          "endsPattern": "${escapeForJSON(webEnds)}"
        }
      },
      "presentation": { "reveal": "always", "panel": "dedicated" }
    },
    {
      "label": "dev:api",
      "type": "shell",
      "command": "${apiStart}",
      "isBackground": true,
      "problemMatcher": {
        "owner": "custom",
        "fileLocation": ["relative", "${workspaceFolder}"],
        "background": {
          "activeOnStart": true,
          "beginsPattern": "${escapeForJSON(apiBegins)}",
          "endsPattern": "${escapeForJSON(apiEnds)}"
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
`
};

function escapeForJSON(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function readJSON(p) {
  return JSON.parse(await fsp.readFile(p, 'utf8'));
}

async function writeFile(p, content) {
  if (DRY) { log('DRY:', p); return; }
  await fsp.mkdir(path.dirname(p), { recursive: true });
  await fsp.writeFile(p, content, 'utf8');
}

function detectPackageManager() {
  if (fs.existsSync(path.join(CWD, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(CWD, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(CWD, 'bun.lockb'))) return 'bun';
  return 'npm';
}

function detectFramework(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps?.next) return 'next';
  if (deps?.vite) return 'vite';
  if (deps?.['react-scripts']) return 'cra';
  if (deps?.nestjs || deps?.['@nestjs/core']) return 'nestjs';
  return 'node';
}

function getWebCommand(framework) {
  switch (framework) {
    case 'next': return 'node scripts/ensure-port.mjs web 3000 && next dev -p $PORT';
    case 'vite': return 'node scripts/ensure-port.mjs web 5173 && vite --port $PORT';
    case 'cra':  return 'node scripts/ensure-port.mjs web 3000 && react-scripts start';
    default:     return 'node scripts/ensure-port.mjs web 3000 && node web/server.js';
  }
}

function getWebMatcher(framework) {
  switch (framework) {
    case 'next':
      return { begins: 'Starting', ends: 'Local:\\s*http://|ready in .*ms' };
    case 'vite':
      return { begins: 'vite v\\d+.*', ends: 'Local:\\s*http://|ready in .*ms' };
    case 'cra':
      return { begins: 'Starting the development server', ends: 'You can now view|Local:\\s*http://' };
    default:
      return { begins: 'Starting web', ends: 'Listening on .*:\\\\d+|http://localhost:' };
  }
}

function getApiCommand(pkg) {
  const scripts = pkg.scripts || {};
  if (scripts['dev:api']) return 'npm run dev:api';
  if (scripts['start:api']) return 'npm run start:api';
  if (scripts['dev:server']) return 'npm run dev:server';
  return 'node scripts/ensure-port.mjs api 8787 && node api/server.js';
}

function getApiMatcher() {
  return { begins: 'API starting|Nest application successfully started', ends: 'Listening on .*:\\\\d+|http://localhost:' };
}

async function upsertPackageJSON(pkgPath, mutator) {
  const pkg = await readJSON(pkgPath);
  const before = JSON.stringify(pkg, null, 2);
  const afterObj = await mutator(pkg) || pkg;
  const after = JSON.stringify(afterObj, null, 2);
  if (before === after) { log('package.json unchanged'); return; }
  if (DRY) { log('DRY: would update package.json'); return; }
  await fsp.writeFile(pkgPath, after + '\n', 'utf8');
  log('Updated package.json');
}

function mergeScripts(existing = {}, toAdd = {}) {
  const out = { ...existing };
  for (const [k, v] of Object.entries(toAdd)) {
    if (v === undefined) continue;
    if (out[k] && out[k] !== v && !FORCE) {
      warn(`scripts["${k}"] exists; keeping existing (use --force to overwrite)`);
      continue;
    }
    out[k] = v;
  }
  return out;
}

async function installDeps(pkgManager, dev = []) {
  if (NO_INSTALL || DRY || !dev.length) {
    log('Skip install:', dev.join(' '));
    return;
  }
  const args = {
    npm: ['i', '-D', ...dev],
    pnpm: ['add', '-D', ...dev],
    yarn: ['add', '-D', ...dev],
    bun: ['add', '-d', ...dev],
  }[pkgManager];

  log(`Installing devDeps with ${pkgManager} ${args.join(' ')}`);
  await new Promise((resolve, reject) => {
    const p = spawn(pkgManager, args, { stdio: 'inherit', cwd: CWD, shell: true });
    p.on('exit', code => code === 0 ? resolve() : reject(new Error(`${pkgManager} exited ${code}`)));
  });
}

async function main() {
  if (!(await exists(PKG_PATH))) {
    err('No package.json found in this directory.');
    process.exit(1);
  }

  const pkg = await readJSON(PKG_PATH);
  const pm = detectPackageManager();
  const fw = detectFramework(pkg);
  log(`Detected: packageManager=${pm}, framework=${fw}`);

  // 1) scripts/ensure-port.mjs
  const ensurePath = path.join(CWD, 'scripts', 'ensure-port.mjs');
  if (await exists(ensurePath) && !FORCE) {
    log('scripts/ensure-port.mjs exists (use --force to overwrite)');
  } else {
    await writeFile(ensurePath, TEMPLATE.ensurePort);
    if (!DRY) fs.chmodSync(ensurePath, 0o755);
    log('Wrote scripts/ensure-port.mjs');
  }

  // 2) package.json scripts
  const webCmd = getWebCommand(fw);
  const { begins: webBegins, ends: webEnds } = getWebMatcher(fw);
  const apiCmd = getApiCommand(pkg);
  const { begins: apiBegins, ends: apiEnds } = getApiMatcher();

  await upsertPackageJSON(PKG_PATH, (p) => {
    p.scripts = mergeScripts(p.scripts, {
      'dev:web': webCmd,
      'dev:api': apiCmd.includes('npm run') ? undefined : apiCmd,
      'dev:all': 'concurrently -k -s first -n API,WEB "npm:dev:api" "npm:dev:web"',
      'wait:web': 'wait-on http://localhost:3000',
      'kill:web': 'kill-port 3000',
      'kill:api': 'kill-port 8787',
      'dev:test:e2e': 'start-server-and-test "npm run dev:web" http://localhost:3000 "npm run test:e2e:run"'
    });
    if (!p.type) p.type = 'module';
    return p;
  });

  // 3) .vscode/tasks.json
  const tasksPath = path.join(CWD, '.vscode', 'tasks.json');
  if (await exists(tasksPath) && !FORCE) {
    warn('.vscode/tasks.json exists; leaving as-is (use --force to overwrite).');
  } else {
    const tasksJSON = TEMPLATE.tasksJSON({
      webStart: 'npm run dev:web',
      apiStart: 'npm run dev:api',
      webBegins,
      webEnds,
      apiBegins,
      apiEnds
    });
    await writeFile(tasksPath, tasksJSON);
    log('Wrote .vscode/tasks.json');
  }

  // 4) .gitignore additions
  const giPath = path.join(CWD, '.gitignore');
  const giAdd = `\n# copilot-rails\n.port.*.json\n`;
  if (await exists(giPath)) {
    const gi = await fsp.readFile(giPath, 'utf8');
    if (!gi.includes('.port.*.json')) {
      await writeFile(giPath, gi + giAdd);
      log('Updated .gitignore');
    }
  } else {
    await writeFile(giPath, giAdd.trimStart());
    log('Created .gitignore');
  }

  // 5) Install dev deps
  await installDeps(pm, DEPS.dev);

  log('Done. Try:');
  log('  - VS Code: Run Task → "dev:all"');
  log('  - CLI: npm run dev:all (kills group if one fails, avoids orphans)');
  log('  - If a port is stuck: npm run kill:web && npm run kill:api');
}

main().catch(e => { err(e); process.exit(1); });
