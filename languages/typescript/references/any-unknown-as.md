# `any`, `unknown`, and `as`

Every `any`, every `as`, and every cast-through-`unknown` is a promise you are making to the checker in exchange for a check you skipped; most of the time the promise is a lie.

TypeScript gives you three escape hatches and one safe valve. `any` disables the checker entirely at the point of use and virally downstream. `as` tells the checker "trust me," without runtime verification. `unknown` is the disciplined valve — the checker knows it does not know, and forces you to narrow before you use the value. Used with care, these are how you interoperate with the untyped world: JSON, `fetch`, `postMessage`, third-party libraries without types, dynamic eval. Used carelessly — which is the norm in AI-generated TypeScript — they turn a strict codebase into a patchwork of unchecked islands connected by fake types. The discipline is to know which one each situation calls for, and to let the checker work wherever it can.

## `any` — when it is acceptable (almost never)

`any` is the nuclear option. A value typed `any` bypasses all checks, and every expression that touches it becomes `any` too. `a.b.c.d.e()` compiles when `a` is `any`, regardless of what is actually there. A function parameter typed `any` makes the function's body unchecked; a return type `any` makes every caller unchecked.

The acceptable uses, and there are few:

- **A genuinely untyped legacy module** you are migrating, tagged with a TODO and a ticket. `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migrating from legacy/foo.js, tracked in TYPES-213`.
- **Generic type-level helpers** where `any` is the correct type theoretically: `type IsAny<T> = 0 extends 1 & T ? true : false`. Here `any` is the thing you are detecting, not a shortcut around typing.
- **Framework-internal shims** that erase types on purpose and have a separate typed facade.

That is the list. `any` in a function signature because typing was annoying is not on the list. `any` for `event` because you did not look up `React.ChangeEvent<HTMLInputElement>` is not on the list. `any` in a generic constraint because `unknown` "caused errors" is not on the list — those errors are the checker doing its job.

Every `any` in production code must be justified in a comment on the same line. If you cannot write the justification, you do not have one.

## `unknown` — the right tool most of the time

`unknown` is the top type: every value is assignable to `unknown`, and `unknown` is assignable to nothing except itself and `any`. You can hold an `unknown` in a variable, pass it, log it. You cannot use it without narrowing — no property access, no call, no arithmetic, no assignment to a narrower type.

This is what you want at every boundary where the runtime shape is not proven:

```ts
async function loadUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const raw: unknown = await response.json();
  return parseUser(raw);  // parseUser: (x: unknown) => User, throws on shape mismatch
}
```

The pattern: take `unknown` at the boundary, run it through a validator, return a typed value. Inside the module, the type is exact. Outside the boundary, the type is honestly `unknown`. This is how you earn the right to trust your types elsewhere.

`unknown` also replaces `any` in most generic code:

```ts
// was: function firstKey(obj: Record<string, any>): string | undefined
function firstKey(obj: Record<string, unknown>): string | undefined {
  return Object.keys(obj)[0];
}
```

The function only reads keys. It has no business being unchecked on the values.

## `as` — the narrow escape hatch

`as Foo` tells the checker to treat a value as `Foo`, with no runtime check. It is safe only when you have a runtime guarantee the checker cannot see — and that guarantee is rarer than people use it.

Acceptable uses:

- **Right after a boundary parser.** `const user = parseUser(raw) as User` is unnecessary because `parseUser` should already return `User`. But `JSON.parse(blob) as ConfigShape` *after* a schema validation on `blob` is the canonical legitimate shape.
- **Const assertions.** `as const` is not really a cast — it is a literal-type refinement. Use it freely: `const METHODS = ['GET', 'POST'] as const`.
- **Non-null assertion on a value you truly cannot narrow** and that your code guarantees is present: `element!.focus()` where `element` is bound to a DOM ref that always exists after mount. Justify in a comment.
- **DOM element casts** where the DOM API returns a supertype: `document.querySelector('#root') as HTMLDivElement | null`.

Not acceptable:

- `as any` to silence a complaint.
- `as Foo` to rename a type you did not construct from verified data.
- `as Foo` immediately after `JSON.parse` with no runtime validation.

Every `as` you write is a claim the checker cannot verify. If the claim is wrong, the error surfaces at runtime, far from the cast site, typed as something it is not.

## `as unknown as Foo` — the canonical smell

When the checker refuses your `as Foo` cast — "Conversion of type X to type Y may be a mistake because neither type sufficiently overlaps" — the model's reflex is to double-cast through `unknown`:

```ts
const user = form as unknown as User;
```

This is the checker shouting and you taping its mouth shut. The double-cast always compiles. It also always hides a real mismatch. Either `form` is genuinely convertible to `User` (in which case you need to describe how — usually with a mapper), or it is not (in which case you are about to ship a bug).

The fix is almost never another cast. The fix is:

- Write a mapper: `const user = toUser(form)` where `toUser` constructs a `User` from the form's fields.
- Validate at the boundary: parse the value through a schema, return `User`, stop casting.
- Fix the type: if `form` *is* a `User` and the checker disagrees, your `User` type is wrong.

If you genuinely need a double-cast — interop with an opaque third-party API where the type definitions are wrong — comment it on the same line with *why* and *what was wrong*.

## `satisfies` — when it replaces `as`

TypeScript 4.9 introduced `satisfies`. It verifies a value matches a type *without widening the value's own inferred type*. This is the tool that kills most `as` slop in configuration code.

```ts
// with as: value is widened to Config, literal types lost
const routes = {
  home: { path: '/', auth: false },
  admin: { path: '/admin', auth: true },
} as Config;

// with satisfies: still verified against Config, but keys and literals preserved
const routes = {
  home: { path: '/', auth: false },
  admin: { path: '/admin', auth: true },
} satisfies Config;

// now this works and keeps its literal type:
routes.home.path;   // '/'  (not string)
routes.admin.auth;  // true (not boolean)
```

Use `satisfies` when you want the checker to verify shape but keep the precise inferred type. Reach for `as` only when you are asserting something the checker cannot infer — a real boundary cast.

## Type predicates — `x is Foo`

A type predicate is a function whose return type asserts a narrowing for its caller.

```ts
function isUser(x: unknown): x is User {
  return typeof x === 'object'
    && x !== null
    && 'id' in x
    && typeof (x as { id: unknown }).id === 'string'
    && 'email' in x
    && typeof (x as { email: unknown }).email === 'string';
}

// at the call site:
if (isUser(raw)) {
  raw.email;  // typed as string
}
```

Predicates are honest: the type assertion travels with the runtime check. If the check passes, the narrowing is real.

The failure mode is the lying predicate:

```ts
function isUser(x: unknown): x is User {
  return x != null;  // returns true for {}, [], "hello", 42, etc.
}
```

The signature promises `User`; the body checks almost nothing. This is worse than no predicate — the call site now *trusts* the shape. Every predicate you write must actually verify every field it claims. Prefer a schema library (Zod, Valibot, Arktype) over hand-rolled predicates for anything non-trivial.

## Type assertion functions — `asserts x is Foo`

The throw-on-failure cousin of predicates.

```ts
function assertUser(x: unknown): asserts x is User {
  if (!isUser(x)) throw new TypeError('not a user');
}

assertUser(raw);
raw.email;  // narrowed, no if-block
```

Use assertion functions at boundaries where you want to fail loudly, not branch. They are the right tool for "parse, then crash if wrong" at the edge of a service.

## Comparison table

| Tool | Safe in | Unsafe in | Replacement |
|---|---|---|---|
| `any` | Genuinely untyped interop being migrated out | Production function signatures, return types, generic params | `unknown` + narrow, or a precise type |
| `unknown` | Boundary values of unknown shape, generic holders that are never used | Nowhere unsafe if narrowed before use | (already the safe default) |
| `as Foo` | After a schema validator; `as const` literals; DOM queries; definite non-null | "Make the checker stop complaining" without a runtime basis | Mapper function, schema parser, or fixed type |
| `as unknown as Foo` | Interop with demonstrably-wrong third-party types, with a comment | Every other case | Mapper, schema parse, or fix the type |
| `satisfies Foo` | Configuration objects you want verified against a type while keeping literal inference | Casting across shapes that genuinely differ | `as Foo` only if the cast is honestly a boundary assertion |
| `x is Foo` predicate | Narrowing a value after a real runtime check | Predicates whose body does not actually verify every field | Schema library (Zod/Valibot) for anything non-trivial |
| `asserts x is Foo` | Fail-loud parsers at service boundaries | Inside pure logic where narrowing-via-`if` reads better | A predicate with an `if`/`else` branch |
| `!` (non-null) | A value you *know* is present (bound refs, post-mount DOM, just-checked-above) | As a reflex after every optional property access | `if (x == null) throw ...` or a real narrow |

## The discipline at a glance

1. **Never reach for `any`.** If the type is unknown, write `unknown`. If the type is dynamic, write the union. If the type is interop, write the third-party type or a shim.
2. **Prefer `satisfies` to `as`.** Most `as` in configuration-like code is a habit; `satisfies` does the same verification and preserves inference.
3. **Cast only at boundaries.** `JSON.parse`, `postMessage`, `fetch().json()`, `eval`, `Function.prototype.apply` return unknown shapes. Validate, *then* type. Do not cast the raw value.
4. **Every `as` and every `any` gets an inline comment explaining itself.** If you cannot write the justification, you do not have one, and the cast comes out.
5. **Predicates must verify what they promise.** A lying `x is Foo` is worse than no predicate — the call site trusts it.

## Common AI failure modes

**`any` abuse (from Category 12 / language-specific).** Models default to `any` whenever typing would require thought. Event handlers are `event: any`, generic constraints are `<T extends any>`, return types are elided. Each `any` propagates through every caller. With strict mode on and `@typescript-eslint/no-explicit-any` enabled at "error," the pattern stops being invisible. Use `unknown` and a type guard instead; if the type is truly generic, constrain with `unknown` or a structural interface, not `any`.

**`as` cast-through-unknown (from Category 12 / language-specific).** The canonical TypeScript slop: `form as unknown as User`. The model saw the checker complain, reached for the double-cast, and shipped. The pattern is recognizable on sight — any `as unknown as X` without a one-line comment explaining the boundary is a rewrite candidate. Replace with a mapper, a schema, or a corrected type. If it genuinely needs to be a double-cast (rare third-party interop), the comment is the artifact of review — without it, the cast is slop.

**Fabricated API call (8.1, from the core anti-patterns catalog).** Related failure: a `as Foo` after calling a function that does not exist on the object. The model types the variable as `Foo`, calls `.magicallyEncrypt()` on it, and the cast hides the missing method from the checker until runtime. The cast is not the root problem here — the fabricated call is — but the cast is how the slop compiles. A strictly-typed variable without a cast would have failed at the point of the fabricated call. See [security-and-correctness.md](../../../anti-patterns/security-and-correctness.md) for the full entry.

### Avoid

- `any` in any production function signature, return type, or generic parameter.
  — `any` disables the checker virally; every downstream caller becomes unchecked.
- `as Foo` immediately after `JSON.parse` or `await response.json()` with no runtime validation.
  — You are asserting a shape you have not verified; the runtime will disagree eventually.
- `as unknown as Foo` without an inline comment explaining the interop need.
  — This is the canonical TypeScript slop signature. Replace with a mapper, a schema, or a corrected type.
- `as any` anywhere.
  — Combines the worst of both tools: the checker stops checking *and* the intent is invisible.
- Non-null `!` as a reflex after every optional chain.
  — It is a claim the checker cannot verify; wrong once, it crashes at runtime.
- Type predicates (`x is Foo`) that do not verify every field the return type promises.
  — A lying predicate is worse than no predicate; the call site trusts the lie.
- Reaching for `as` when `satisfies` would do.
  — `as` widens and forgets; `satisfies` verifies and preserves.
- Using `// @ts-ignore` next to a failing cast.
  — `// @ts-expect-error` with a reason is the disciplined version; `ignore` never stops lying.
- Casting values returned by `fetch`, `postMessage`, `eval`, `Function`, `require` without a schema parse at the boundary.
  — These are the canonical entry points for fabricated shapes; validate, do not cast.
- Writing `<T extends any>` or `<T = any>` in generic parameters.
  — `unknown` is the right default; `any` opts every caller out of typing.

→ For the strictness flags that make these patterns visible, see [strictness.md](strictness.md). For the core BANs this extension inherits — Fabricated API call and Fallback-masks-bug in particular — see [../SKILL.md](../SKILL.md) and [../../../sublime/SKILL.md](../../../sublime/SKILL.md). For the catalog entries referenced above, see [../../../anti-patterns/security-and-correctness.md](../../../anti-patterns/security-and-correctness.md) and [../../../anti-patterns/over-defensive.md](../../../anti-patterns/over-defensive.md).
