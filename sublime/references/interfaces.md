# Interfaces & boundaries

An interface is the one part of your code that you cannot cheaply change later; invest here, be stingy everywhere else.

Everything else in a module is a private concern — you can rename it, restructure it, rewrite it in a weekend. The interface is the contract with every caller, and every caller is a rope you have to coordinate with when you want to pull it. A good interface is small, total, hard to misuse, and stable. A bad interface leaks internals, demands ceremony, and breeds layers of adapter code as callers try to tame it. Your natural failure mode is to over-design the interface — too many parameters, too many hooks, too many "just in case" abstractions — because the prompt said "build a robust X" and robust-sounding code has options. Robust code has *few* options, chosen well.

## Taxonomy

- **Postel's Law, applied with care.**
- **Designing the call site first.**
- **Options objects vs positional arguments.**
- **The second-caller rule.**
- **The preemptive-interface trap.**
- **Module boundary placement.**

---

## Postel's Law, applied with care

"Be liberal in what you accept, conservative in what you emit." The law is older than most living languages and still correct, but models over-apply the first half and under-apply the second. The generated code accepts `string | number | null | undefined` for a field that is always a string, then returns a `{ data, error, status, meta }` quadruple when the caller just needed the data.

The right discipline:

- **Inputs**: accept the widest type you can honestly handle. If a function works on any iterable, take `Iterable<T>`, not `T[]`. If a date parser accepts ISO 8601 strings and `Date` objects, take both. But do not accept types you are going to reject on the next line — that is not liberal, that is lazy.
- **Outputs**: return the narrowest type the caller needs. Don't return the database row when the caller wants the user's display name. Don't return `{ ok: true, data, meta }` when the caller wants `data`. Every extra field is a coupling.

| Axis | Input side | Output side |
|---|---|---|
| Type width | widest reasonable | narrowest useful |
| Optionality | fill in defaults | don't invent nulls |
| Validation | parse once, at the edge | don't leak parse errors |
| Error channel | refuse malformed input loudly | return failures in the return type |

The asymmetry is the point. A caller who passes a `Date` you can handle is served. A caller who receives a four-field response object when they asked for one value is taxed.

---

## Designing the call site first

Write the caller before you write the callee. If the call site you want reads like a sentence, the signature that makes it possible is almost always the right signature. If the call site reads like an incantation, the signature is wrong no matter how elegant it looks in isolation.

```
// bad — written definition-first; call site pays
render(page, true, false, true, { maxWidth: 800 }, null, () => {})

// good — written call-site-first
render(page, { withSidebar: true, maxWidth: 800 })
```

The first version was designed by enumerating things the renderer could do. The second was designed by asking *what does the caller need to say?* and the answer was "render this page with a sidebar and a max width."

**DO** write the three or four most common call sites as comments before writing the signature.
**DO** optimize for the most frequent caller, not the most flexible one. Flexibility is easy to add and hard to remove.
**DO NOT** design an interface by listing features of the implementation.
  — Feature-list interfaces produce positional booleans and 11-argument functions.

---

## Options objects vs positional arguments

Positional arguments are correct for small, obviously-ordered inputs. `max(a, b)`, `clamp(value, min, max)`, `zip(xs, ys)`. They are wrong the moment the arguments are not obviously ordered or the number of them crosses three. And they are wrong the moment a boolean appears.

```
// unreadable at the call site
upload(file, true, false, 3, null)

// readable
upload(file, { public: true, overwrite: false, retries: 3 })
```

The options-object version has three properties the call site version cannot match: (1) arguments are named at the call site, (2) defaults are visible in the signature, (3) adding a new option is non-breaking. The cost is one pair of braces.

Rules of thumb:

| Case | Shape |
|---|---|
| 1–2 args, obvious order | positional |
| 3+ args | options object |
| any boolean | options object (or split the function) |
| any optional arg after required args | options object |
| high-frequency call, single required arg | positional for the required, optional options second: `find(id, { includeDeleted: true })` |

Boolean flag parameters are the canonical smell. `render(page, true, false, true)` is unreadable because the reader has to click through to the definition to find out what each `true` means. If you catch yourself writing a second boolean, split the function into two named functions — `renderPreview` and `renderPrint` — or move them into an options object.

---

## The second-caller rule

The moment you feel the pull toward an abstraction — a Factory, a Strategy, a Provider, an interface extracted from a class, a generic type parameter — ask: is there a second caller, today, in this codebase, that needs this? If no, stop. Write the concrete thing. Add the abstraction the day the second caller appears.

This rule defeats most of the gratuitous-abstraction family from the taxonomy. It defeats them because those abstractions are always justified with "we might need to swap this later," and the data says you won't — or if you do, the shape of the swap is not what you predicted, and the abstraction you built is the wrong one.

The second-caller rule is not a rejection of abstraction. It is a rejection of *speculative* abstraction. When the second caller shows up, the right abstraction is visible — it is the shape that both callers share. When no second caller exists, you are guessing, and the guess is almost always one of: too general, too specific, at the wrong seam.

```
// premature — one caller, one implementation, pure reading tax
interface OrderRepository {
  find(id: string): Promise<Order | null>
  save(order: Order): Promise<void>
}
class PostgresOrderRepository implements OrderRepository { /* ... */ }

// concrete — one caller, direct dependency, easy to read
class OrderStore {
  find(id: string): Promise<Order | null> { /* ... */ }
  save(order: Order): Promise<void> { /* ... */ }
}
```

The second version is what you write now. When a test needs an in-memory version *and* production needs Postgres, you extract the interface — and now it has two real callers and an obvious shape.

---

## The preemptive-interface trap

Every language has a flavor of this.

- **TypeScript**: declare an `interface IUserService` for the one `UserService` class that implements it.
- **Go**: declare an interface at the producer side for a type consumed in one place.
- **Java/C#**: the `AbstractUserServiceFactoryBuilder` cascade — interface, abstract class, factory, builder, for one concrete need.
- **Python**: an `ABC` with one subclass.
- **React**: a Context provider for a value read by one component.

The pattern is always the same: the model generated "enterprise-looking" scaffolding because the prompt had the word "production" or "robust" in it. The scaffolding has no caller that benefits. The next engineer has to trace through the layer to understand what is actually happening, and the layer is doing nothing.

Your natural failure mode is to treat the presence of a Factory or Provider as a sign of quality. It is not. It is a sign of *quality when a second caller exists*; absent that, it is ceremony.

**DO** let the concrete type be the type. A class, a function, a plain object.
**DO** introduce the interface the same commit the second caller arrives.
**DO NOT** declare an interface for a single implementation "for testability."
  — Most languages let you test concrete classes directly. If yours doesn't, the problem is the language or the framework, not the shape of the code.
**DO NOT** wrap a pure function in a class with one method.
  — The function is the interface. The class is ceremony around it.

---

## Module boundary placement

A module boundary is a promise: *these things are public, everything else is mine to change*. Place boundaries where change rates differ, not where files happen to end.

A good boundary has three properties:

1. **Small public surface.** If the file exports thirty things, it is thirty files pretending to be one.
2. **One vocabulary.** A user module speaks `User`, `UserId`, `Email`. It does not leak `pg_row`, `db_transaction`, `JsonParseError`.
3. **Stable even as internals change.** Rewriting the internals should not require changing a single caller.

Violations to recognize:

- **Utility dumping ground.** `utils.ts`, `helpers.ts`, `common.ts` — files whose name does not describe their contents. Every unrelated helper lands here because no one named the real module. Rename by content: `formatting.ts`, `ids.ts`, `retries.ts`. If the new helper has no home, the missing module is the problem, not the missing `utils`.
- **Barrel re-export.** `index.ts` that does `export * from './a'; export * from './b'; ...` — defeats tree-shaking, obscures dependency direction, and grows unboundedly. Export what callers actually need, by name.
- **Leaked internal types.** `getUser(): UserRow` where `UserRow` is the database row type. The caller now depends on your schema. Return `User`, the domain type, and map at the boundary.

---

## Common AI failure modes

**Factory/Strategy/Provider spam (2.1)** — fifteen files where three would do. The Nathan Onn example: an `OTPProvider`, `AbstractAuthProvider`, `AuthProviderFactory`, `EmailOTPStrategy`, `BaseStrategy`, `TokenService`, `ValidationService`, `NotificationService` for a 120-line feature. The rallying cry: "stop planning spacecraft, start shipping features." The fix is the second-caller rule — none of those abstractions have two callers, so none of them should exist yet.

**Single-use interface (2.2)** — an interface with exactly one implementation. The interface exists "for mocking" or "for flexibility," but there is no second caller and no second implementation. Every caller of the interface is also a caller of the concrete, which means the interface is pure reading tax.

**Wrapper-that-forwards-args (2.3)** — `function run(x) { return runRemote(x) }`. The wrapper adds no logic, no defaults, no translation. It exists because the generator produced it as scaffolding. Delete it; call `runRemote` directly.

**Premature generics (2.4)** — `function get<T, K extends keyof T>(obj: T, key: K): T[K]` with one caller that uses a concrete type. The generics serve no caller. The concrete signature is shorter, clearer, and equally type-safe when the types are known at the call site.

**Builder for two fields (2.5)** — `new UserBuilder().withName(n).withEmail(e).build()` where `{ name, email }` would do. Builders earn their keep when construction is non-trivial (many fields, order-dependent validation, partial construction across async steps). Two fields is not non-trivial.

**Provider/Context-for-one-value (2.6)** — a React Context created for a value read by exactly one component. The Context is ceremony; pass the value as a prop. Contexts earn their keep when a value is read by many components across a deep tree.

**Over-destructure-with-defaults (2.7)** — `const { a: { b: { c = d.c } = {} } = {} } = props` — three levels of destructuring with fallbacks at every level. The fallbacks hide the shape. If `props.a` is sometimes missing, that is a type problem, not a destructuring problem. Fix the type; destructure once.

---

### Avoid

- Interfaces, factories, builders, providers, and strategies with one caller.
- Boolean flag parameters that flip behavior — split the function or take an options object.
- Positional argument lists longer than two where the order is not obvious.
- Returning database rows or framework types from public functions.
- `utils.ts`, `helpers.ts`, `common.ts` — file names that describe nothing.
- Barrel `index.ts` files that re-export the world.
- Generics with one concrete caller.
- Builders for records with two fields.
- React Contexts for values read by one component.
- Destructuring cascades with defaults at every level, hiding an ill-modeled shape.
- Wrapper functions that forward their arguments unchanged.
- Designing the signature before writing the call site.
