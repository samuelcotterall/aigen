[**create-agent-instructions**](/docs/api)

***

[create-agent-instructions](/docs/api/modules) / [write](/docs/api) / writeOutputs

# Function: writeOutputs()

> **writeOutputs**(`parentDir`, `cfg`, `opts?`): `Promise`\<`string`\>

Defined in: src/write.ts:205

Render templates and write output files for an AgentConfig.

The function will create the target directory if necessary, write files
produced by `renderTemplates`, and when `opts.skipIfExists` or
`opts.astMerge` are provided, perform merging behavior for JSON and
markdown files so user content is preserved.

## Parameters

### parentDir

`string`

parent directory where the agent folder will be created

### cfg

parsed AgentConfig

#### displayName?

`string` = `...`

#### libraries

(`"openai"` \| `"langchain"` \| `"llamaindex"` \| `"autogen"` \| `"none"`)[] = `...`

#### name

`string` = `...`

#### outputs

(`"markdown"` \| `"json"` \| `"yaml"`)[] = `...`

#### policies

\{ `privacyNotes?`: `string`; `refusalPattern`: `string`; `safetyLevel`: `"strict"` \| `"minimal"` \| `"standard"`; \} = `...`

#### policies.privacyNotes?

`string` = `...`

#### policies.refusalPattern

`string` = `...`

#### policies.safetyLevel

`"strict"` \| `"minimal"` \| `"standard"` = `...`

#### preset?

`"custom"` \| `"openai"` \| `"langchain"` \| `"llamaindex"` \| `"autogen"` \| `"mcp"` \| `"vscode"` = `...`

#### slug?

`string` = `...`

#### structure?

\{ `folders`: `string`[]; `layout`: `"single"` \| `"monorepo"`; \} = `...`

#### structure.folders

`string`[] = `...`

#### structure.layout

`"single"` \| `"monorepo"` = `...`

#### style

\{ `docs`: `"tsdoc"` \| `"jsdoc"` \| `"none"`; `linter`: `"none"` \| `"biome"` \| `"eslint"`; `naming`: `"camelCase"` \| `"snake_case"`; `tests`: `"none"` \| `"vitest"`; `tsconfig`: `"strict"` \| `"balanced"` \| `"loose"`; \} = `...`

#### style.docs

`"tsdoc"` \| `"jsdoc"` \| `"none"` = `...`

#### style.linter

`"none"` \| `"biome"` \| `"eslint"` = `...`

#### style.naming

`"camelCase"` \| `"snake_case"` = `...`

#### style.tests

`"none"` \| `"vitest"` = `...`

#### style.tsconfig

`"strict"` \| `"balanced"` \| `"loose"` = `...`

#### tools

`object`[] = `...`

### opts?

optional behavior modifiers (skipIfExists, astMerge, runId, seed)

#### astMerge?

`boolean`

#### runId?

`string`

#### seed?

`string` \| `number`

#### skipIfExists?

`boolean`

## Returns

`Promise`\<`string`\>

the created/used output directory path
