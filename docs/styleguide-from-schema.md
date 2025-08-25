# Project Style Schema


High-level project style and organization rules (non-linter): file organization, naming conventions, file size limits, script naming, documentation and repo/CI conventions.


## projectStructure


### projectStructure
Guidelines for directory layout and where to place code, tests and assets.
- Type: `object`

**Fields:**
- **srcDir**: Primary source directory (e.g. 'src') (type: string)
- **testsDir**: Top-level test directory (e.g. 'test' or 'tests') (type: string)
- **coLocateTests**: Prefer co-locating tests next to implementation files (type: boolean)
- **assetsDir**: Static assets directory (optional) (type: string)


## fileConventions


### fileConventions
File naming and placement conventions not covered by linters.
- Type: `object`

**Fields:**
- **fileNameCase**: Preferred casing for file names (type: string)
- **componentFileSuffix**: Suffix for component files (e.g. .component.tsx) (type: string)
- **testFilePattern**: Glob pattern for test files (e.g. **/*.test.*) (type: string)
- **coLocateAssets**: Prefer co-locating small assets (CSS/images) with components (type: boolean)


## fileLimits


### fileLimits
Soft limits for file sizes and complexity (guidelines, not enforced by linters).
- Type: `object`

**Fields:**
- **maxLines**: Recommended maximum lines per file (type: integer)
- **maxFunctionsPerFile**:  (type: integer)
- **maxCyclomaticComplexity**: Guideline for function complexity (type: integer)


## namingConventions


### namingConventions
High level naming preferences for scripts, binaries and packages (not code-level identifiers).
- Type: `object`

**Fields:**
- **scriptPrefix**: Recommended prefix for package.json scripts (e.g., 'dev:', 'build:') (type: string)
- **binaryNames**: Preferred executable names for CLI tools (type: array)
- **packageNamePattern**: Regex or pattern for package name (optional) (type: string)


## documentation


### documentation
- Type: `object`

**Fields:**
- **requireReadme**: Require README.md at project root (type: boolean)
- **docsFolder**: Preferred docs folder e.g. 'docs' or 'website' (type: string)
- **inlineDocStyle**: Preferred inline doc style (e.g., 'JSDoc', 'TSDoc', 'Sphinx') (type: string)


## scripts


### scripts
Conventions for package scripts and CI tasks.
- Type: `object`

**Fields:**
- **requiredScripts**: Scripts that should exist in package.json (e.g., build,test,lint) (type: array)
- **forbiddenScriptNames**: Script names that should be avoided (type: array)


## testingConventions


### testingConventions
- Type: `object`

**Fields:**
- **testFrameworks**: Preferred test frameworks or runners (type: array)
- **testCoverageGoal**: Target percentage for test coverage (informational) (type: number)


## repository


### repository
- Type: `object`

**Fields:**
- **defaultBranch**: Name of the default branch (e.g., 'main') (type: string)
- **prTemplate**: Recommend using a PR template (type: boolean)
- **branchNamePattern**: Preferred branch naming pattern (e.g., feature/*) (type: string)


## preferredTools


### preferredTools
Preferred libraries, CLIs, or infrastructure choices (informational).
- Type: `array`
- Items: string


## disallowedPractices


### disallowedPractices
High-level practices to avoid (e.g., 'global variables', 'deeply nested callbacks').
- Type: `array`
- Items: string


---

Generated from `schemas/eslint-style.schema.json`.