# Branded types

TypeScript's type system is structural — two `string`s are the same type no matter what they mean — so when the meaning is load-bearing, you brand the type to force nominal distinction the compiler will enforce.

A structural type system is a gift until the day you pass `customer.id` to `cancelOrder(orderId)` and the compiler nods along because both are strings. The compiler is not wrong; you told it they were the same type. Branded types are how you tell it the truth: a `UserId` is a string you promised came from the users table, an `OrderId` is a string you promised came from the orders table, and the compiler will refuse to mix them. The cost is four lines of type machinery and a one-time constructor. The saving is every call site where the wrong id would have silently taken the wrong path.

## When nominal typing earns its keep

Not every string deserves a brand. Branding has an ergonomic tax — you cannot pass a raw string literal to a branded parameter, so callers need a constructor or a validator — and that tax is only worth paying when the distinction matters.

| Candidate | Brand it? | Why |
|---|---|---|
| `UserId`, `OrderId`, `Sku` | Yes | Interchangeable at the type level, catastrophic if swapped. |
| `Email`, `Url`, `ISODateString` | Yes if validated at boundary | The brand asserts validation has occurred. |
| `Money` / `Cents` vs raw `number` | Yes | Unit errors are silent and expensive. |
| `UserDisplayName` | Probably no | One module, one consumer, no crossover risk. |
| `TempFilePath` in a 50-line script | No | Throwaway; the ceremony exceeds the value. |
| A field inside a single function | No | Locality protects you; types do not need to. |

The rule: brand when the value crosses a module boundary and could be confused with another value of the same primitive type. Do not brand a string that only ever lives in one function.

## The `UserId` vs `string` problem

This is the canonical motivation. Without brands, every id is a string, and the compiler cannot tell them apart.

```ts
// No brand — compiler cannot help.
function cancel(orderId: string): void { /* … */ }
const user = { id: "u_123", orderIds: ["o_456"] };
cancel(user.id); // type-checks. Cancels user u_123 as if it were an order. Explodes at runtime, or worse, silently.
```

Add a brand and the mistake becomes a compile error:

```ts
type UserId  = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };

function cancel(orderId: OrderId): void { /* … */ }

declare const user: { id: UserId; orderIds: OrderId[] };
cancel(user.id);          // Error: UserId is not assignable to OrderId.
cancel(user.orderIds[0]); // OK.
```

The `__brand` field does not exist at runtime. It is a phantom — the intersection with an object type makes the two strings distinguishable to the type checker while staying identical to the JavaScript engine. Zero runtime cost, full compile-time enforcement.

## Three techniques, same idea

| Technique | Enforces at | Unwrap cost | Ergonomics | Use when |
|---|---|---|---|---|
| Intersection brand (`T & { __brand: "X" }`) | Compile time only | `as string` or a reader | Cheapest; readable. | Default. |
| Unique symbol brand (`T & { [brandSym]: "X" }`) | Compile time only | Reader function | Opaque from outside the module. | Library boundaries; you want the brand unforgeable. |
| Newtype class (`class UserId { constructor(readonly value: string) {} }`) | Compile time and runtime | `.value` | Heaviest; runtime boxing. | When you want runtime identity (`instanceof`), e.g. for discriminated unions of ids. |

All three do the same job at the type level. Intersection is the least ceremony; reach for it first. Unique symbol is for when you are publishing a library and want consumers unable to construct a brand by writing an object literal. Classes are for the rare case where you also want runtime distinction, and come with boxing and serialization cost you will pay forever.

```ts
// Intersection brand — the default.
type UserId = string & { readonly __brand: unique symbol };

// Opaque module pattern — constructor is the only way in.
export type UserId = string & { readonly [brand]: "UserId" };
declare const brand: unique symbol;
export const UserId = (raw: string): UserId => {
  if (!/^u_[a-z0-9]{10}$/.test(raw)) throw new Error(`bad UserId: ${raw}`);
  return raw as UserId;
};
```

The opaque pattern has one property worth the ceremony: outside the module, no one can mint a `UserId` without calling the constructor, so the brand is a genuine assertion. Inside the module, you control every `as UserId` and can audit them.

## Creating and unwrapping cleanly

Two operations matter: getting values *into* the branded type and getting them *out*. Both should be small, central, and named.

```ts
// One constructor per brand. One place to add validation.
export const UserId = (raw: string): UserId => {
  if (!/^u_[a-zA-Z0-9]{10,}$/.test(raw)) {
    throw new Error(`invalid UserId: ${raw}`);
  }
  return raw as UserId;
};

// A safe variant for boundary code that must not throw.
export const parseUserId = (raw: string): UserId | null =>
  /^u_[a-zA-Z0-9]{10,}$/.test(raw) ? (raw as UserId) : null;

// Unwrapping is a cast back to the primitive — but prefer accessor fns
// so the intent is visible.
export const userIdString = (id: UserId): string => id;
```

Keep the constructor in one file, export it, and forbid `as UserId` anywhere else. Two conventions make this enforceable: a lint rule that bans the cast outside the brand module, or a symbol-branded opaque type that literally cannot be cast without the module's private symbol.

Do not sprinkle `as UserId` through consumer code to silence the compiler. That defeats the whole point — the brand exists so unvalidated strings cannot pretend to be validated ones.

## Integration with Zod, Valibot, and friends

Schema libraries are the natural home for brand constructors. The schema's `parse` is the validator; the brand is its output type. The two compose cleanly.

```ts
import { z } from "zod";

export const UserIdSchema = z.string().regex(/^u_[a-zA-Z0-9]{10,}$/).brand<"UserId">();
export type  UserId       = z.infer<typeof UserIdSchema>;

// At the boundary.
const userId = UserIdSchema.parse(req.params.id); // UserId or throw.

// In the interior.
function getUser(id: UserId): Promise<User> { /* … */ }
```

Zod's `.brand<Name>()` produces an intersection-branded type; Valibot has `brand()`, io-ts has `Branded<T, B>`. They all do the same job. Pick your schema library's convention and stay in it. Do not hand-roll a brand next to a Zod-branded type for the same concept; you now have two `UserId`s that look identical and are not assignable to each other.

Boundary code — HTTP handlers, database row mappers, queue consumers — calls `parse` once. Everything downstream accepts the branded type and does not re-validate. The brand *is* the guarantee. Re-validating in every layer is phantom validation, and the point of the brand is that you never have to.

## When not to brand

- **One-module use.** A helper that takes a path and returns a path, all inside a 200-line file, does not need a `TempPath` brand. The locality already protects you.
- **Throwaway prototype.** You are exploring an API. The brand will be obsolete in an hour. Ship the raw string.
- **Serialization layer.** When you persist or send a branded value, it serializes as the underlying primitive. Do not wrap it in a class just to get JSON.stringify to emit `{ "value": "…" }`; that is a breaking change to your wire format for no compile-time gain.
- **Values that are genuinely the same type.** Two independently-scoped identifiers may *happen* to both be UUIDs. If no code path ever confuses them, a brand is ceremony that earns nothing.

## Common AI failure modes

Two patterns from the slop catalog show up especially often in branded-type code:

- **Generic-name-where-specific-needed (3.3).** The model writes `function process(id: string)` and the callers pass user ids, order ids, file ids, and session tokens through the same parameter slot. The function works for all four by accident until the day two of them collide and one row of data ends up attached to the wrong customer. Brand the ids, specify which one `process` takes, and the collision cannot happen. The fix is never "add a comment explaining which id"; it is a branded type the compiler enforces.

- **Fallback-masks-bug (1.3).** Model writes `const id = (raw as UserId) ?? DEFAULT_USER_ID` at a boundary where `raw` might be malformed. The fallback silently substitutes a default id when the input was garbage. Downstream code operates on the default user's data, the real user sees nothing, and nobody notices until the audit. A branded constructor should throw on invalid input at the boundary; the brand guarantees nothing if the constructor is lenient. Validate strictly; let it fail loudly.

### Avoid

- **Branding every string in sight** — one-module strings do not need brands; the ceremony is pure tax.
- **`as UserId` scattered across consumer code** — the cast belongs in one constructor, audited once.
- **Lenient brand constructors that fall back to a default** — the brand is now a lie.
- **Re-validating a branded value downstream** — the brand is the guarantee; re-checking is phantom validation.
- **Hand-rolling a brand next to a schema-library brand for the same concept** — two incompatible `UserId`s is the slop you were trying to prevent.
- **Classes-for-brands when intersections would do** — runtime boxing and serialization cost for no type-level gain.
- **Branding in a throwaway script** — match the ceremony to the posture.
- **Generic `id: string` parameters at module boundaries** — brand them, or you will ship a cross-entity id mix-up.
- **Serializing a branded type as a wrapped object** — the brand is compile-time only; the wire format stays a primitive.
- **Leaking the brand tag into error messages or logs** — `__brand: "UserId"` is private machinery, not user-facing data.

→ Consult [../SKILL.md](../SKILL.md) for TypeScript-wide posture.
→ Consult [../../../sublime/SKILL.md](../../../sublime/SKILL.md) for the core Sublime foundation.
→ Consult [../../../sublime/references/data-modeling.md](../../../sublime/references/data-modeling.md) for the broader case against primitive obsession.
→ Consult [../../../anti-patterns/naming-slop.md](../../../anti-patterns/naming-slop.md) for generic-name-where-specific-needed.
→ Consult [../../../anti-patterns/over-defensive.md](../../../anti-patterns/over-defensive.md) for fallback-masks-bug.
