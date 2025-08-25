# Common Developer Prompt Instructions for AI Code Generation

## File Organization & Project Structure

- **Split into Modular Files:** Break monolithic code into components or modules, placing each in its own file for clarity .
- **Directory Placement:** Follow a consistent folder structure. _E.g._, in a React project: “place components in `/components`, hooks in `/hooks`, and types in `/types`” .
- **Keep Related Code Together:** Co-locate supporting files (CSS, tests) with components to group related logic .
- **Limit File Size/Complexity:** Keep files and components reasonably small (e.g., under 150 lines) .

## Naming Conventions

- **Consistent Casing:**
  - Components: PascalCase
  - Hooks: camelCase with `use` prefix
  - Utilities: camelCase
  - Types/Interfaces: PascalCase
- **File/Dir Names:** kebab-case for files and directories .
- **Descriptive Names:** Avoid one-letter identifiers.
- **Standard Prefixes:** `handle` for event handlers, `is`/`has` for booleans, `use` for custom hooks .
- **Avoid Abbreviations:** Unless standard (`err`, `req`, `res`) .

## Formatting & Code Style

- **Indentation & Braces:** 4 spaces; K&R style braces (`} else {`) .
- **Strings & Semicolons:** Use single quotes; omit optional semicolons .
- **Operators:** Always use `===` not `==` .
- **Spacing:** Add spaces after keywords, before function parens, and around operators .
- **Line Length:** Max 80–100 chars .
- **Trailing Commas:** In multi-line literals .
- **Braces for Control Flow:** Always use braces for multi-line `if`/loops .
- **Style Guides:** Follow PEP 8 for Python , Black for Python , Prettier/ESLint for JS.
- **Docstrings/Comments:** Sphinx-style in Python , JSDoc in TypeScript. Comments should explain _why_, not _what_ .

## Architectural & Design Guidelines

- **Prefer Composition:** Over inheritance .
- **SOLID Principles:** One responsibility per module .
- **Functional Over Imperative:** Favor declarative code (map/filter vs loops) .
- **Modern Practices:**
  - React: use functional components, custom hooks
  - Use container/presenter separation
- **Limit Complexity:** Avoid prop drilling (prefer context/state) .

## Framework & Tool-Specific Preferences

- **Stack Context:** e.g. “React + TypeScript + Tailwind CSS” .
- **Library Conventions:** Follow Hooks Rules in React ; use TypeScript interfaces for props .
- **Preferred Tools:** Pydantic BaseModel in Python , Axios for HTTP, `react-router-dom` for routing.
- **Output Formatting:** Show file names/paths when outputting multi-file projects .

## Best Practices & Avoidances

- **Disallowed Constructs:** No global variables .
- **Avoid Tricky Features:** No lambda functions in multiprocessing ; no walrus operator (`:=`) .
- **Library Misuse:** Don’t use pandas `.append()`; use list + `pd.concat` .
- **Error Handling:** Graceful exception handling and logging .
- **No Over-Engineering:** No nested ternaries in JSX; avoid deep callbacks (use async/await).
- **Testing & Validation:** Include basic validation and simple inline tests for non-trivial functions .

---

These represent the kinds of **manual instructions developers give AI tools** (ChatGPT, Copilot, Claude, etc.) to enforce project norms and avoid pitfalls.
