import fs from "node:fs/promises";
import path from "node:path";

function heading(level, text) {
  return `${"#".repeat(level)} ${text}\n\n`;
}

function sentenceFromProp(key, prop, value) {
  // Produce an explicit "Do / Don't" pair for a single property.
  function safeDesc() {
    return prop && prop.description ? prop.description : key;
  }

  function doDontForValue() {
    if (typeof value === "boolean") {
      const doStr = `Do: set ${safeDesc()} to ${
        value ? "true" : "false"
      } when appropriate.`;
      const dontStr = `Don't: set ${safeDesc()} to ${
        value ? "false" : "true"
      } without a clear reason.`;
      return { doStr, dontStr };
    }

    if (Array.isArray(value)) {
      const doStr = value.length
        ? `Do: prefer ${value.join(", ")} for ${safeDesc()}.`
        : `Do: explicitly list preferred values for ${safeDesc()}.`;
      const dontStr = `Don't: rely on unapproved or unrelated tools for ${safeDesc()}.`;
      return { doStr, dontStr };
    }

    if (typeof value === "object") {
      const doStr = `Do: follow the example shape for ${safeDesc()}: ${JSON.stringify(
        value
      )}.`;
      const dontStr = `Don't: change the expected structure for ${safeDesc()} without updating the styleguide.`;
      return { doStr, dontStr };
    }

    if (typeof value === "number") {
      const doStr = `Do: keep ${safeDesc()} at ${value} or lower (guideline).`;
      const dontStr = `Don't: exceed ${value} for ${safeDesc()} without refactoring or justification.`;
      return { doStr, dontStr };
    }

    // string, enum, pattern, etc.
    if (typeof value === "string") {
      if (prop && Array.isArray(prop.enum)) {
        const doStr = `Do: prefer \`${value}\` for ${safeDesc()} (one of: ${prop.enum.join(
          ", "
        )}).`;
        const dontStr = `Don't: use values outside the approved set for ${safeDesc()}.`;
        return { doStr, dontStr };
      }
      const doStr = `Do: use \`${value}\` for ${safeDesc()} when applicable.`;
      const dontStr = `Don't: use inconsistent or ambiguous values for ${safeDesc()}.`;
      return { doStr, dontStr };
    }

    // Fallback
    return {
      doStr: `Do: follow guidance for ${safeDesc()}.`,
      dontStr: `Don't: violate the documented guidance for ${safeDesc()}.`,
    };
  }

  // If we have an explicit value, prefer do/don't derived from it.
  if (value !== undefined) {
    const { doStr, dontStr } = doDontForValue();
    return `- ${safeDesc()}\n  - ${doStr}\n  - ${dontStr}`;
  }

  // No example value: derive generic do/don't from prop metadata
  const desc = safeDesc();
  // Heuristics based on property name and description
  const lower = desc.toLowerCase();
  if (/require|mandatory|must/.test(lower)) {
    return `- ${desc}\n  - Do: ensure this is present and enforced where applicable.\n  - Don't: omit this requirement without discussion.`;
  }
  if (/forbid|forbidden|disallow|avoid/.test(lower)) {
    return `- ${desc}\n  - Do: avoid this practice.\n  - Don't: introduce code that violates this rule.`;
  }
  if (prop && prop.type === "boolean") {
    return `- ${desc}\n  - Do: prefer enabling this where it improves consistency.\n  - Don't: disable it without clear justification.`;
  }
  if (prop && prop.type === "array") {
    return `- ${desc}\n  - Do: enumerate approved items for this field.\n  - Don't: add unrelated items without a proposal.`;
  }
  if (prop && prop.type === "number") {
    const max = prop.maximum || prop.exclusiveMaximum || undefined;
    const min = prop.minimum || prop.exclusiveMinimum || undefined;
    if (max !== undefined)
      return `- ${desc}\n  - Do: keep values <= ${max}.\n  - Don't: exceed ${max} without refactoring.`;
    if (min !== undefined)
      return `- ${desc}\n  - Do: keep values >= ${min}.\n  - Don't: reduce below ${min} without discussion.`;
  }

  // Generic fallback
  return `- ${desc}\n  - Do: follow this guideline when designing code or docs.\n  - Don't: ignore this guidance without recording a rationale.`;
}

async function main() {
  const schemaPath = path.resolve(
    process.cwd(),
    "schemas",
    "eslint-style.schema.json"
  );
  const outPath = path.resolve(process.cwd(), "docs", "agent-instructions.md");
  const raw = await fs.readFile(schemaPath, "utf8");
  const schema = JSON.parse(raw);

  const example =
    Array.isArray(schema.examples) && schema.examples.length
      ? schema.examples[0]
      : {};

  const parts = [];
  parts.push("# Project AI Assistant Instructions\n");
  parts.push(
    "\nThe assistant should follow these high-level project conventions when generating code, docs, and scripts.\n\n"
  );

  // Add a short preamble to avoid duplicating linter rules
  parts.push(
    "Note: Do not re-enforce rules already covered by linters or formatters (ESLint, Prettier, flake8, etc.). Focus on higher-level organization, naming, file sizes, scripts, docs, and repository conventions.\n\n"
  );

  const props = schema.properties || {};
  for (const [sectionKey, section] of Object.entries(props)) {
    parts.push(
      heading(
        2,
        sectionKey
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (s) => s.toUpperCase())
      )
    );
    // If the example has a value for this section, render concrete sentences
    const exampleValue = example[sectionKey];

    if (section.type === "object" && section.properties) {
      for (const [k, prop] of Object.entries(section.properties)) {
        const v =
          exampleValue && exampleValue[k] !== undefined
            ? exampleValue[k]
            : undefined;
        parts.push(sentenceFromProp(k, prop, v) + "\n");
      }
    } else if (exampleValue !== undefined) {
      // render top-level array or primitive
      parts.push(sentenceFromProp(sectionKey, section, exampleValue) + "\n");
    } else if (section.description) {
      parts.push(`- ${section.description}\n`);
    }
    parts.push("\n");
  }

  // Add a short how-to for the assistant
  parts.push("## How to use these rules\n\n");
  parts.push(
    "- Prefer creating modular, well-documented files following the repository `docs` and `README.md` conventions.\n"
  );
  parts.push(
    "- When unsure, follow the `examples` section in the schema or ask for clarification.\n"
  );
  parts.push(
    "- Avoid changing code style that is already enforced by linters or automated formatting.\n"
  );

  parts.push("\n---\n\nGenerated from `schemas/eslint-style.schema.json`.");

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, parts.join("\n"));
  console.log("Wrote", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
