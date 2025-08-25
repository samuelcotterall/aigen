import fs from "node:fs/promises";
import path from "node:path";

function heading(level, text) {
  return `${"#".repeat(level)} ${text}\n\n`;
}

function propToMd(name, prop) {
  const lines = [];
  lines.push(`### ${name}\n`);
  if (prop.description) lines.push(`${prop.description}\n`);
  if (prop.type) lines.push(`- Type: ${"`"}${prop.type}${"`"}\n`);
  if (prop.enum) lines.push(`- Allowed: ${prop.enum.join(", ")}\n`);
  if (prop.items && prop.items.type)
    lines.push(`- Items: ${prop.items.type}\n`);
  if (prop.properties) {
    lines.push("\n**Fields:**\n");
    for (const [k, v] of Object.entries(prop.properties)) {
      lines.push(`- \
\
**${k}**: ${v.description || ""} (type: ${v.type || "object"})\n`);
    }
  }
  lines.push("\n");
  return lines.join("");
}

async function main() {
  const schemaPath = path.resolve(
    process.cwd(),
    "schemas",
    "eslint-style.schema.json"
  );
  const outPath = path.resolve(
    process.cwd(),
    "docs",
    "styleguide-from-schema.md"
  );
  const raw = await fs.readFile(schemaPath, "utf8");
  const schema = JSON.parse(raw);

  const parts = [];
  parts.push(heading(1, schema.title || "Style Guide"));
  if (schema.description) parts.push(schema.description + "\n\n");

  const props = schema.properties || {};
  for (const [k, v] of Object.entries(props)) {
    parts.push(heading(2, k));
    parts.push(propToMd(k, v));
  }

  parts.push("---\n\nGenerated from `schemas/eslint-style.schema.json`.");
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, parts.join("\n"));
  console.log("Wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
