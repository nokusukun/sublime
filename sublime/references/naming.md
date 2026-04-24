# Naming

A name is a contract with every future reader that the thing inside will match what the word predicts.

When the contract holds, reading compounds: a call site becomes a sentence and the reader can skim. When the contract breaks — when `data` holds a specific customer's last-30-day orders, when `UserInfo` has three slightly different shapes in three files, when `process` means "validate-and-persist-and-notify" — every read becomes an interrogation. Most of the naming slop models produce is not wrong in isolation; it is wrong because the model chose a name that could fit a dozen unrelated things and therefore describes none of them.

## The cost model

Every name is paid for twice. You pay once when you write it. Readers pay every time they encounter it for as long as the code lives. Generic names minimize writer cost and maximize reader cost — the trade is almost always wrong, because the writer is one person and readers are everyone else for years.

Your natural failure mode is to reach for the safe middle: `data`, `item`, `value`, `result`, `handler`, `manager`, `process`, `info`. These feel harmless because they fit everywhere. That is exactly the defect. A name that fits everywhere narrows nothing at the call site, so the reader must open the definition to understand the call. Multiply that by every reader and every call site and you have built a codebase that can only be understood by reading all of it.

## Plurality and tense

Names carry grammatical information the type system cannot enforce as cheaply. Use it.

- Collections are plural, scalars are singular: `users: User[]`, `user: User`. A singular name on a collection is a bug in waiting — somebody will iterate, and somebody else will index.
- Booleans read as a true statement: `isReady`, `hasErrors`, `shouldRetry`, `canEdit`. A bare `ready` reads as an adjective and a reader will wonder whether it is a value, a flag, or a state name.
- Predicates on functions follow the boolean rule: `isValid(x)`, `hasPermission(user)`, `canDelete(post)`. A function called `valid(x)` sounds like a constructor.
- Async functions are still named for what they return, not the fact of asynchrony. `fetchUser` is fine; `fetchUserAsync` is Hungarian resurgence — see §Common AI failure modes.
- Past-tense verbs for events, present-tense verbs for commands: `onUserCreated`, `createUser`. Mixing the two (`onCreateUser`) hides whether the handler fires before or after the fact.

## Domain vocabulary beats framework vocabulary

A codebase has two dialects in it: the one from the business and the one from the framework. When they conflict, the business dialect wins at the layer where the business lives, and the framework dialect is confined to the plumbing.

Call them `Invoice`, `Shipment`, `Ledger`, `Ticket`, `Claim` — whatever the people paying the bills call them. Do not call them `Record`, `Entity`, `Model`, `DTO`, `Resource`. Those are category names, not thing names; they exist to group unrelated concepts and are therefore useless at any specific call site. A `Customer` knows something. A `CustomerEntity` knows it is an entity, and the reader still has to ask what kind.

The test: read the name to someone who works on the business side of this company. If they recognize the word, you picked a domain name. If their eyes glaze, you picked a framework name.

## The cost of generic names

Here is what the generic-name tax looks like in practice. The call site is the same problem in two dialects:

```
// generic
const data = await fetchUserData(id);
const result = processData(data);
return handleResult(result);

// specific
const orders = await fetchRecentOrders(customerId);
const total = sumOrderAmounts(orders);
return chargeCustomer(customerId, total);
```

The generic version tells you nothing about the domain. The specific version tells you what the code does without opening a single helper. The generic version will be copied, adapted, and spread; the specific version is too pointed to copy, which forces the next author to think about what their version actually does.

## The anti-attractor procedure for names

Run this before committing to any non-trivial name. It costs ten seconds and saves a month of reading tax.

*Step 1.* Say out loud what the thing IS. Not its role in the system — what it is. "A list of orders a customer placed in the last 30 days." "The result of validating a signup form." "A signed URL valid for one hour."

*Step 2.* Search the codebase for a name that already exists for this concept. If `Order`, `RecentOrder`, or `customer.orders` is already there, use it. Inventing a new type for an existing concept is how `UserData`, `UserInfo`, and `UserDetails` end up coexisting in the same repo.

*Step 3.* Write the call site as if the name already existed. `customer.recentOrders.total()`. `signupResult.errors`. `uploadUrl.expiresAt`. If the call site reads, the name is good. If it reads only after you open the definition, it isn't.

*Step 4.* Reject any name that would fit three unrelated things. `Manager`, `Helper`, `Service`, `Handler`, `Processor`, `Util`, `Data`, `Info`, `Object`, `Context`, `Core`, `Base` — these describe nothing. If one of them is the only word that fits, you have not named the thing; you have given up and labelled the slot it sits in.

## Naming by scope

A name's precision should rise with its lifetime. The bigger the scope, the more careful the name.

| Scope | Lifetime | Naming bar | Examples of acceptable names |
|---|---|---|---|
| Loop-local index | A few lines | Short and conventional | `i`, `j`, `k`, `c` for character |
| Function-local variable | One function | Specific enough to read | `total`, `candidate`, `nextAttempt` |
| Module-private export | One file | Full domain noun | `normalizedAddress`, `recentOrders` |
| Public function | Cross-module | Action + subject | `formatInvoice`, `chargeCustomer` |
| Public type | Cross-module, cross-version | Domain noun only | `Invoice`, `Customer`, `Shipment` |
| Public package | Forever | One unambiguous word or phrase | `stripe`, `pdfkit`, `sharp` |

`i` inside a four-line loop is correct. `i` as a module-level variable is a bug. `user` as a local variable in a function that operates on one user is fine. `User` as a type that exists alongside `UserData`, `UserInfo`, and `UserDetails` is a disaster. Match the precision to the distance a reader has to travel to see the definition.

## Boolean, predicate, and async conventions

| Shape | Pattern | Example | Anti-example |
|---|---|---|---|
| Boolean field | `is` / `has` / `should` / `can` | `isArchived`, `hasPayment`, `shouldRetry` | `archived`, `payment`, `retry` |
| Predicate function | Verb phrase that asserts a fact | `isValid(input)`, `hasAccess(user, doc)` | `validate(input)` when it returns bool |
| Validator that throws | Imperative verb | `assertValid(input)`, `requirePermission(user)` | `validate(input)` when it throws |
| Transformer | `to` + target shape | `toISOString`, `toDTO`, `toCents` | `convert`, `transform`, `normalize` |
| Factory | `create` / `make` / `from` | `createInvoice`, `Invoice.fromRow` | `build` + no context |
| Async action | Verb, no suffix | `fetchUser`, `uploadFile` | `fetchUserAsync`, `uploadFilePromise` |
| Event handler | `on` + past tense | `onUserCreated`, `onOrderShipped` | `onCreateUser`, `handleUser` |
| Side-effect emitter | Imperative verb | `logRequest`, `emitMetric` | `doLogging`, `processMetric` |

The distinction between `validate` and `isValid` is not pedantry. They do different things. `isValid(x)` is a question and returns a boolean; `assertValid(x)` is an enforcement and throws. A single `validate(x)` that sometimes does one and sometimes the other will be misused by half its callers.

## Consistency inside a file, inside a module, across a codebase

Names are a visual system. Mid-function shifts from `userData` to `user_data` to `data` are a slop tell and almost always produced by a model stitching patterns from different training examples — see Inconsistent-casing-shifts below.

Match the conventions already in the file. If the codebase uses `snake_case` for functions and `PascalCase` for types, do not introduce `camelCase` because the reflex says it. If existing types are `Order`, `Invoice`, `Shipment`, do not introduce `OrderEntity` or `InvoiceModel` because a framework tutorial called them that. The conventions are load-bearing. Violating them creates exactly the cognitive cost you are trying to avoid.

## Common AI failure modes

**Manager / Helper / Service / Handler / Util suffix proliferation (3.1).** You will feel the urge to attach `Manager`, `Service`, `Helper`, `Handler`, `Util`, `Processor`, or `Controller` to a class because the concept is vague. The suffix is the vagueness talking. A `PaymentManager` that takes a payment and charges a card is a `Payment` plus a verb that charges it. The name hides a missing concept. If the only word that fits is `Manager`, stop naming and go find the concept.

**UserData / UserInfo / UserDetails divergence (3.2).** Three types for one concept is the most common AI tell in projects with more than a few sessions of generation. Each prompt invents a fresh name because it cannot see the previous session's invention. The three types diverge field-by-field and callers then drift. The defect is not the duplication — it is the refusal to search before inventing. Search first. Extend the type that already exists. Do not invent a sibling because it feels cleaner than reading the existing one.

**Generic-name-where-specific-needed (3.3).** `data`, `item`, `result`, `value`, `obj`, `temp`, `info`, `thing` as the final name of a meaningful variable. Acceptable for ten-line transformations where the variable dies in two lines. Never acceptable at a module or API boundary. Treat `data` as an unfilled placeholder, not a name.

**Tutorial-scale descriptive names (3.4).** `userProfileDataResponseObject`, `isFeatureToggleEnabledForBetaUsers`, `totalUserInputCharacterCount` in a ten-line function. The impulse is to pack every relevant fact into the identifier because the model has no confidence about what the reader knows. Trust the surrounding context. A variable in a function called `renderUserProfile` does not need `UserProfile` in its name.

**Inconsistent-casing-shifts mid-function (3.5).** `userData` → `user_data` → `data` inside one thirty-line function. A sign the model stitched three different training examples together. Read your own code before committing; if the casing drifts, unify it.

**Hungarian resurgence (3.6).** `strName`, `intAge`, `arrUsers`, `bIsReady`, `fnCallback`. The type system already knows. Encoding types in the identifier pollutes every call site with information the reader gets for free from hovering. This idiom died in the 1990s for a reason; do not revive it.

### Avoid

- Suffixing `Manager`, `Helper`, `Service`, `Handler`, `Util`, `Processor` onto a class to paper over a missing concept.
- Inventing `UserData`, `UserInfo`, `UserDetails` variants when one type already exists in the codebase.
- Shipping a module-level variable named `data`, `item`, or `result`.
- Packing tutorial-length descriptions into a local variable name that lives for four lines.
- Drifting casing inside a single function or across a single module.
- Encoding the type in the identifier: `strName`, `arrUsers`, `bIsReady`, `fnCallback`.
- Naming async functions with an `Async` suffix the runtime has not asked for.
- Using framework category nouns — `Entity`, `Model`, `DTO`, `Resource` — where a domain noun is available.
- Using a bare noun for a boolean (`ready`, `error`, `complete`). Prefix with `is`, `has`, `should`, `can`.
- Introducing a synonym for a concept the codebase already has a word for.
