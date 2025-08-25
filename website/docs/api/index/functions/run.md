[**create-agent-instructions**](/docs/api)

***

[create-agent-instructions](/docs/api/modules) / [index](/docs/api) / run

# Function: run()

> **run**(`opts`): `Promise`\<`void`\>

Defined in: src/index.ts:28

CLI entry point: interactively build and write an agent instruction pack.

This function drives the interactive prompts, gathers defaults, composes
an AgentConfig, and delegates to `writeOutputs` to materialize files.

## Parameters

### opts

`any`

Runtime options (e.g., { dev, outDir, astMerge, runId, seed, name, toolsSource })

## Returns

`Promise`\<`void`\>
