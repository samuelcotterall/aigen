[**create-agent-instructions**](/docs/api)

***

[create-agent-instructions](/docs/api/modules) / [schema](/docs/api) / ToolSchema

# Variable: ToolSchema

> `const` **ToolSchema**: `ZodObject`\<\{ `description`: `ZodString`; `examples`: `ZodDefault`\<`ZodArray`\<`ZodObject`\<\{ `call`: `ZodRecord`\<`ZodString`, `ZodAny`\>; `result`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodAny`\>\>; \}, `"strip"`, `ZodTypeAny`, \{ `call`: `Record`\<`string`, `any`\>; `result?`: `Record`\<`string`, `any`\>; \}, \{ `call`: `Record`\<`string`, `any`\>; `result?`: `Record`\<`string`, `any`\>; \}\>, `"many"`\>\>; `input`: `ZodRecord`\<`ZodString`, `ZodAny`\>; `name`: `ZodString`; `output`: `ZodOptional`\<`ZodRecord`\<`ZodString`, `ZodAny`\>\>; \}, `"strip"`, `ZodTypeAny`, \{ `description`: `string`; `examples`: `object`[]; `input`: `Record`\<`string`, `any`\>; `name`: `string`; `output?`: `Record`\<`string`, `any`\>; \}, \{ `description`: `string`; `examples?`: `object`[]; `input`: `Record`\<`string`, `any`\>; `name`: `string`; `output?`: `Record`\<`string`, `any`\>; \}\>

Defined in: src/schema.ts:3
