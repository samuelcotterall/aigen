// scripts/ensure-port.mjs (template)
import getPort from 'get-port';
import fs from 'node:fs';

const role = process.argv[2] || 'web';
const preferred = Number(process.argv[3] || process.env.PORT || 3000);

const port = await getPort({ port: preferred });
process.env.PORT = String(port);

// Persist for other tasks/agents to consume
fs.writeFileSync(`.port.${role}.json`, JSON.stringify({ port }, null, 2), 'utf8');
console.log(`${role.toUpperCase()} PORT ${port}`);
