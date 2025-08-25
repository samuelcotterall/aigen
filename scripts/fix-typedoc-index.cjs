const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "website", "docs", "api");
const readme = path.join(outDir, "README.md");
const index = path.join(outDir, "index.md");

if (fs.existsSync(readme)) {
  const data = fs.readFileSync(readme, "utf8");
  // If index.md already exists and is identical to README, remove README
  if (fs.existsSync(index)) {
    const idxData = fs.readFileSync(index, "utf8");
    if (idxData === data) {
      // duplicate; remove README to avoid Docusaurus duplicate route
      try {
        fs.unlinkSync(readme);
        console.log("Removed duplicate", readme);
      } catch (e) {
        console.warn("Failed to remove duplicate README:", e.message || e);
      }
    } else {
      // index exists but differs; prefer keeping index and write a backup of README
      try {
        fs.writeFileSync(path.join(outDir, "README.typedoc.md"), data, "utf8");
        console.log("Wrote backup README.typedoc.md");
      } catch (e) {
        console.warn("Failed to write README backup:", e.message || e);
      }
    }
  } else {
    // index doesn't exist: copy README -> index and then remove README to
    // prevent duplicate routes
    fs.writeFileSync(index, data);
    try {
      fs.unlinkSync(readme);
      console.log("Wrote", index, "and removed", readme);
    } catch (e) {
      console.log("Wrote", index);
      console.warn(
        "Failed to remove README after writing index:",
        e.message || e
      );
    }
  }
} else {
  console.warn("Typedoc README.md not found at", readme);
}

// Rewrite common relative README.md links inside generated API markdown to the
// Docusaurus route for the API index. This avoids warnings like
// "Docs markdown link couldn't be resolved: (../../README.md)" during dev.
function rewriteReadmeLinks(dir) {
  const walk = (d) => {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (stat.isFile() && p.endsWith(".md")) {
        let data = fs.readFileSync(p, "utf8");
        const orig = data;
        // Replace any link targeting README.md (any relative path) -> /docs/api
        data = data.replace(
          /\]\([^\)]*README\.md(#[^\)\s]*)?\)/g,
          "](/docs/api$1)"
        );
        // Replace links to modules.md with the API modules index
        data = data.replace(
          /\]\([^\)]*modules\.md(#[^\)\s]*)?\)/g,
          "](/docs/api/modules$1)"
        );
        if (data !== orig) {
          fs.writeFileSync(p, data, "utf8");
          console.log("Rewrote README links in", p);
        }
      }
    }
  };
  try {
    if (fs.existsSync(dir)) walk(dir);
  } catch (e) {
    console.warn("Failed rewriting README links:", e.message || e);
  }
}

rewriteReadmeLinks(outDir);
