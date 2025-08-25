[**create-agent-instructions**](/docs/api)

***

[create-agent-instructions](/docs/api/modules) / [write](/docs/api) / mergeMarkdownSections

# Function: mergeMarkdownSections()

> **mergeMarkdownSections**(`existing`, `incoming`, `options?`): `Promise`\<`string`\>

Defined in: src/write.ts:77

Merge two markdown documents by section headings using remark/unist.

The function will attempt to dedupe lines within matching sections and
insert a small HTML comment marker with metadata when new nodes are
appended. The function dynamically imports remark/unified to avoid a
hard dependency unless this feature is used.

## Parameters

### existing

`string`

current markdown content

### incoming

`string`

new markdown content to merge

### options?

optional runId or seed used to create merge markers

#### runId?

`string`

#### seed?

`string` \| `number`

## Returns

`Promise`\<`string`\>

merged markdown content
