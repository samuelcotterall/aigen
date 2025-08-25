[**create-agent-instructions**](/docs/api)

***

[create-agent-instructions](/docs/api/modules) / [write](/docs/api) / deepMerge

# Function: deepMerge()

> **deepMerge**(`a`, `b`): `any`

Defined in: src/write.ts:28

Deep-merge two values. Works for objects and arrays with some heuristics:
- Arrays of objects with a `name` property are merged by name.
- Primitive arrays are deduplicated.
- Objects are merged recursively, preferring values from `a` when scalar.

This is used to merge incoming generated config/docs with existing files
when the CLI is asked to `merge` instead of overwrite.

## Parameters

### a

`any`

base value (preferred when scalars conflict)

### b

`any`

incoming value to merge into `a`

## Returns

`any`
