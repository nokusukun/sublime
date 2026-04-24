# Impeccable Code — Core

A skill for writing code that is clear, honest, and deliberate. Not a linter. An opinionated partner.

Great code requires a working vocabulary for craft. Most prompts don't supply one. This skill gives the model that vocabulary — and the reflexes to avoid the patterns every model defaults to when left alone.

---

## Context Gathering Protocol

Code skills produce generic, forgettable output without project context. You MUST have confirmed context before writing non-trivial code.

**Required context** (you cannot infer these from the codebase alone):

- **Consumer**: Who calls this code? Another service, a teammate next week, your future self, end users through a UI?
- **Contract**: What inputs are promised, what outputs guaranteed, what must never happen?
- **Invariants**: What must remain true across every change?
- **Failure posture**: Is a crash preferable to a wrong answer? Is availability preferable to correctness? Neither is universal.

**CRITICAL**: Reading the code tells you what was built, not what it must keep doing. Only the author can tell you the invariants.

**Gathering order:**
1. Check instructions for a **Code Context** section. If present, proceed.
2. Read `.impeccable-code.md` from the project root.
3. If neither exists, ASK before designing new systems. For local edits, infer carefully and state your assumptions at the top of the response.

---

## Code Direction

Before writing, commit to a clear intent:

- **Purpose**: What problem does this code solve? What would its absence cost?
- **Posture**: Pick one — library for others, internal module, one-shot script, performance-critical hot path, glue code, throwaway prototype. Each has a different bar.
- **Constraints**: Language, runtime, dependencies, perf budget, compatibility, accessibility.
- **The one thing**: What should a reader notice first — that it's obvious, that it's fast, that it's safe, that it's small?

**CRITICAL**: Intensity of craft should match the posture. Throwaway scripts do not need exhaustive error handling. Hot paths cannot tolerate incidental allocations. A library lives or dies by its interface. Do not apply the library bar to glue code, and do not apply the script bar to a library.

---

## Craft Guidelines

### Naming

→ Consult [naming reference] for nuanced patterns on plurality, tense, and domain vocabulary.

Names are the API of your code to a reader. The right name shortens the time between reading and understanding to near zero. The wrong name adds an interrogation at every call site.

**Always apply these — no reference needed:**

- Name things by what they ARE or what they RETURN, not by what they do internally.
- A boolean reads as a true statement: `isReady`, `hasErrors`, `shouldRetry` — never `ready` alone.
- Plurals for collections, singulars for scalars. `users: User[]`, `user: User`.
- Drop meaningless prefixes and suffixes: no `MyClass`, `DataManager`, `UserHandler`, `HelperService`, `FooUtil`. If `Manager` is the only word that fits, you haven't named the thing.
- Match the vocabulary of the domain, not the vocabulary of the framework.

**[Anti-attractor procedure — DO THIS BEFORE COMMITTING A NAME]**

Your natural failure mode is to reach for the familiar generic — `data`, `item`, `result`, `handle`, `process`, `manage`, `util`. These feel safe and are almost always wrong.

*Step 1.* Say out loud what the thing is. Not its role in the system — what it IS. "A list of orders a customer placed in the last 30 days."

*Step 2.* Ask: could I swap this name with its definition and the call site would still read correctly? `customer.recentOrders.total()` reads. `customer.data.total()` does not.

*Step 3.* Reject any name that would fit three unrelated things. `Manager`, `Helper`, `Service`, `Handler`, `Processor`, `Util`, `Data`, `Info`, `Object` — these fit everywhere and therefore mean nothing.

*Step 4.* Check tense and plurality. Functions that return something are nouns; functions that act are verbs. Booleans state a condition. Collections are plural.

**DO** name for the reader at the call site, not the writer at the definition.
**DO** let names shorten as scope narrows — `i` inside a tiny loop is fine.
**DO** use domain nouns even when they're unfamiliar — invoice, ledger, ticket, shipment.

**DO NOT** add `Manager`, `Helper`, `Service`, `Handler`, `Util` when they add no information.
  — These suffixes almost always hide a missing concept. Find the concept.
**DO NOT** encode types in names. No `strName`, `bIsReady`, `arrUsers`.
  — The type system already tells you.
**DO NOT** abbreviate unless the abbreviation is more common than the full word in your domain. `id`, `url`, `http` — yes. `usr`, `cfg`, `ctx` — no.
**DO NOT** name a function for its implementation. `sortedByDate` beats `quickSortUsersByDate`.

---

### Control flow & structure

→ Consult [control-flow reference] for loop patterns, recursion, and state-machine modeling.

Code is read far more than it is written. Control flow should telegraph its shape at a glance. Flatten what you can, return early where you can, and keep the happy path down the left margin.

**Always apply these — no reference needed:**

- Early-return on failures and preconditions. Deep nesting is a signal to extract or flatten.
- One conceptual level of abstraction per function. Reading a function should feel like reading a paragraph, not a transcript.
- Functions do one thing. If you need "and" to describe what a function does, it's two functions.
- Prefer expressions over statements where the language supports it — assignments from `if`/`match`/`switch` beat reassignment in branches.
- Do not reuse a variable for a different meaning.

**DO** structure functions so the happy path is uninterrupted and visible.
**DO** extract a named helper the moment a block of logic needs a comment to explain itself.
**DO** fail loudly at boundaries, trust quietly inside. Validate once; rely downstream.

**DO NOT** nest more than two levels without extracting.
  — Pyramid code is almost always doing too much in one place.
**DO NOT** mix error handling with happy-path logic at every step.
  — Isolate the failure-prone work.
**DO NOT** write a function longer than one screen without a concrete reason.
  — Long functions hide seams.
**DO NOT** write clever one-liners that require a second read. Readability beats terseness.

---

### Data & state

→ Consult [data-modeling reference] for discriminated unions, phantom types, and refinement patterns.

Wrong data shape is the origin of most bugs. The right data shape makes illegal states unrepresentable and makes the correct code the easy code.

**Always apply these — no reference needed:**

- Make illegal states unrepresentable. If a field is only meaningful when another is set, model them together.
- Keep state as local as it can be. Module-level mutable state is a design smell; global mutable state is a design injury.
- Prefer immutability by default. Mutate only when the mutation is the point.
- One source of truth per fact. If two places can disagree, one of them is a cache — and you should say so out loud.

**DO** model "either A or B" as a tagged/discriminated union, not two nullable fields.
**DO** distinguish "absent", "empty", and "loading" when they're semantically different.
**DO** push validation to the edge of the system. Parse once at the boundary; trust the parsed value inside.

**DO NOT** use `null`/`undefined` as a general-purpose "maybe an error" channel.
  — You will handle it inconsistently and miss cases.
**DO NOT** carry around a record with half its fields conditionally filled.
  — That is two types pretending to be one.
**DO NOT** stringly-type things that have a finite enumerable set of values.
  — `"pending"`/`"done"` as free strings is a typo waiting to ship.
**DO NOT** reach across layers to mutate. Pass data down; return data up.

---

### Errors & failure modes

→ Consult [errors reference] for retry, timeout, and bulkhead patterns.

Error handling is a design decision, not a reflex. Most code that looks "defensive" is actually noise that makes real failures harder to see.

**[Anti-attractor procedure — DO THIS BEFORE ADDING ERROR HANDLING]**

Your natural failure mode is to wrap everything in `try/catch`, return `null` on any hiccup, and log `"something went wrong"`. This is not error handling; this is hiding.

*Step 1.* Name the failure. What can actually go wrong here — network timeout, invalid input, missing file, permission denied, contention? If you cannot name it, you do not need to handle it.

*Step 2.* Decide who can do something about it. If the caller can recover, surface the failure to the caller with enough information to recover. If no one can recover, let it crash — a loud stack trace is more useful than a silent wrong answer.

*Step 3.* Handle at the right layer. Handle a network error at the network boundary, not in business logic. Business logic should speak in domain terms.

*Step 4.* Do not catch what you cannot handle. A `catch` that only re-throws or only logs is not handling anything — remove it.

**DO** distinguish expected failures (validation, not-found, timeout) from bugs (null where none was expected). Model the first in types; let the second crash.
**DO** include the information the caller needs to decide what to do. A bare `throw new Error("failed")` is worse than letting the original error propagate.
**DO** fail early and fail loud during development. Silent failure is a debugging tax you pay forever.

**DO NOT** catch `Error` generically to "be safe."
  — You are swallowing the bug you most need to see.
**DO NOT** return `null`/`undefined` to mean "error happened."
  — The caller now has to guess whether null means "not found" or "something broke."
**DO NOT** log and re-throw in the same place. Pick one.
**DO NOT** wrap synchronous, in-memory, deterministic code in `try/catch`. It cannot fail in ways you can handle.

---

### Interfaces & boundaries

→ Consult [interfaces reference] for module boundary, dependency inversion, and API-design patterns.

A good interface is small, total, and hard to misuse. A bad interface leaks its internals and punishes its callers.

**Always apply these — no reference needed:**

- The hardest thing to change later is your interface. Invest here.
- Accept the widest reasonable input type; return the narrowest reasonable output type.
- Name parameters so the call site reads as a sentence. Long parameter lists of the same type are a type-design problem.
- Public surface should be small. Private helpers should stay private.

**DO** design the call site first, then the implementation.
**DO** prefer an options object for 3+ parameters, especially when any are booleans.
**DO** make the common case the shortest call.

**DO NOT** use boolean "flag" parameters to change behavior.
  — `render(page, true, false, true)` is unreadable. Split into two functions or take a named-options object.
**DO NOT** leak internal types through your public interface.
  — If callers must know your private enum to use your API, they're coupled to your implementation.
**DO NOT** design interfaces that only your current call site uses.
  — Good interfaces describe a shape of problem, not one caller's exact needs.

---

### Tests

→ Consult [tests reference] for property-based testing, snapshot discipline, and integration layering.

Tests are executable documentation of intent. They should survive refactors of the implementation.

**Always apply these — no reference needed:**

- Test behavior, not implementation. A good test passes as long as the thing does the right thing, regardless of how.
- One thing per test. If the name requires "and", split it.
- Arrange, act, assert — with white space between them.
- A test that fails intermittently is worse than no test. Fix it or delete it.

**DO** name tests so the failure message reads like a bug report: `computes_discount_before_tax`, not `test1`.
**DO** cover the boundaries: empty, one, many, just-past-limit, just-before-limit, zero, negative.
**DO** write the test first when the API is unclear to you.

**DO NOT** mock the thing you're testing.
**DO NOT** test private implementation details.
  — Those are what you want to be free to change.
**DO NOT** assert on log output, timing, or exact formatting unless those ARE the behavior under test.
**DO NOT** write tests that only pass because the implementation happens to do things in a specific order.

---

### Comments & docs

→ Consult [comments reference] for docstring conventions and decision-record patterns.

Comments are for what the code cannot say: intent, alternatives rejected, invariants, external references. They are not for narrating code that already speaks.

**Always apply these — no reference needed:**

- If a comment restates the code, delete one of them. Usually the comment.
- Comment on WHY, not WHAT. The code is the what.
- Put the interesting comment where the interesting thing happens, not at the top.
- Delete commented-out code. Version control remembers for you.

**DO** leave a comment when you chose the non-obvious path — "tried X, broke Y, this is why we do Z."
**DO** document preconditions, postconditions, and invariants on public functions.
**DO** write comments as complete sentences. A comment worth writing is worth writing well.

**DO NOT** write JSDoc/docstrings that re-describe parameters the types already describe.
  — `@param {string} name The name` is worse than no comment.
**DO NOT** leave `// TODO` without a name, date, or ticket. An unowned TODO is litter.
**DO NOT** write banner comments — `//// SECTION ////`. Use structure, not ASCII art.

---

## Hard BANs

Certain patterns are banned regardless of language. They are the code equivalent of gradient text — instantly recognizable tells of lazy or reflexive writing.

**BAN 1: Empty or pass-through catch**
- PATTERN: `try { ... } catch (e) { }` or `catch (e) { throw e; }`
- FORBIDDEN: swallowed exceptions, bare re-throws, `catch { return null }` where null means "error"
- WHY: the catch exists only to make the code *look* handled. It makes real errors invisible.
- REWRITE: remove the try/catch entirely, OR catch a specific error type you can actually recover from, OR let it propagate to a layer that can recover.

**BAN 2: Nullable-as-error-channel**
- PATTERN: functions that return `T | null` where `null` means several different things
- FORBIDDEN: using `null` to signal both "not found" and "something broke"
- WHY: every caller must guess which case they're in, and will guess wrong.
- REWRITE: a result/either type, or throw for bugs and return an explicit empty for absence.

**BAN 3: Flag parameters**
- PATTERN: `function foo(x, y, true)` — booleans that flip behavior
- FORBIDDEN: any boolean parameter whose meaning isn't obvious at the call site
- WHY: call sites become unreadable; every caller must peek at the definition.
- REWRITE: split into two named functions, or take a named-options object.

**BAN 4: Utility dumping grounds**
- PATTERN: `utils.ts`, `helpers.js`, `common/`, `misc/`
- FORBIDDEN: files whose name does not describe their contents
- WHY: they grow unboundedly, accumulate unrelated things, and hide missing modules.
- REWRITE: name the module by what it contains — `formatting.ts`, `retries.ts`, `ids.ts`.

**BAN 5: Comments that restate code**
- PATTERN: `// increment i` above `i++`
- FORBIDDEN: any comment whose content is fully present in the next line
- WHY: doubles the reading work, drifts silently as code changes.
- REWRITE: delete the comment, or replace it with the reason.

**BAN 6: Gratuitous abstraction**
- PATTERN: single-implementation interface, one-line wrapper, factory that returns one concrete type
- FORBIDDEN: abstractions introduced "in case we need it later"
- WHY: every abstraction costs reading tax. Unused ones are pure tax.
- REWRITE: inline the thing. Add the abstraction when the second caller appears.

**BAN 7: Clever one-liner**
- PATTERN: a line the reader must pause, re-parse, and mentally execute
- FORBIDDEN: nested ternaries deeper than one level, regex where `split` would do, chained ops crossing abstraction levels
- WHY: terse is not the same as simple.
- REWRITE: expand into named steps. The clear version is almost never slower.

**BAN 8: Type gymnastics where values would do**
- PATTERN: deeply conditional generics, phantom types, recursive mapped types solving a problem a runtime check would solve in one line
- FORBIDDEN: types no one on the team can read or debug
- WHY: types exist to help humans and compilers. If both are confused, they're failing both jobs.
- REWRITE: simpler types, a runtime assertion, or a different data shape.

---

## The AI Slop Test

**Critical quality check**: if you showed this code to an engineer and said "an AI wrote this," would they believe you immediately? If yes, that's the problem.

The tells of AI-written code:

- Every function wrapped in `try/catch` that logs and re-throws.
- Comments narrating every line.
- `utils.ts`, `helpers.ts`, `common.ts` — all three, usually in the same project.
- Defensive null checks on values that cannot be null.
- `Manager`, `Service`, `Handler` sprinkled through names that don't need them.
- Three types for the same concept: `UserData`, `UserInfo`, `UserDetails`.
- Over-genericized functions where the caller only ever passes one type.
- README-style docstrings on trivial internal helpers.
- Single-use constants extracted "for clarity" when the literal was clearer.
- A `format.ts` with nine format functions where three would do.
- Boolean parameters.
- Early-return cascades that all do the same thing.
- Simplifying things that were already simple — wrapping a one-line standard library call in a helper called `getStuff`.
- Renaming built-ins to domain-sounding names that add no information.

Good code is distinctive to its domain. AI-slop code is distinctive to AI.

---

## Implementation Principles

Match complexity to the posture. A one-off migration script does not need dependency injection. A public library cannot afford shortcuts at its interface. Do not apply the wrong bar, and do not apologize for applying the right one.

Prefer removing to adding. The best code-review comment is "delete." The second best is "this can be shorter."

Default to the boring choice. The boring choice is usually correct, and it is always the easiest to read six months from now.

Do not hold back when the work calls for care. Good interfaces, honest error handling, and precise names are the difference between code that is tolerated and code that is trusted.
