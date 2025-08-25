# Analysis of `package.json` — Outdated Dependencies & Modern Recommendations

**Date:** August 25, 2025

---

## 1. Node.js Engine Support

- **Current setting**: `"node": ">=18"`
- **Issue**: Node.js 18 reached end-of-life (EOL) on **April 30, 2025**. It no longer receives security or maintenance updates [oai_citation:0‡nodejs.org](https://nodejs.org/en/blog/announcements/v18-release-announce/?utm_source=chatgpt.com) [oai_citation:1‡herodevs.com](https://www.herodevs.com/blog-posts/node-js-18-end-of-life-what-it-means-and-how-to-prepare?utm_source=chatgpt.com).
- **Recommendation**: Update the `engines` field to target a supported version—e.g., `"node": ">=20"` or `"node": ">=22"`.

---

## 2. Runtime Dependencies

Below is a breakdown of each key runtime dependency with version status and suggested updates:

| Dependency       | Current Version | Status / Notes                                                                          | Recommended Action                                       |
| ---------------- | --------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `@clack/prompts` | 0.7.0           | Active development; later 0.x versions (up to 0.11.x) and v1 alpha exist                | Upgrade to latest 0.x; optionally wait for v1 stable     |
| `commander`      | 12              | New versions (e.g., 14.x) are available                                                 | Upgrade to latest release                                |
| `enquirer`       | 2.4.1           | Still functional, but ecosystem trend favors `@clack/prompts` or `@inquirer/prompts`    | Consider replacing or verify maintenance status          |
| `fuse.js`        | 6.6.2           | Version 7.1.0 adds improved performance and typings                                     | Upgrade to v7.x                                          |
| `kleur`          | 4.1.5           | Still maintained; alternatives exist (e.g., `picocolors`)                               | Keep or switch to a lighter substitute like `picocolors` |
| `cosmiconfig`    | 9               | Latest major version; still active                                                      | No change needed                                         |
| `conf`           | 13              | Now updated to 14.x with bug fixes and newer Node support                               | Upgrade to latest version                                |
| `eta`            | 3.4.0           | v3 is current; smaller and performant                                                   | Bump within v3.x for improvements                        |
| `zod`            | 4.1.1           | Modern v4 line is active; newer 4.x releases bring performance and feature enhancements | Upgrade to newest 4.x version                            |

---

## 3. Development Dependencies

These are essential tools for building, testing, and documentation:

| Dependency                                    | Current Version | Status / Notes                                                  | Recommended Action                               |
| --------------------------------------------- | --------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `vitest`                                      | 2.0.0           | v3.2.x is current; brings improved TS support, browser features | Upgrade to latest stable version                 |
| `tsx`                                         | 4.7.0           | Newer release (~4.20.x) available                               | Bump to latest version                           |
| `tsup`                                        | 8.0.1           | Minor updates available (~8.5.0)                                | Upgrade to latest version                        |
| `mdast-util-to-string`                        | 2               | v4.x is now out (ESM-only)                                      | Upgrade if ESM support aligns                    |
| `remark-parse`, `remark-stringify`, `unified` | 10.x each       | Ecosystem has moved on to remark 15.x and unified 11.x          | Update to newer ecosystem versions               |
| `typescript`                                  | 5.9.2           | Current variant in active use                                   | Keep; bump patch version as updates land         |
| Typedoc + `typedoc-plugin-markdown`           | unspecified     | Plugin structure still supported; watch version compatibility   | Ensure compatibility after remark/unified update |

---

## 4. Summary of Recommended Actions

```bash
# Runtime dependencies update
pnpm up @clack/prompts commander fuse.js zod kleur conf eta

# Development dependencies update
pnpm up -D vitest tsx tsup mdast-util-to-string remark-parse remark-stringify unified

Additional upgrades: Swap kleur with picocolors for a smaller footprint if desired. Consider adopting @inquirer/prompts instead of enquirer depending on your preferences.
```
