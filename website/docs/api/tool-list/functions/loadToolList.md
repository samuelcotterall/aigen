[**create-agent-instructions**](/docs/api)

***

[create-agent-instructions](/docs/api/modules) / [tool-list](/docs/api) / loadToolList

# Function: loadToolList()

> **loadToolList**(`source?`): `Promise`\<`any`\>

Defined in: src/tool-list.ts:20

Load a list of tools. If `source` is not provided, return a built-in list.

The `source` can be a local JSON file path or an HTTP(S) URL returning
an array of tool descriptors. Remote responses are cached to a temp file
for up to 24 hours.

## Parameters

### source?

`string`

optional local path or URL to a tool list

## Returns

`Promise`\<`any`\>
