# Data modeling

The shape of your data determines the shape of your bugs — model the domain so the compiler refuses to let the illegal ones exist.

Most runtime defects are not logic errors in the interesting sense. They are the consequence of a type that allows a state the author never intended: a record with three optional fields where only two combinations are legal, a `status: string` where only four values make sense, a payload whose `error` and `data` are both nullable and both populated. The correct code around a sloppy type is fragile. The correct code around a precise type is often obvious. Invest in the type.

## Discriminated unions over nullable parallel fields

When a value can be in one of several mutually exclusive states, model it as a tagged union. Do not model it as one record with a field per state, each nullable, each waiting to lie.

```ts
// Wrong. Four fields, sixteen representable combinations, two legal ones.
type Result = {
  data?: User;
  error?: string;
  loading?: boolean;
  timestamp?: Date;
};

// Right. Three states, each carrying exactly what it needs.
type Result =
  | { kind: "loading" }
  | { kind: "ok"; data: User; fetchedAt: Date }
  | { kind: "error"; reason: FetchError };
```

The second form makes the narrowing explicit. A branch that accesses `result.data` must first prove `result.kind === "ok"`. The first form requires a runtime check that the compiler cannot enforce and that every caller will write slightly differently.

This generalises. Any time you find yourself writing *"if A is set then B is also set but C must not be set"*, you have a discriminated union wearing the costume of a flat record. Undress it.

| Shape | When it fits | When it bites |
|---|---|---|
| Flat record, all required | Every field is always meaningful | Never, if some fields are conditional |
| Flat record, some optional | Genuine presence/absence (`middleName?`) | Masking a state machine as a record |
| Discriminated union | Mutually exclusive states | When states share 90% of their fields — extract the shared ones |
| Nested sum-of-products | State + substate | Three levels deep — flatten or name the inner sum |

## Making illegal states unrepresentable

The phrase is Yaron Minsky's and it is load-bearing. Your job as a data modeller is to arrange types so that the only values the language will let you construct are the ones that make sense. When you succeed, many of the defensive checks downstream evaporate, because the cases they were guarding against can no longer be built.

Concretely:

- A range has a `start` and an `end`. If `end < start` is illegal, use a smart constructor that returns a result, not a bare struct whose field order callers will transpose.
- An `Address` with `country: "US"` needs a `state`. An address with `country: "DE"` needs a `postalCode`. Model this as a union keyed on country, not as a record with both fields optional.
- A form field that is either `"not yet validated"`, `"validated and valid"`, or `"validated and invalid with these errors"` has three states. It is not `{ value: string; errors: string[] }` where empty `errors` conventionally means valid.

Your natural failure mode is to reach for `Record<string, unknown>` or a bag of optionals the moment the domain gets complicated. Resist. The domain got complicated because it has states. Name them.

## Parse at the boundary, trust the core

A system has edges (HTTP, disk, queues, user input, other teams' services) and an interior (your logic). At the edge, everything is `unknown` — bytes, strings, objects with the shape the sender promised and nothing more. Your job at the edge is to turn `unknown` into a typed value you can actually rely on, once. Your job in the interior is to use that typed value without re-checking.

```ts
// At the HTTP boundary.
const raw: unknown = await req.json();
const order = OrderSchema.parse(raw); // throws or returns Order.

// Everywhere downstream.
function priceFor(order: Order): Money {
  // `order.lineItems` is guaranteed non-null, typed, valid.
  // Do not re-check. Do not re-parse. Trust.
  return order.lineItems.reduce((sum, li) => sum.plus(li.total), Money.zero());
}
```

The inverse anti-pattern — validating in the controller, and in the service, and in the repository, and again in the renderer — is phantom validation. It pretends to be careful and is in fact expensive, inconsistent, and usually wrong at the one layer that matters. Write the parser at the boundary. Trust its output.

Return-values from external systems are boundary too. Treat the row you just pulled from the database the same way you treat a request body. Your ORM cannot tell you the `customer_tier` column contains one of four known values; a schema can.

## Absent, empty, loading, unknown — do not collapse them

Four states the model loves to conflate:

- **Absent.** The field does not exist for this entity. A guest checkout has no `accountId`.
- **Empty.** The field exists and contains zero elements. A cart with no items.
- **Loading.** The data is on its way and will be knowable shortly.
- **Unknown.** You have never asked. You do not know.

`null`, `undefined`, `[]`, and `""` cannot distinguish four things between them. When the distinction matters to a caller — and it almost always does in UI and in business logic — model it explicitly.

```ts
type Cart =
  | { kind: "unknown" }            // we have not fetched
  | { kind: "loading" }            // fetch in flight
  | { kind: "empty" }              // fetched, no items
  | { kind: "items"; items: Item[] };
```

A UI written against this type cannot render the skeleton loader on an empty cart, or the "your cart is empty" message while a fetch is in flight. A UI written against `items?: Item[]` will do both within a week.

## Immutability as default, mutation as the exception

Start from immutable. Mutate only when the mutation is the point — a simulation step, a hot loop where allocation dominates, an explicit state machine transition. For everything else, return a new value.

Two reasons, both pragmatic:

- **Reasoning locality.** A value you did not mutate in this function is the same value everywhere else in the function. A mutable one is not. Concurrent code multiplies this cost.
- **Diffing.** `previous` and `next` side by side are cheap to compare, cheap to render against, cheap to log for audit.

Apply this at the type level too. `readonly T[]`, `ReadonlyMap`, `ReadonlySet`, frozen records. Let the compiler enforce what you intend.

Do not confuse immutability with ceremony. Functional-update helpers (`{ ...user, email: newEmail }`) are the shortest way to express "a user with a different email." Builders and `withField` chains for records with three fields are the long way.

## Stringly-typed, enum-abused, primitive-obsessed

Three related slops:

- **Stringly-typed.** `status: string` where only `"pending" | "paid" | "refunded"` are legal. Every comparison is a typo-in-waiting.
- **Enum-abused.** Using an `enum` where a string literal union would do — and in TypeScript, enums have runtime weight and odd equality semantics that unions do not.
- **Primitive-obsessed.** `customerId: string`, `orderId: string`, `invoiceId: string` — the compiler cannot stop you from passing a customerId where an orderId is expected. Brand them.

```ts
type CustomerId = string & { readonly __brand: "CustomerId" };
type OrderId    = string & { readonly __brand: "OrderId" };

// Now the compiler knows these are different types, even though
// at runtime both are strings.
function cancel(orderId: OrderId): void { ... }
cancel(customer.id); // type error — exactly the bug you want caught.
```

Branded types cost four lines once and save you every time a function signature grows a new argument.

## Source of truth, derived values, and caches

One fact belongs in one place. When two places can hold the same fact, one of them is a cache, and you must say so — in the type, in the variable name, in the comment if nowhere else.

- `user.emailVerified: boolean` and `user.verifiedAt: Date | null` both encode the same fact. Pick one. Derive the other. (`verifiedAt !== null` is the boolean.)
- A component that holds `props.user` and `state.localUser` is a bug nursery. Decide which is authoritative and write the other off.
- A total stored alongside the line items it sums is a cache. Name it `cachedTotal` or compute it on read.

The operational form of this principle: when a fact changes, how many places need to change? If the answer is more than one, you have a synchronization bug waiting to be filed.

## Common AI failure modes

Three named patterns from the slop taxonomy show up hardest in data-modelling code:

- **Phantom validation (1.4).** Input re-validated in the controller, in the service, and in the repository — each layer slightly different, each pretending to be the last line of defence, none of them authoritative. The fix is to validate once at the boundary with a real schema and publish a typed value inside. Layers that receive a typed value do not re-check it. If they feel the need to, the type is lying and the fix is the type, not more validation.
- **Fallback-masks-bug (1.3).** `const count = data.count ?? 0`, `const items = response.items || []` — the fallback silently converts a malformed response into a plausible-looking zero or empty. The bug moves from *loud* (a crash with a stack trace pointing at the field) to *silent* (a dashboard that says zero revenue). Use the fallback only when absence is semantically legal. Otherwise fail at the boundary.
- **Assumption propagation (8.11).** Karpathy's name for the pattern where the model guesses at the shape of an object, hardcodes the guess into a literal or a type, and runs with it — no schema, no runtime check, no "let me verify this field exists." Every downstream consumer inherits the assumption. The fix is to make the assumption a type or a schema at the point of entry, so violations fail loudly at the boundary rather than mysteriously six calls deep.
- **UserData / UserInfo / UserDetails divergence (3.2).** Three subtly different types for the same concept, each born in a different prompt, each with a slightly different field set. The divergence guarantees that one day you will pass a `UserInfo` where a `UserDetails` was expected and the compiler will not save you because the shapes overlap by 90%. Search for existing types before inventing new ones. If `User` exists, use it.

### Avoid

- **Nullable-as-error-channel** — a function returning `T | null` where `null` means multiple things.
- **Stringly-typed status fields** — free strings where a union of literals is available.
- **Parallel optional fields encoding a state machine** — use a tagged union.
- **Primitive obsession** — `string` for `UserId`, `OrderId`, `Sku`; brand them.
- **Phantom validation** — re-parsing a value that was already typed.
- **Collapsed absence / emptiness / loading** — four states, one nullable collection.
- **Fallback that hides malformed input** — `?? 0` as a response to a broken API.
- **Cached fact with no name** — a value derivable from another, stored, drifting.
- **Three names for one concept** — `UserData`, `UserInfo`, `UserDetails`.
- **Mutable by default** — when you meant "immutable unless proven otherwise."
