#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

// Initial seed candidates to query from npm and PyPI. We'll also discover
// additional npm packages by searching the registry for relevant topics.
const npmCandidates = [
  "playwright",
  "puppeteer",
  "vitest",
  "jest",
  "axios",
  "shadcn/ui",
  "@tanstack/react-query",
  "@tanstack/table",
  "jotai",
  "zustand",
  "swr",
  "next",
  "react",
  "vite",
  "webpack",
];
const pyCandidates = ["requests", "pytest", "poetry", "flask", "django"];

// Topics to search on the npm registry to auto-discover popular packages.
const npmTopics = [
  "react",
  "ui",
  "state-management",
  "data-fetching",
  "testing",
  "playwright",
  "puppeteer",
  "vector",
  "vector-db",
  "llm",
  "chatbot",
  "database",
  "orm",
  "analytics",
  "middleware",
];

async function searchNpmByTopic(topic: string, size = 20) {
  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(
      topic
    )}&size=${size}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.objects)) return [];
    return data.objects
      .map((o: any) => o && o.package && o.package.name)
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

// Cache & incremental fetch helpers -------------------------------------------------
const CACHE_PATH = path.join(
  process.cwd(),
  "src",
  "tools",
  ".fetch-cache.json"
);
const DEFAULT_TTL = Number(process.env.NPM_META_TTL_SECONDS || 60 * 60 * 24); // 1 day

async function loadCache() {
  try {
    const raw = await fs.readFile(CACHE_PATH, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return { packages: {} } as any;
  }
}

async function saveCache(cache: any) {
  try {
    await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");
  } catch (e) {
    // ignore
  }
}

async function fetchNpmMeta(name: string, cache: any) {
  const now = Date.now();
  cache.packages = cache.packages || {};
  const existing = cache.packages[name];
  if (existing && now - (existing.fetchedAt || 0) < DEFAULT_TTL * 1000) {
    return existing.meta;
  }

  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(name)}`
    );
    if (!res.ok) return null;
    const data = await res.json();

    // Try to fetch weekly downloads (best-effort)
    let downloads = 0;
    try {
      const dlRes = await fetch(
        `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(
          name
        )}`
      );
      if (dlRes.ok) {
        const dlJson = await dlRes.json();
        downloads = Number(dlJson.downloads) || 0;
      }
    } catch (_) {
      downloads = 0;
    }

    // Attempt to extract GitHub topics if repository points to GitHub and a token is available
    let githubTopics: string[] = [];
    try {
      const repo = data.repository && (data.repository.url || data.repository);
      const repoUrl = typeof repo === "string" ? repo : repo && repo.url;
      if (repoUrl && /github.com/.test(repoUrl)) {
        const match = repoUrl.match(/github.com[:/](.+?)\/?(\.git)?$/);
        if (match) {
          const ownerRepo = match[1];
          const token =
            process.env.GITHUB_TOKEN || process.env.NPM_FETCH_GITHUB_TOKEN;
          if (token) {
            const topicsRes = await fetch(
              `https://api.github.com/repos/${ownerRepo}/topics`,
              {
                headers: {
                  Accept: "application/vnd.github+json",
                  Authorization: `token ${token}`,
                  "User-Agent": "fetch-tools-script",
                },
              }
            );
            if (topicsRes.ok) {
              const tj = await topicsRes.json();
              githubTopics = Array.isArray(tj.names) ? tj.names : [];
            }
          }
        }
      }
    } catch (_) {
      githubTopics = [];
    }

    const meta = {
      name: data.name,
      description: data.description || data.homepage || "",
      keywords: data.keywords || [],
      repository: data.repository || undefined,
      source: "npm",
      downloads,
      githubTopics,
    };

    cache.packages[name] = { fetchedAt: Date.now(), meta };
    return meta;
  } catch (e) {
    return null;
  }
}

async function fetchPyPI(name: string) {
  try {
    const res = await fetch(
      `https://pypi.org/pypi/${encodeURIComponent(name)}/json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      name: data.info.name,
      description: data.info.summary || data.info.home_page || "",
      keywords: (data.info.keywords || "").split(/\s+/).filter(Boolean),
      source: "pypi",
    };
  } catch (e) {
    return null;
  }
}

function toCatalogEntry(p: any) {
  const language = p.source === "pypi" ? "python" : "javascript";
  const packageManager = p.source === "pypi" ? "pip" : "npm";
  const ecosystem = p.source === "pypi" ? "python" : "node";
  return {
    name: p.name,
    description: p.description || undefined,
    keywords: p.keywords || [],
    language,
    packageManager,
    ecosystem,
  };
}

async function main() {
  // Discover packages for each topic in parallel (best-effort). We cap the
  // total discovered set so the script remains bounded.
  console.log("Discovering npm packages by topic...");
  const topicPromises = npmTopics.map((t) => searchNpmByTopic(t, 30));
  const topicResults = await Promise.all(topicPromises);
  const discovered = Array.from(new Set(topicResults.flat())).filter(Boolean);
  const discoveredCapped = discovered.slice(0, 300);

  const mergedNpm = Array.from(
    new Set([...npmCandidates, ...discoveredCapped])
  );
  console.log(
    `Discovered ${discovered.length} packages across topics; using ${mergedNpm.length} npm candidates.`
  );

  // Load cache and prepare filtering configuration
  const cache = await loadCache();
  const out: any[] = [];

  const minDownloads = Number(process.env.NPM_MIN_WEEKLY_DOWNLOADS || 2000);
  const keywordFilters = (
    process.env.NPM_KEYWORD_FILTERS ||
    "react,ui,vitest,testing,playwright,puppeteer,jotai,zustand,tailwind,radix,chakra,mui,shadcn,tanstack"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const topicFilters = (
    process.env.NPM_TOPIC_FILTERS ||
    "react,ui,testing,state-management,data-fetching"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Filtering discovered packages using minDownloads=${minDownloads}, keywordFilters=[${keywordFilters.join(
    ","
  )}], topicFilters=[${topicFilters.join(",")}]
  `);

  // Helper to determine if a package should be included
  function shouldInclude(meta: any, name: string) {
    // Always include seed candidates
    if (npmCandidates.includes(name)) return true;
    if (!meta) return false;
    // Downloads threshold
    if ((meta.downloads || 0) >= minDownloads) return true;
    // Keyword match
    if (
      Array.isArray(meta.keywords) &&
      meta.keywords.some((k: string) => keywordFilters.includes(k))
    )
      return true;
    // GitHub topics match
    if (
      Array.isArray(meta.githubTopics) &&
      meta.githubTopics.some((t: string) => topicFilters.includes(t))
    )
      return true;
    return false;
  }

  console.log("Fetching npm metadata (with cache/incremental updates)...");
  for (const name of mergedNpm) {
    const meta = await fetchNpmMeta(name, cache);
    if (meta && shouldInclude(meta, name)) {
      out.push(toCatalogEntry(meta));
    }
  }

  console.log("Fetching PyPI metadata...");
  for (const name of pyCandidates) {
    const r = await fetchPyPI(name);
    if (r) out.push(toCatalogEntry(r));
  }

  // persist cache for faster subsequent runs
  await saveCache(cache);

  const toolsDir = path.join(process.cwd(), "src", "tools");
  await fs.mkdir(toolsDir, { recursive: true });
  const jsonPath = path.join(toolsDir, "generated.json");
  await fs.writeFile(jsonPath, JSON.stringify(out, null, 2), "utf8");

  // also emit a TypeScript module that exports the generated catalog
  const tsPath = path.join(toolsDir, "generated.ts");
  const tsContent = `// Generated by scripts/fetch-tools.ts — do not edit by hand\nexport default ${JSON.stringify(
    out,
    null,
    2
  )} as any;\n`;
  await fs.writeFile(tsPath, tsContent, "utf8");

  // Overwrite the canonical catalog file so code can import a refreshed catalog
  const catalogPath = path.join(process.cwd(), "src", "tools", "catalog.ts");
  const header = `// This file is generated by scripts/fetch-tools.ts. Do not edit by hand.\n`;
  const catalogContent = `${header}export const TOOL_CATALOG = ${JSON.stringify(
    out,
    null,
    2
  )} as const;\n\nexport default TOOL_CATALOG;\n`;
  await fs.writeFile(catalogPath, catalogContent, "utf8");

  console.log(
    `Wrote ${out.length} entries to ${jsonPath}, ${tsPath}, and updated ${catalogPath}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
