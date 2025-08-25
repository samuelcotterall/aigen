import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const schemaPath = path.resolve(
    process.cwd(),
    "schemas",
    "eslint-style.schema.json"
  );
  const raw = await fs.readFile(schemaPath, "utf8");
  const schema = JSON.parse(raw);
  const mapping =
    schema.properties &&
    schema.properties.eslintRuleMapping &&
    schema.properties.eslintRuleMapping.properties
      ? schema.properties.eslintRuleMapping.properties
      : {};

  const rows = [["Rule", "Default / Example", "Description"]];
  for (const [key, val] of Object.entries(mapping)) {
    let example = "";
    if (val && val.default) {
      example = JSON.stringify(val.default);
    } else if (val && val.type) {
      example = val.type;
    }
    const desc = (val && val.description) || "";
    rows.push([key, example, desc]);
  }

  // print markdown table
  const colWidths = rows[0].map((_, i) =>
    Math.max(...rows.map((r) => (r[i] || "").length))
  );
  function pad(s, n) {
    return (s || "").padEnd(n);
  }

  console.log(
    "| " + rows[0].map((c, i) => pad(c, colWidths[i])).join(" | ") + " |"
  );
  console.log("| " + colWidths.map((n) => "-".repeat(n)).join(" | ") + " |");
  for (const r of rows.slice(1)) {
    console.log(
      "| " + r.map((c, i) => pad(c, colWidths[i])).join(" | ") + " |"
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
