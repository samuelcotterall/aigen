const fs = require("fs");
const path = require("path");

// typedoc-plugin-markdown emits README.md inside the out dir; Docusaurus
// prefers an index.md at docs root. This script renames/moves README.md -> api/index.md
const outDir = path.join(__dirname, "..", "website", "docs", "api");
const readme = path.join(outDir, "README.md");
const index = path.join(outDir, "index.md");

if (fs.existsSync(readme)) {
  const data = fs.readFileSync(readme, "utf8");
  fs.writeFileSync(index, data);
  console.log("Wrote", index);
} else {
  console.warn("Typedoc README.md not found at", readme);
}
