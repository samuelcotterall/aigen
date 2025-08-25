[**create-agent-instructions**](/docs/api)

***

[create-agent-instructions](/docs/api/modules) / [templates](/docs/api) / renderTemplates

# Function: renderTemplates()

> **renderTemplates**(`cfg`): `Promise`\<`Record`\<`string`, `string`\>\>

Defined in: src/templates.ts:70

Render all templates to a map of output path -> content.

This will evaluate Eta templates under `templates/common` and return a
flat object containing the final content for each output path.

## Parameters

### cfg

parsed AgentConfig used as the template context

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

## Returns

`Promise`\<`Record`\<`string`, `string`\>\>
