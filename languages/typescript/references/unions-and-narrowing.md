# Unions and narrowing

Discriminated unions are how TypeScript spells "either A or B" — tag the variants with a string literal, let the compiler carry the tag through control flow, and the illegal branches stop compiling.

A union without a tag is a union the compiler cannot help you navigate. `User | Guest` where both have an `email` field tells you nothing useful at a branch: you still have to feel your way through runtime checks, and every consumer will write those checks slightly differently. A union *with* a tag — `{ kind: "user" } | { kind: "guest" }` — makes narrowing mechanical. Write `if (x.kind === "user")` and inside the block you have a `User`, full stop. The whole TS narrowing machinery is built to reward this one shape.

## Discriminated unions as the TS idiom

Pick one field, make it a string literal, and make it different on every variant. That is the whole pattern. Convention in most codebases is `type` or `kind`; either is fine, but pick one and do not mix them in the same file.

```ts
type FetchState<T> =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; data: T }
  | { type: "error"; error: FetchError };

function render(state: FetchState<User>) {
  switch (state.type) {
    case "idle":    return "—";
    case "loading": return "…";
    case "success": return state.data.name; // data is typed
    case "error":   return state.error.message;
  }
}
```

The tag is load-bearing. Without it, `state.data` is `T | undefined` everywhere and every consumer writes `if (state.data)` and gets a false positive when `T` is `0` or `""`. With it, the compiler hands you `data: T` inside the `success` branch and refuses access outside.

Use string literals, not numbers, not booleans. A boolean tag maxes out at two variants and cannot grow. A number tag reads as a magic constant at every call site.

## Tagging conventions and what to avoid

| Tag style | When to use | When it bites |
|---|---|---|
| String literal (`type: "ok"`) | The default. Readable at call sites, greps cleanly. | Never, if names are descriptive. |
| Numeric literal (`code: 1`) | Wire formats where bytes matter (protocol, cache key). | Anywhere humans read the code — unreadable. |
| Boolean flag (`isError: true`) | Two-state only, and the two states truly are yes/no. | The moment you need a third state. Refactor to string. |
| TypeScript `enum` | Almost never. | Runtime weight, odd equality, imports required at call sites. |
| No tag (structural) | When variants have genuinely disjoint shapes and you are comfortable leaning on `in` checks. | Any variant overlap — `{ a; b }` vs `{ a; c }` narrows on `b`/`c` but breaks the moment you add a shared field. |

Prefer `as const` object literals if you need the tag values elsewhere: `const States = { idle: "idle", loading: "loading" } as const;`. Do not reach for `enum`.

## Exhaustiveness with `never`

The payoff of the tag is that `never` becomes a compile-time exhaustiveness check. A `switch` that handles every variant leaves `never` in the default branch; a `switch` that forgets one leaves that variant's type there instead, and the assignment fails.

```ts
function describe(state: FetchState<User>): string {
  switch (state.type) {
    case "idle":    return "idle";
    case "loading": return "loading";
    case "success": return `ok: ${state.data.name}`;
    case "error":   return `err: ${state.error.message}`;
    default:
      const _exhaustive: never = state;
      throw new Error(`unhandled state: ${JSON.stringify(state)}`);
  }
}
```

Add a new variant to `FetchState`, and this function stops compiling until you handle it. That is the single most valuable line you will write this week. Use it on any switch over a discriminated union.

Do not use `default:` to silently fall through to a sensible-looking string — you have just traded an exhaustiveness check for a silent divergence the day someone adds `{ type: "cancelled" }`.

## Type guards: `typeof`, `instanceof`, `in`, user-defined

TypeScript narrows based on four built-in operators and one user-defined escape hatch. Reach for them in this order.

| Tool | Works on | Narrows | Loses the narrowing when |
|---|---|---|---|
| `typeof` | `string`, `number`, `boolean`, `bigint`, `symbol`, `undefined`, `function`, `object` | primitive unions | Value passed to a function or reassigned. |
| `instanceof` | class instances (`err instanceof NotFoundError`) | class type | Value reassigned; cross-realm instances (iframe, worker). |
| `in` operator | distinguishing objects by presence of a property | the branch that has the key | Key was `undefined` at runtime; shared fields across variants. |
| Discriminant equality (`x.type === "ok"`) | tagged unions | the matching variant | You destructured the tag before the check. |
| User-defined guard (`x is Foo`) | anything you can write a predicate for | whatever you assert | Guard is a lie — the compiler trusts you unconditionally. |

A user-defined guard is an escape hatch, not a default. Use it when the four built-ins cannot express the check — typically for validated input at a boundary.

```ts
function isOrder(value: unknown): value is Order {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "lineItems" in value &&
    Array.isArray((value as { lineItems: unknown }).lineItems)
  );
}
```

A guard that returns true but the value is not actually a `Order` poisons everything downstream. Prefer a schema library (Zod, Valibot) at the boundary; the schema *is* the guard, and its narrowing is honest.

## Control-flow narrowing and where it breaks

TypeScript narrows within a single function's control flow. It does not narrow across function calls, across `await`, or across most closures.

```ts
function process(state: FetchState<User>) {
  if (state.type !== "success") return;
  console.log(state.data.name); // narrowed — OK.

  // Narrowing survives awaits on the SAME binding…
  await Promise.resolve();
  console.log(state.data.name); // still narrowed — OK.

  // …but NOT through a helper.
  log(state);       // inside log(), state is FetchState<User> again.
  withState(() => console.log(state.data.name)); // the closure gets the narrowed view.
}

function log(state: FetchState<User>) {
  // state.data is not accessible here — type is the full union.
}
```

Three traps worth naming outright:

1. **Shared-field destructuring before narrowing.** Pulling a shared field off the union destroys the tag link.

    ```ts
    // Wrong — `id` and `type` are now independent bindings.
    const { id, type } = state;
    if (type === "success") {
      // state.data is still accessible, but if you had destructured `data`
      // here, TS would not know which variant to pull it from.
    }
    ```

    Narrow first, destructure inside the branch.

2. **Narrowing through a function call.** Moving the check into a helper (`if (isSuccess(state))`) only narrows if that helper is declared `state is Extract<..., { type: "success" }>`. Otherwise the outer scope still sees the full union. Write the guard signature explicitly or keep the check inline.

3. **Index-access narrowing.** `map[key]` is `T | undefined` even after a `key in map` check, because `noUncheckedIndexedAccess` (which you should have on) does not integrate with narrowing. Pull the value into a `const` and narrow that: `const v = map[key]; if (v) { … }`.

## The `satisfies` operator

`satisfies` checks that a value conforms to a type without widening it — the inferred tags survive.

```ts
// Without satisfies: `config.kind` is widened to string.
const config = { kind: "api", url: "…" };

// With satisfies: `config.kind` is the literal "api".
const config = { kind: "api", url: "…" } satisfies { kind: string; url: string };
```

Use `satisfies` when you want a value checked against a contract but need the specific literal types preserved for downstream narrowing. Do not use `as` for this — `as` coerces, `satisfies` verifies. The pair to remember: `as` is a threat, `satisfies` is a promise.

## Common AI failure modes

Three patterns from the slop catalog show up hardest in union and narrowing code:

- **UserData / UserInfo / UserDetails divergence (3.2).** The model generates one union for `User` in the auth module, another for `UserProfile` in the settings module, and a third for `UserSummary` in the list view, each with a slightly different tag vocabulary (`type` here, `kind` there, `"ok"` vs `"success"`). The branches do not line up, so nothing narrows across module boundaries. Fix: search for an existing `User` union before inventing one, pick one tag name, and reuse.

- **Fallback-masks-bug (1.3).** Model writes `const name = state.type === "success" ? state.data.name : ""` and ships it. The empty string is not "no user" — it is "a bug we cannot see." If the `success` branch is the only one that has a name, callers that render the name need to handle the other branches, not receive a sentinel that silently represents them. The tag exists so callers can decide; do not collapse it back to a primitive at the boundary of the discriminant.

- **Assumption propagation (8.11).** The model decides the API returns `{ ok: true, data }` or `{ ok: false, error }`, hardcodes that shape, and never validates. Week later the API adds `{ ok: "pending" }` and every `ok` check becomes a silent truthy match on a string. Fix: parse at the boundary with a schema whose union matches the server's actual contract, and let `never` in the exhaustive switch scream at you the day the schema grows.

### Avoid

- **Boolean or numeric tags on unions** — unreadable at call sites, impossible to grow past two states.
- **`enum` where a string-literal union would do** — runtime weight and import friction for no gain.
- **Switches without a `never` exhaustiveness branch** — the compiler can check this; let it.
- **Destructuring the discriminant before narrowing** — severs the tag-to-branch link.
- **User-defined guards with no validation inside** — a guard that lies is worse than no guard.
- **Narrowing across a function call without a guard signature** — narrowing does not propagate; the helper sees the full union.
- **`as` to coerce a value into a variant** — that is not narrowing, that is hiding the bug.
- **Fallback sentinels that flatten the union back to a primitive** — the consumer needs the tag to decide.
- **Re-inventing a union that already exists in the codebase** — search first.
- **Diverging tag vocabularies across files** — `type` here, `kind` there, `"ok"` vs `"success"` — pick one.

→ Consult [../SKILL.md](../SKILL.md) for TypeScript-wide posture.
→ Consult [../../../sublime/SKILL.md](../../../sublime/SKILL.md) for the core Sublime foundation.
→ Consult [../../../sublime/references/data-modeling.md](../../../sublime/references/data-modeling.md) for the shape principle these unions enforce.
→ Consult [../../../anti-patterns/naming-slop.md](../../../anti-patterns/naming-slop.md) for the UserData divergence pattern.
