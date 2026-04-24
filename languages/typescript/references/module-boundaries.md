# Module boundaries

A module's exports are a promise to every caller; invest in the boundary and keep everything else free to change.

Most TypeScript projects rot at the seams — not in the internals. Internals can be rewritten in an afternoon, but a public surface is a contract with every consumer. Your natural failure mode is to over-publish: barrel-export everything, declare an `index.ts` in every folder, expose internal types "so tests can use them," and leave the dependency graph a cyclic mess. The model produces these shapes because training data is saturated with them. They are not free — they tax build size, tree-shaking, editor latency, and the next engineer's ability to tell public from internal.

## Taxonomy

- **Public vs internal surface.**
- **Barrel files and tree-shaking.**
- **`import type` and type-only imports.**
- **Declaration files (`.d.ts`).**
- **Avoiding circular dependencies.**
- **The `exports` field in `package.json`.**
- **Encapsulation: `private` vs module scope vs file-local.**

---

## Public vs internal surface

Every file has two classes of symbols: what callers may rely on, and what is yours to change. TypeScript has no `public`/`internal` keyword at the module level — you enforce the distinction by where symbols live and what gets exported.

The working rule: a module's public surface is the named exports of its entry file. Everything reachable only through deeper imports is internal, even if exported with `export`. If you want that enforced, encode it in `package.json`'s `"exports"` field.

```ts
// billing/index.ts — the public surface
export { createInvoice, voidInvoice } from "./invoice"
export type { Invoice, InvoiceId } from "./types"

// billing/internal/tax-calculator.ts — not re-exported
// callers that reach in are crossing a boundary you should see in review
```

**DO** keep the public surface small — one entry file, a handful of named exports, plus types the caller must name.
**DO** co-locate internals with the module that owns them, not in a sibling `shared/` folder.
**DO** prefer named exports over default exports — default exports fight tree-shaking and rename badly.

**DO NOT** export symbols from the public entry "just so tests can import them."
  — Tests should import the same surface the callers use; if a unit needs direct access, colocate the test with the unit.
**DO NOT** export a database row type, an ORM model, or a framework-specific type through the public surface.
  — That leak welds every caller to your persistence layer. Map at the boundary.

---

## Barrel files and tree-shaking

A barrel is a file that re-exports the contents of a directory: `export * from "./a"; export * from "./b"; export * from "./c"`. Models generate them reflexively because they look tidy and every tutorial has one. They are, in almost every real project, a net loss.

**Why AI over-generates them.** Training data is saturated with `index.ts` barrels. The model has seen them at every module root. They feel like "good module hygiene." They are usually ceremony around a missing concept.

**Why they hurt:**

| Symptom | Cause |
|---|---|
| 300ms cold-start import where a direct import is 5ms | Bundler has to read and parse every sibling before static analysis can prune |
| Tree-shaking silently disabled | Side effects in any sibling taint the whole barrel; bundlers fall back to "keep everything" |
| Circular dependencies that only show up at runtime | `a` → barrel → `b` → barrel → `a` |
| Editor goto-definition jumps to the barrel, not the symbol | The re-export layer is an extra hop |
| Rename refactors break across the codebase | The indirection hides which file actually owns the name |

The safe barrel has two properties: (1) it only re-exports *types*, and (2) the `package.json` has `"sideEffects": false`. Both together let the bundler prove the barrel is prunable. One missing side-effect declaration and the whole barrel becomes unshakable.

```ts
// bad — the classic slop barrel
// src/index.ts
export * from "./auth"
export * from "./billing"
export * from "./users"
export * from "./utils"

// good — no barrel; callers import what they need
import { signIn } from "@acme/auth"
import { createInvoice } from "@acme/billing"
```

**DO** let callers import from the specific sub-module that owns the symbol.
**DO** set `"sideEffects": false` in `package.json` if your modules truly have no side effects, and verify that.
**DO** keep barrels when you ship a library whose *whole* surface is the exported names — and then only at the package root.

**DO NOT** generate an `index.ts` at every nesting level.
  — Each barrel is a tree-shaking hazard and a jump-to-definition detour.
**DO NOT** re-export from a barrel you also add runtime code to.
  — The runtime side effect taints the whole re-export chain.
**DO NOT** use `export *` from a barrel.
  — Named re-exports make the surface auditable; `export *` lets the surface drift silently with every new file.

---

## `import type` and type-only imports

TypeScript erases types at compile time, but an ordinary `import` is not erased — the runtime module is loaded even if you only used its types. This matters when the imported module has side effects, is heavy, or is server-only code you do not want in a client bundle.

```ts
// wrong — imports the full module at runtime for a type
import { PrismaClient } from "@prisma/client"
export function formatUser(u: PrismaClient["user"]): string { /* ... */ }

// right — type is elided; no runtime cost
import type { PrismaClient } from "@prisma/client"
export function formatUser(u: PrismaClient["user"]): string { /* ... */ }
```

TypeScript 4.5+ also supports inline `import { type Foo, bar }`, which is the right choice when one file imports a mix of types and values from the same module.

**DO** use `import type` for any import used only in type positions.
**DO** turn on `"verbatimModuleSyntax": true` in `tsconfig.json` — it makes the compiler refuse silent type-to-runtime leaks.
**DO** use `export type` when re-exporting a type so downstream `import type` still works.

**DO NOT** mix value and type imports in one statement when the type dominates.
  — The runtime import sneaks in and defeats tree-shaking for code that never needed it.

---

## Declaration files (`.d.ts`)

Most `.d.ts` files in a TypeScript codebase are generated by the compiler from `.ts` sources. You write one by hand only in a small number of cases:

| Case | Write a `.d.ts`? |
|---|---|
| Typing a third-party JavaScript package that ships no types | Yes — or publish to DefinitelyTyped |
| Augmenting an existing module (adding a field to `Window`, a Vite env var) | Yes — `declare module "..." { ... }` |
| Declaring ambient globals for a build-tool-injected variable (`__VERSION__`) | Yes |
| Typing your own TypeScript module | No — let the compiler generate it |
| "Making the types cleaner" for a module you own | No — fix the source |

```ts
// env.d.ts — ambient augmentation for a Vite-injected constant
declare const __BUILD_COMMIT__: string

// vite-env.d.ts — module augmentation
interface ImportMetaEnv {
  readonly VITE_API_URL: string
}
```

**DO NOT** hand-write `.d.ts` files that shadow your own `.ts` sources.
  — The two drift and you will spend a day hunting a bug that is the declaration lying about the implementation.
**DO NOT** paste a `.d.ts` file generated by a model for a library you did not verify exists.
  — This is slopsquatting-adjacent. Verify the package, prefer the real types.

---

## Avoiding circular dependencies

Circular imports in TypeScript compile fine and crash at runtime with `undefined` values for top-level exports that were read before the cycle resolved. Barrel files are the most common cause. The second most common is a utility module that imports from the domain module it is "helping."

Spotting them:

```ts
// billing/invoice.ts
import { formatMoney } from "./format"
export function formatInvoice(i: Invoice) { return formatMoney(i.total) }

// billing/format.ts
import { Invoice } from "./invoice"   // cycle — invoice imports format, format imports invoice
export function formatMoney(n: number) { /* ... */ }
```

The fix is almost always to move the shared type out of the domain module:

```ts
// billing/types.ts — leaf module, imports nothing in billing/
export interface Invoice { total: number; /* ... */ }

// billing/invoice.ts   — imports types and format
// billing/format.ts    — imports types only
```

**DO** push shared types to a leaf file the rest of the module imports from.
**DO** turn on `import/no-cycle` in ESLint — cheap to enforce, expensive to catch without.

**DO NOT** "fix" a cycle by reaching for dynamic `import()`.
  — You have turned a compile-time structural problem into a runtime ordering hazard.

---

## The `exports` field in `package.json`

Node and bundlers honor the `"exports"` field to control what consumers can import. Use it to enforce the public surface you designed:

```json
{
  "name": "@acme/billing",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./testing": {
      "types": "./dist/testing.d.ts",
      "import": "./dist/testing.js"
    }
  },
  "sideEffects": false
}
```

Now `import { helper } from "@acme/billing/internal/foo"` fails at the import level. Consumers cannot reach past the boundary, even by accident.

**DO** list every intentional entry point explicitly.
**DO** ship test-only helpers on a separate `"./testing"` entry so they are absent from production bundles.
**DO NOT** add a wildcard (`"./*"`) unless you have decided the *entire* folder tree is public API.
  — You have just promised to maintain every filename for the lifetime of the package.

---

## `private`, module scope, and file-local

TypeScript gives you three levels of encapsulation. Use the weakest that works:

| Level | Syntax | When |
|---|---|---|
| File-local | `const foo = ...` without `export` | The default. Reach for this first. |
| Module-scoped | `export` from a non-index file, not re-exported | Shared within a module, not across module boundaries. |
| Class `private` / `#private` | `#foo` (hard) or `private foo` (soft) | Only when you have a class and the field is invariant-bearing. `#foo` is enforced at runtime; `private` is erased. |

```ts
// prefer this — file-local helper, zero surface area
function normalize(email: string): string { return email.trim().toLowerCase() }
export function register(email: string) { return createUser(normalize(email)) }

// not this — class ceremony for a pure function
export class EmailService {
  private normalize(email: string): string { return email.trim().toLowerCase() }
  register(email: string) { return createUser(this.normalize(email)) }
}
```

---

## Export pattern comparison

| Export pattern | Bundle impact | IDE DX | Tree-shaking safe |
|---|---|---|---|
| Named export from leaf file | Minimal | Direct jump-to-definition | Yes |
| Default export from leaf file | Minimal | Rename-hostile, weak auto-import | Yes, but fragile |
| Type-only re-export barrel | Zero runtime cost | Mild extra hop | Yes |
| Value barrel (`export * from`) with `"sideEffects": false` | Conditional on bundler proving purity | Extra hop, slow goto | Usually yes, easily broken |
| Value barrel without `"sideEffects"` declared | Full subtree pulled in | Extra hop | No |
| Namespace re-export (`export * as ns`) | Per-bundler | Readable at call site | Usually no |
| Wildcard `"exports"` in `package.json` | Depends on consumer | Opaque | Depends on consumer |

Pick the top row until you have a reason not to.

---

## Common AI failure modes

**Barrel-index-re-exports-everything (5.3)** — the model drops an `index.ts` at every folder level and `export *`s its siblings. Bundle size balloons, tree-shaking silently turns off, and `goto-definition` jumps into a re-export chain instead of the symbol. The fix is structural: delete the barrels, let callers import the specific file, enforce with a lint rule that forbids `index.ts` outside the package root.

**Utils-dumping-ground (5.1)** — `utils.ts`, `helpers.ts`, `common.ts`, `shared/`. The file name describes nothing, so every unrelated helper lands there. Two weeks later it is 900 lines and three mutually-unrelated domains. The missing module is the problem, not the missing utility file. Rename by content — `formatting.ts`, `retries.ts`, `ids.ts`. If the new helper has no home, invent the concept it belongs to, not a catch-all.

**Over-split one-function-per-file (5.2)** — the mirror image. Every utility gets its own file, every file gets a matching `index.ts`, every folder gets a barrel. The import list is forty lines, the dependency graph is a forest, and nothing is easier to change. A file earns its existence by being a unit of cohesion — a concept, an interface, an invariant — not by being one function.

**Hand-written `.d.ts` that shadows source** — the model generates a `.d.ts` "for completeness" next to a real `.ts` file. The two immediately drift. If you own the source, you own the types; the compiler emits them. Declaration files are for code you *do not* own.

**Unverified module augmentation** — the model writes `declare module "some-pkg" { ... }` for a package it hallucinated. This is slopsquatting-adjacent: you now have typings for a package that does not exist, and the first `npm install` of an attacker-registered name compiles successfully.

---

### Avoid

- Barrel `index.ts` files that re-export the world.
- `export *` outside a package-root entry point.
- Default exports from leaf files.
- `utils.ts`, `helpers.ts`, `common.ts`, `shared/` — filenames that describe nothing.
- One-function-per-file splits with matching barrels.
- `import` for symbols used only in type positions — use `import type`.
- Hand-written `.d.ts` files that shadow source you own.
- Module augmentation for packages you have not verified exist.
- Circular dependencies "fixed" with dynamic `import()`.
- Exporting database rows, ORM models, or framework types through the public surface.
- `package.json` missing `"exports"` when the package has internal folders you do not want consumed.
- `"sideEffects"` unset on a package whose modules are pure.

→ See [`../SKILL.md`](../SKILL.md) for TypeScript posture and `tsconfig` discipline.
→ See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core interfaces dimension.
→ See [`../../../sublime/references/interfaces.md`](../../../sublime/references/interfaces.md) for the universal second-caller rule.
→ See [`../../../anti-patterns/file-organization.md`](../../../anti-patterns/file-organization.md) for the named catalog entries.
