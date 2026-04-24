# Strictness

Either you are strict or you are lying about your types; there is no middle ground that costs less than the two endpoints.

A TypeScript codebase without strict mode is a JavaScript codebase with expensive decoration. The compiler is not checking the things you think it is checking; the editor's hover is guessing; the generics you wrote are load-bearing on a foundation of `any` the checker silently inserted for you. The cost of turning strict on late is real — hundreds to thousands of errors in a legacy repo — but the cost of not turning it on is paid forever, in every refactor, every null deref, every `cannot read properties of undefined` at 2 AM. Strictness is the single highest-leverage configuration choice you make in TypeScript. Make it early, or pay to make it later.

## What `strict` actually turns on

`"strict": true` is a composite flag. It enables a bundle of sub-flags — and the bundle grows across TypeScript releases. Enabling `strict` today is not the same set as enabling it in 2019, and that is the point: TypeScript bakes its accumulated wisdom into the bundle so you do not have to track each flag individually.

The current composite, exactly:

- `noImplicitAny` — fail when a parameter, variable, or return type lands on `any` without you writing the word.
- `strictNullChecks` — `null` and `undefined` are not assignable to other types. The single most valuable flag TypeScript ships.
- `strictFunctionTypes` — function parameters are checked contravariantly, so callback signatures stop silently accepting the wrong shape.
- `strictBindCallApply` — `fn.bind`, `fn.call`, `fn.apply` type-check their arguments like regular calls.
- `strictPropertyInitialization` — class fields must be initialized in the constructor or declared `!` (definite assignment) or nullable.
- `noImplicitThis` — `this` inside a function must have a known type, or the function is rejected.
- `alwaysStrict` — every emitted file is `"use strict"`.
- `useUnknownInCatchVariables` — `catch (e)` gives you `unknown`, not `any`.

All of that turns on with one line. Do not enable them piecemeal to "see what breaks." Piecemeal is worse than both extremes — see below.

## Flags outside `strict` you still want

TypeScript has shipped additional strictness flags that are *not* in the `strict` composite, because each was introduced late or each breaks enough patterns that the team kept them opt-in. Turn them on anyway, or justify each omission.

- `noUncheckedIndexedAccess` — indexing into an array or record returns `T | undefined`, not `T`. Catches the real class of `arr[0].name` bugs where `arr` is empty.
- `exactOptionalPropertyTypes` — an optional property `foo?: string` becomes `string | undefined` for reads but *not* assignable from `undefined` explicitly. Forces you to pick between "missing" and "present but undefined," which you almost always actually meant to distinguish.
- `noImplicitOverride` — when you override a base-class method, you must write `override`. Prevents silent-shadow bugs when the base signature changes.
- `noFallthroughCasesInSwitch` — `case` blocks must `break`, `return`, or `throw`. Kills the accidental-fallthrough bug class outright.
- `noImplicitReturns` — every code path in a function returns, or none does. Catches the early-return path that forgot to return.
- `noUnusedLocals` / `noUnusedParameters` — prefer leaving these to ESLint (see below) so hot-path edits do not fail your build mid-thought. Opinions differ; the defensible default is ESLint-yes, tsc-no.

## Comparison table

Pick the flag, know the tax, know the risk.

| Flag | What it catches | Pain to turn on in a legacy repo | Risk of leaving it off |
|---|---|---|---|
| `noImplicitAny` | Parameters and variables the checker silently typed `any` | Very high — every untyped param surfaces. The one-time tax. | Every "typed" function is really `any` under the hood. |
| `strictNullChecks` | `null`/`undefined` slipping into non-nullable slots | Very high — most real-world null bugs live here. | `cannot read properties of undefined` at runtime, forever. |
| `strictFunctionTypes` | Callback signatures that don't actually match | Low — narrow blast radius. | Subtle event-handler and mapper bugs. |
| `strictBindCallApply` | `bind`/`call`/`apply` argument mismatches | Low. | Rare, but silent when it bites. |
| `strictPropertyInitialization` | Class fields read before initialization | Medium — noisy on ORM classes; use `!` sparingly. | Reads of `undefined` in methods that "obviously" can't hit them. |
| `noImplicitThis` | `function` expressions where `this` is untyped | Low. | `this.foo is not a function` from misbound callbacks. |
| `alwaysStrict` | Legacy non-strict-mode footguns in emitted JS | None. | `with`, octal literals, silent assignment-to-readonly. |
| `useUnknownInCatchVariables` | `catch (e)` where you treat `e` as a known shape | Low–medium — every `e.message` becomes `(e as Error).message` or a guard. | You call `.message` on a thrown string and get `undefined`. |
| `noUncheckedIndexedAccess` | `arr[i]` and `record[k]` returning `T` when runtime may be `undefined` | High — surfaces everywhere. | Out-of-bounds reads typed as valid values. |
| `exactOptionalPropertyTypes` | Conflating "missing key" with "present but undefined" | Medium — surfaces in spread/partial-update code. | Silent disagreement between optional-shape producers and consumers. |
| `noImplicitOverride` | Overriding a method that no longer exists on the base | Low. | Silent shadow when a base class renames a method. |
| `noFallthroughCasesInSwitch` | Missing `break`/`return` in `case` | Low. | The classic fallthrough bug. |

## Why partial strictness is worse than both endpoints

You will be tempted to turn on `noImplicitAny` but leave `strictNullChecks` off, or enable `strictNullChecks` for new files only. Resist.

Partial strictness is worse than no strictness because it produces *typed* code that readers trust — and that trust is misplaced. When `strictNullChecks` is off, `User.name: string` means "string or null or undefined, we're not saying." A reader sees `string`, writes code that depends on `string`, and ships a null-deref. The type system has lied with conviction. With strict off across the board, at least readers know to distrust.

Partial strictness is also worse than full strictness because the tax does not scale linearly. Fixing `noImplicitAny` errors often requires `strictNullChecks` to be on (you cannot meaningfully type a parameter without knowing if it can be `null`). Turning on the flags one at a time means re-fixing the same files three times. The cheap path is to turn everything on, fix the fire, move on.

The one legitimate reason to stage: migrating a large legacy repo where "strict: true" produces ten thousand errors on day one. In that case, use `strict: true` globally and add a narrow `// @ts-expect-error` or file-level escape hatch, tracked by a ratcheting-down script. Do not use `strict: false` with flags turned on individually.

## The `noImplicitAny: false` tax

Every untyped parameter in a "non-strict" file is silently `any`. Every `any` propagates through every expression that touches it. You wrote this:

```ts
function process(event) {
  return event.target.value.trim();
}
```

The compiler accepted it. Now `event`, `event.target`, `event.target.value`, and the return type are all `any`. The call site of `process` is `any`. The variable someone assigned its return to is `any`. `any` is a viral, compiler-level opt-out of type checking that you did not opt into; you forgot to type a parameter. The tax is every call site downstream becoming unchecked.

Strict version:

```ts
function process(event: React.ChangeEvent<HTMLInputElement>): string {
  return event.target.value.trim();
}
```

Three characters of ceremony for full checking on every caller.

## Migrating an existing codebase toward strict

You inherited a repo with `strict: false`. Here is the working order:

1. Turn on `strict: true` at the root `tsconfig.json`. Let it fail.
2. Count the errors. If it is under ~200, fix them in one sitting.
3. If it is hundreds or thousands, run `tsc --noEmit` and route the output into per-file error counts. Fix the worst offender first — one file often closes dozens of errors.
4. For files you cannot fix today, add `// @ts-expect-error` at each failing line with a short reason and a dated owner. Do *not* use `// @ts-ignore` — `expect-error` fails the build when the underlying error disappears, which is what you want.
5. Add the extra flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) one at a time, each in its own PR, with its own fix pass.
6. Add a CI check that counts `@ts-expect-error` occurrences and fails if the count increases.

Do not use `@ts-nocheck` on a file to "fix" it. That silently turns a whole file into unchecked JS and hides new defects added to that file forever.

## `ts-strictest` vs handcrafted configs

Packages like `@tsconfig/strictest` and `tsconfig/strictest` bundle the full strict-plus-extras set. They are a reasonable starting point. But they also enable stylistic flags (`noPropertyAccessFromIndexSignature`, `noUnusedLocals`) that belong in ESLint and will fail your build on work-in-progress branches.

Handcrafted is the better default: extend a base, then turn on exactly the correctness flags you want, and delegate style to ESLint. The shape of a serious `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force"
  }
}
```

That is a correctness profile. Add style flags only if you want the build, not the lint, to be the gate.

## ESLint's role vs tsc's

tsc and ESLint are not interchangeable. Use each for what it does well.

- **tsc** proves type correctness. It is slow, authoritative, and cannot reason about things the type system does not encode (dead code via side-effect, forbidden imports by path, exhaustive pattern match beyond discriminated unions, etc.).
- **ESLint with `@typescript-eslint`** catches stylistic and semantic patterns tsc misses: `no-floating-promises`, `no-misused-promises`, `prefer-nullish-coalescing`, `no-unnecessary-condition`, `switch-exhaustiveness-check`, `no-explicit-any`, `consistent-type-imports`.

Turn on the `@typescript-eslint` "strict-type-checked" preset. It catches real bugs tsc cannot — particularly around Promises and async, which are where production TypeScript code most often goes wrong.

## Common AI failure modes

**Paranoid try/catch (1.1).** With `useUnknownInCatchVariables` off, models reflexively write `catch (e) { console.log(e.message) }` and the code compiles. With the flag on, the same slop fails to compile — which is the point. You want the compiler to push back on the paranoid-catch reflex, not accommodate it. Turn the flag on and let the error teach the model.

**Fallback-masks-bug (1.3).** Models write `const n = data.count || 0` and `const items = response.items ?? []` reflexively. `strictNullChecks` does not stop this pattern, but it exposes where the fallback is masking a real missing-value branch. With strict null checks on, the type of `data.count` tells you whether the fallback is load-bearing or paranoid. Without strict null checks, you cannot tell, and the slop pattern becomes invisible.

**Hallucinated struct fields / phantom field (8 in Go, analog in TS).** Models invent properties that do not exist on real types. Strict mode catches this at the call site; non-strict mode silently types the property `any` and ships it. If your build is passing but your editor shows red squiggles, the build is lying.

### Avoid

- Shipping `strict: false` in any codebase that is not an active migration-in-progress.
  — Non-strict TypeScript is JavaScript with expensive decoration.
- Enabling sub-flags one at a time instead of `strict: true` wholesale.
  — The tax does not scale linearly; staged adoption re-fixes the same files three times.
- Using `// @ts-ignore` instead of `// @ts-expect-error`.
  — `ignore` hides errors forever; `expect-error` fails when the underlying error goes away, which is what you want.
- Dropping `@ts-nocheck` on a file to "fix" the build.
  — You have not fixed the build; you have stopped checking the file and opted every future edit of it out of typing.
- Leaving `noUncheckedIndexedAccess` off in a codebase that indexes arrays or records.
  — `arr[0].name` is typed `string` even when `arr` is empty. That is a lie the checker tells you.
- Treating tsc and ESLint as interchangeable.
  — They catch disjoint bug classes. You need both, configured for their separate jobs.
- Using `@tsconfig/strictest` without understanding which of its flags are correctness and which are style.
  — Style flags belong in ESLint so your build does not break on work-in-progress branches.
- Pretending a repo is "typed" when `noImplicitAny` is off.
  — Every untyped parameter is a silent `any` that propagates through every caller.
- Enabling `strict` on new files only via overrides without ratcheting old files down.
  — You now have two languages in one repo. Readers will guess wrong about which.

→ For the discipline around `any`, `unknown`, and `as` once strict is on, see [any-unknown-as.md](any-unknown-as.md). For the core BANs this extension inherits, see [../SKILL.md](../SKILL.md) and [../../../sublime/SKILL.md](../../../sublime/SKILL.md). For the catalog entries referenced above, see [../../../anti-patterns/over-defensive.md](../../../anti-patterns/over-defensive.md) and [../../../anti-patterns/security-and-correctness.md](../../../anti-patterns/security-and-correctness.md).
