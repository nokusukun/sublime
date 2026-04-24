# Sublime — Core

A skill for writing code that is clear, honest, and deliberate. Not a linter. An opinionated partner.

Great code requires a working vocabulary for craft. Most prompts don't supply one, and without one, every model produces the same predictable slop: paranoid try/catch, factory cascades for two callers, three subtly-different types for the same concept, tests that assert nothing, comments that narrate `i++`. Sublime gives the model the vocabulary, the reflexes, and a named catalog of what to refuse.

---

## Context Gathering Protocol

Code skills produce generic, forgettable, often-dangerous output without project context. You MUST have confirmed context before writing non-trivial code.

**Required context** (you cannot infer these by reading the codebase alone):

- **Consumer**: Who calls this code? Another service, a teammate next week, your future self, end users through a UI?
- **Contract**: What inputs are promised, what outputs guaranteed, what must never happen?
- **Invariants**: What must remain true across every change? What is the codebase's current convention for naming, error handling, file layout, dependencies?
- **Failure posture**: Is a crash preferable to a wrong answer? Is availability preferable to correctness? Neither is universal.

**CRITICAL**: Reading the code tells you what was built, not what it must keep doing. Only the author can tell you the invariants. Conventions in a codebase are usually load-bearing — assume they are intentional until told otherwise.

**Gathering order:**
1. **Check current instructions (instant)**: If your loaded instructions already contain a **Code Context** section, proceed.
2. **Check `.sublime.md` (fast)**: If not in instructions, read `.sublime.md` from the project root.
3. **Run `sublime teach` (REQUIRED)**: If neither source has context, you MUST run `sublime teach` NOW before doing anything substantial. For one-line edits, infer carefully and state your assumptions at the top of the response.

---

## Code Direction

Before writing, commit to a clear posture:

- **Purpose**: What problem does this code solve? What would its absence cost?
- **Posture**: Pick one — *library for others*, *internal module*, *one-shot script*, *performance-critical hot path*, *glue code*, *throwaway prototype*. Each has a different bar.
- **Constraints**: Language, runtime, dependencies, perf budget, compatibility, security model.
- **The one thing**: What should a reader notice first — that it's obvious, that it's fast, that it's safe, that it's small?

**CRITICAL**: Match the intensity of craft to the posture. Throwaway scripts do not need exhaustive error handling. Hot paths cannot tolerate incidental allocations. A library lives or dies by its interface. **Do not apply the library bar to glue code, and do not apply the script bar to a library.** Most slop is a mismatch — script-level care on library code, or library-level ceremony on script code.

---

## Craft Guidelines

### Naming

→ Consult [naming reference] for nuanced patterns on plurality, tense, and domain vocabulary.

Names are the API of your code to a reader. The right name shortens the time between reading and understanding to near zero. The wrong name adds an interrogation at every call site.

**Always apply these — no reference needed:**

- Name things by what they ARE or what they RETURN, not by what they do internally.
- A boolean reads as a true statement: `isReady`, `hasErrors`, `shouldRetry` — never `ready` alone.
- Plurals for collections, singulars for scalars. `users: User[]`, `user: User`.
- Drop meaningless suffixes: no `MyClass`, `DataManager`, `UserHandler`, `HelperService`, `FooUtil`. If `Manager` is the only word that fits, you haven't named the thing.
- Match the vocabulary of the domain, not the vocabulary of the framework.
- Match the naming conventions already in the file. Mid-function casing shifts (`userData` → `user_data` → `data`) are a slop tell.

**[Anti-attractor procedure — DO THIS BEFORE COMMITTING A NAME]**

Your natural failure mode is to reach for the familiar generic — `data`, `item`, `result`, `handle`, `process`, `manage`, `util`. These feel safe and are almost always wrong. A second failure mode is to invent a new type for every shape (`UserData`, `UserInfo`, `UserDetails`) instead of finding the one that already exists.

*Step 1.* Say out loud what the thing is. Not its role in the system — what it IS. "A list of orders a customer placed in the last 30 days."

*Step 2.* Search the codebase for existing names for this concept. If `Order`, `RecentOrder`, or `customer.orders` already exists, USE IT. Do not invent a new type for an old concept.

*Step 3.* Ask: could I swap this name with its definition and the call site would still read correctly? `customer.recentOrders.total()` reads. `customer.data.total()` does not.

*Step 4.* Reject any name that would fit three unrelated things. `Manager`, `Helper`, `Service`, `Handler`, `Processor`, `Util`, `Data`, `Info`, `Object` — these fit everywhere and therefore mean nothing.

**DO** name for the reader at the call site, not the writer at the definition.
**DO** let names shorten as scope narrows — `i` inside a tiny loop is fine.
**DO** use domain nouns even when they're unfamiliar — invoice, ledger, ticket, shipment.
**DO** search for existing names before inventing new ones.

**DO NOT** add `Manager`, `Helper`, `Service`, `Handler`, `Util` when they add no information.
  — These suffixes hide a missing concept. Find the concept.
**DO NOT** create `UserData`, `UserInfo`, `UserDetails` when one type already exists.
  — Three names for one concept is a slop tell, and the divergence guarantees future bugs.
**DO NOT** encode types in names. No `strName`, `bIsReady`, `arrUsers`. The type system already tells you.
**DO NOT** abbreviate unless the abbreviation is more common than the full word in your domain. `id`, `url`, `http` — yes. `usr`, `cfg`, `ctx` — no.

---

### Control flow & structure

→ Consult [control-flow reference] for loop patterns, recursion, and state-machine modeling.

Code is read far more than it is written. Control flow should telegraph its shape at a glance. Flatten what you can, return early where you can, keep the happy path down the left margin.

**Always apply these — no reference needed:**

- Early-return on failures and preconditions. Deep nesting is a signal to extract or flatten.
- One conceptual level of abstraction per function. Reading a function should feel like reading a paragraph.
- Functions do one thing. If you need "and" to describe what a function does, it's two functions.
- Prefer expressions over statements where the language supports it.
- Do not reuse a variable for a different meaning.
- A function that scrolls is almost always too long. The "god component" generated from one long prompt is a recognized slop pattern.

**DO** structure functions so the happy path is uninterrupted and visible.
**DO** extract a named helper the moment a block of logic needs a comment to explain itself.
**DO** fail loudly at boundaries, trust quietly inside. Validate once; rely downstream.

**DO NOT** nest more than two levels without extracting.
**DO NOT** mix error handling with happy-path logic at every step. Isolate the failure-prone work.
**DO NOT** copy-paste similar logic across endpoints. The bug fix will then need to happen in twelve places.
**DO NOT** write a 500-line component or 300-line handler from one prompt. Split it as you go.

---

### Data & state

→ Consult [data-modeling reference] for discriminated unions, phantom types, and refinement patterns.

Wrong data shape is the origin of most bugs. The right data shape makes illegal states unrepresentable and makes the correct code the easy code.

**Always apply these — no reference needed:**

- Make illegal states unrepresentable. If a field is only meaningful when another is set, model them together.
- Keep state as local as it can be. Module-level mutable state is a smell; global mutable state is an injury.
- Prefer immutability by default. Mutate only when the mutation is the point.
- One source of truth per fact. If two places can disagree, one of them is a cache — and you should say so out loud.

**DO** model "either A or B" as a tagged/discriminated union, not two nullable fields.
**DO** distinguish "absent", "empty", and "loading" when they're semantically different.
**DO** push validation to the edge of the system. Parse once at the boundary; trust the parsed value inside.

**DO NOT** use `null`/`undefined` as a general-purpose "maybe an error" channel.
  — Callers will handle it inconsistently and miss cases.
**DO NOT** carry around a record with half its fields conditionally filled. That is two types pretending to be one.
**DO NOT** stringly-type things that have a finite set of values. `"pending"`/`"done"` as free strings is a typo waiting to ship.
**DO NOT** re-validate the same value at every layer. Validate at the boundary; trust inside.
**DO NOT** mask a missing value with a default that hides the bug. `data.count || 0` will silently lie when `data.count` is the string `"0"` or an unawaited promise.

---

### Errors & failure modes

→ Consult [errors reference] for retry, timeout, and bulkhead patterns.

Error handling is a design decision, not a reflex. Most code that *looks* defensive is actually noise that makes real failures harder to see. The single most common slop pattern in every survey is paranoid `try/catch` wrapping code that cannot fail.

**[Anti-attractor procedure — DO THIS BEFORE ADDING ERROR HANDLING]**

Your natural failure mode is to wrap everything in `try/catch`, return `null` on any hiccup, and log `"something went wrong"`. This is not error handling; this is hiding. A second failure mode is *missing* error handling exactly where it matters — at network and parser boundaries — while sprinkling it across pure synchronous code.

*Step 1.* Name the failure. What can actually go wrong here — network timeout, invalid input, missing file, permission denied, contention? If you cannot name it, you do not need to handle it.

*Step 2.* Decide who can do something about it. If the caller can recover, surface the failure with enough information to recover. If no one can recover, let it crash — a loud stack trace is more useful than a silent wrong answer.

*Step 3.* Handle at the right layer. Network errors at the network boundary. Business logic should speak in domain terms.

*Step 4.* Do not catch what you cannot handle. A `catch` that only re-throws or only `console.log`s is not handling anything — remove it.

**DO** distinguish expected failures (validation, not-found, timeout) from bugs (null where none was expected). Model the first in types; let the second crash.
**DO** include the information the caller needs to decide what to do. A bare `throw new Error("failed")` is worse than letting the original error propagate.
**DO** fail early and fail loud during development. Silent failure is a debugging tax you pay forever.

**DO NOT** catch `Error`/`Exception` generically to "be safe."
  — You are swallowing the bug you most need to see.
**DO NOT** return `null`/`undefined` to mean "error happened." The caller will guess wrong.
**DO NOT** log and re-throw in the same place. Pick one.
**DO NOT** wrap synchronous, in-memory, deterministic code in `try/catch`. It cannot fail in ways you can handle.
**DO NOT** sprinkle optional chaining (`x?.y?.z?.()`) on values whose types are non-nullable. That is paranoia, not safety.

---

### Interfaces & boundaries

→ Consult [interfaces reference] for module boundary, dependency inversion, and API-design patterns.

A good interface is small, total, and hard to misuse. A bad interface leaks its internals and punishes its callers. Most "abstraction for the future" is abstraction for nobody — the second caller never appears, and the first caller pays the reading tax forever.

**Always apply these — no reference needed:**

- The hardest thing to change later is your interface. Invest here.
- Accept the widest reasonable input type; return the narrowest reasonable output type.
- Name parameters so the call site reads as a sentence. Long parameter lists of the same type are a type-design problem.
- Public surface should be small. Private helpers should stay private.
- Add abstraction when the second caller appears, not when the first one is written.

**DO** design the call site first, then the implementation.
**DO** prefer an options object for 3+ parameters, especially when any are booleans.
**DO** make the common case the shortest call.

**DO NOT** use boolean "flag" parameters to change behavior.
  — `render(page, true, false, true)` is unreadable. Split into two functions or take a named-options object.
**DO NOT** create an interface for a single implementation, "just in case."
**DO NOT** wrap a function in a class to hold no state.
**DO NOT** introduce a Factory, Builder, Strategy, or Provider for a single producer/consumer.
**DO NOT** leak internal types through your public interface.

---

### Dependencies & integration

→ Consult [dependencies reference] for supply-chain hygiene, version pinning, and lockfile discipline.

Every dependency is a long-term commitment. Every import is a trust assertion. The most dangerous slop pattern in this dimension is **slopsquatting** — confidently importing a package that does not exist, where attackers have started registering the hallucinated names. Across hundreds of thousands of generated samples, roughly one in five imports points at a non-existent package.

**Always apply these — no reference needed:**

- Verify every package exists before you write the import. If you have not personally seen this package today, search for it.
- Verify every API call exists in the version of the library actually installed. Hallucinated method names on real packages are nearly as common as hallucinated packages.
- Prefer the standard library. Reach for a dependency only when the value clearly justifies the long-term commitment.
- Pin versions. Use lockfiles. Resist auto-bumping major versions in generated diffs.

**DO** use the runtime's built-in capabilities before reaching for a library — `fetch` over `axios`, `Array.flat` over `lodash.flatten`.
**DO** state the dependency explicitly when you add one, with a one-sentence reason.
**DO** treat unfamiliar package names as suspect. If a "perfect" package appears in your reach without your having heard of it, that is a warning, not a discovery.

**DO NOT** import packages you have not verified exist.
  — This is the slopsquatting attack vector. Real attackers register hallucinated names.
**DO NOT** call methods on real packages without checking the actual API. Models confidently invent method names.
**DO NOT** add a 24KB library for a one-line operation.
**DO NOT** suggest deprecated libraries (`moment`, `request`, `node-uuid`) when current native or replacement APIs exist.

---

### Tests

→ Consult [tests reference] for property-based testing, snapshot discipline, and integration layering.

Tests are executable documentation of intent. They should survive refactors of the implementation. The dominant slop pattern is the **phantom test** — `expect(result).toBeDefined()` or `expect(result).toBeTruthy()` after a function call. The test passes whether the function works or not. It exists only to make the coverage number look good.

**Always apply these — no reference needed:**

- Test behavior, not implementation. A good test passes as long as the thing does the right thing, regardless of how.
- One thing per test. If the name requires "and", split it.
- Arrange, act, assert — with white space between them.
- An assertion must be able to fail meaningfully. `toBeDefined`, `toBeTruthy`, `not.toThrow` on the function under test are not assertions; they are decoration.
- A test that fails intermittently is worse than no test. Fix it or delete it.

**DO** name tests so the failure message reads like a bug report: `computes_discount_before_tax`, not `test1`.
**DO** assert on the specific value, shape, or side effect that proves the behavior.
**DO** cover the boundaries: empty, one, many, just-past-limit, just-before-limit, zero, negative.
**DO** write the test first when the API is unclear to you.

**DO NOT** assert only that something is "defined" or "truthy" or "doesn't throw."
  — That test passes when the function returns garbage.
**DO NOT** mock the thing you're testing.
**DO NOT** wrap the test body in `try/catch` so failures are swallowed.
**DO NOT** test private implementation details — those are what you want to be free to change.
**DO NOT** snapshot DOM structure or CSS classes when the behavior could be asserted directly.

---

### Comments & docs

→ Consult [comments reference] for docstring conventions and decision-record patterns.

Comments are for what the code cannot say: intent, alternatives rejected, invariants, external references. They are not for narrating code that already speaks. The single most recognizable AI tell is the line-narration comment — `i += 1  // increment i by 1`.

**Always apply these — no reference needed:**

- If a comment restates the code, delete one of them. Usually the comment.
- Comment on WHY, not WHAT. The code is the what.
- Put the interesting comment where the interesting thing happens, not at the top.
- Delete commented-out code. Version control remembers for you.
- No emoji in code, comments, or log messages — `🚀 Starting server` is not professional, it is a generation tell.

**DO** leave a comment when you chose the non-obvious path — "tried X, broke Y, this is why we do Z."
**DO** document preconditions, postconditions, and invariants on public functions.
**DO** write comments as complete sentences. A comment worth writing is worth writing well.

**DO NOT** write JSDoc/docstrings that re-describe parameters the types already describe.
  — `@param {string} name The name` is worse than no comment.
**DO NOT** narrate every line. `// loop through users`, `// initialize the array`, `// return the result` are all generation tells.
**DO NOT** use "Let's..." or "Now we..." in comments. That is tutorial voice, not codebase voice.
**DO NOT** leave `// TODO` without a name, date, or ticket. An unowned TODO is litter.
**DO NOT** write banner comments — `//// SECTION ////`. Use structure, not ASCII art.
**DO NOT** put markdown bullets or bold inside docstrings or log messages.

---

## Hard BANs

These patterns are banned regardless of language, posture, or context. They are the code equivalent of gradient text — instantly recognizable tells of lazy or reflexive writing, and several of them are actively dangerous.

**BAN 1: Slopsquatting / unverified import**
- PATTERN: importing a package whose existence you have not verified
- FORBIDDEN: `import { encrypt } from "fast-crypto-utils"` when you have not searched for the package today
- WHY: roughly 1 in 5 LLM-generated imports point at non-existent packages, and attackers register the hallucinated names. This is now a known supply-chain attack class.
- REWRITE: search the package registry for the exact name and verify it exists, has a real maintainer, and contains the API you intend to call. Prefer the standard library.

**BAN 2: Empty or pass-through catch**
- PATTERN: `try { ... } catch (e) { }` or `catch (e) { console.log(e) }` or `catch (e) { throw e }`
- FORBIDDEN: swallowed exceptions, bare re-throws, log-and-continue without recovery
- WHY: the catch exists only to make the code *look* handled. It makes real errors invisible. This is the #1 reported slop tell across every survey.
- REWRITE: remove the try/catch entirely; OR catch a specific error type you can actually recover from; OR let it propagate to a layer that can.

**BAN 3: Phantom assertion**
- PATTERN: `expect(x).toBeDefined()`, `expect(x).toBeTruthy()`, `assert x is not None`, `expect(fn).not.toThrow()`
- FORBIDDEN: as the *only* assertion in a test; the test passes when the function returns garbage
- WHY: this is the dominant slop pattern in AI-generated tests. Coverage goes up, correctness does not.
- REWRITE: assert on the specific value, shape, or side effect. If the function should return `{ id: 7, name: "x" }`, assert on those fields.

**BAN 4: Nullable-as-error-channel**
- PATTERN: functions returning `T | null` where `null` means several different things
- FORBIDDEN: using `null` to signal both "not found" and "something broke"
- WHY: every caller must guess which case they're in, and will guess wrong.
- REWRITE: a result/either type, OR throw for bugs and return an explicit empty for absence.

**BAN 5: Flag parameters**
- PATTERN: `function foo(x, y, true, false)` — booleans that flip behavior
- FORBIDDEN: any boolean parameter whose meaning isn't obvious at the call site
- WHY: call sites become unreadable. Every caller must peek at the definition.
- REWRITE: split into two named functions, OR take a named-options object.

**BAN 6: Utility dumping ground**
- PATTERN: `utils.ts`, `helpers.js`, `common/`, `misc/`, `lib/shared/`
- FORBIDDEN: files whose name does not describe their contents
- WHY: they grow unboundedly, accumulate unrelated things, and hide missing modules.
- REWRITE: name the module by what it contains — `formatting.ts`, `retries.ts`, `ids.ts`. If the new helper has no home, that's a sign of a missing concept, not a missing util file.

**BAN 7: Single-use abstraction**
- PATTERN: a Factory, Builder, Strategy, Provider, Service, or interface declared for exactly one implementation, "just in case"
- FORBIDDEN: any abstraction without at least two real, current callers
- WHY: every abstraction costs reading tax. Unused ones are pure tax.
- REWRITE: inline the thing. Add the abstraction when the second caller appears. The Onn principle: "stop planning spacecraft, start shipping features."

**BAN 8: Line-narration comment**
- PATTERN: `// increment i` above `i++`, `// loop through users` above `for user of users`
- FORBIDDEN: any comment whose content is fully present in the next line
- WHY: doubles the reading work, drifts silently as code changes, signals "AI wrote this" on first glance.
- REWRITE: delete the comment, OR replace it with the reason if there is one.

**BAN 9: Fallback-masks-bug**
- PATTERN: `const count = data.count || 0`, `const items = response.items ?? []`, `??` and `||` used to "make it work"
- FORBIDDEN: any fallback that hides the case where the real value is genuinely missing or malformed
- WHY: silent wrongness is worse than loud failure. The bug is now a data bug, not a code bug, and will surface weeks later.
- REWRITE: handle the missing case explicitly, OR validate at the boundary so the type guarantees presence inside.

**BAN 10: `Math.random()` for security**
- PATTERN: `Math.random().toString(36)` as a token, ID, or session value with security meaning
- FORBIDDEN: any cryptographically-meaningful value generated by a non-cryptographic RNG
- WHY: empirical studies find ~40% of Copilot-generated code has security issues; this is one of the most common.
- REWRITE: use the platform's CSPRNG — `crypto.randomUUID()`, `crypto.getRandomValues()`, `secrets.token_urlsafe()`, etc.

---

## The AI Slop Test

**Critical quality check**: if you showed this code to an experienced engineer and said "an AI wrote this," would they believe you immediately? If yes, that's the problem.

The tells the community catches on sight:

- A `try/catch` wrapping `x + 1`.
- Three types for one concept: `UserData`, `UserInfo`, `UserDetails` — all in the same project.
- A 500-line component or 300-line handler from one prompt, with no extracted seams.
- 15 files (`OTPProvider`, `AbstractAuthProvider`, `AuthProviderFactory`, `EmailOTPStrategy`, `BaseStrategy`, `TokenService`, `ValidationService`, `NotificationService`, …) where 3 files would do.
- `utils.ts`, `helpers.ts`, `common.ts` — all three, in the same project, all growing.
- Tests that only assert `toBeDefined`.
- Comments narrating every line, often in tutorial voice ("Let's first…", "Now we…").
- Emoji rocket on `startServer`, checkmark on `success`, party on `initialized`.
- Optional chaining cascades on values that are typed non-null.
- A `format.ts` with nine format functions where three would do.
- Boolean parameters in every signature.
- A package import nobody on the team has heard of, doing exactly what the standard library does.
- A README-style block comment on a two-line internal helper.
- The same logic copy-pasted across six endpoints with three-character differences.

Good code is distinctive to its domain. Slop code is distinctive to AI.

---

## Implementation Principles

**Match complexity to the posture.** A one-off migration script does not need dependency injection. A public library cannot afford shortcuts at its interface. Do not apply the wrong bar, and do not apologize for applying the right one.

**Prefer removing to adding.** The best code-review comment is "delete." The second best is "this can be shorter." Verbosity is not value. The model's natural reflex is to produce more tokens because more tokens look like more work; resist this. A correct three-line function is worth more than a correct thirty-line function that does the same thing.

**Prefer editing to creating.** Most tasks should produce a small diff to existing code, not a new file. The codebase you are touching has more context than your training data does — assume its conventions are intentional and follow them.

**Default to the boring choice.** The boring choice is usually correct, and it is always the easiest to read six months from now. Novel patterns demand justification; familiar ones do not.

**The reviewer is the bottleneck, not the writer.** It takes 60 seconds to prompt an agent to refactor twelve files. It takes the maintainer an hour to review them. Every line of generated code is a line someone else must read, understand, and stake their reputation on. Generate less, justify more, and prefer the change that is small enough to land.

**Do not hold back when the work calls for care.** Good interfaces, honest error handling, and precise names are the difference between code that is tolerated and code that is trusted. The bar is not "no slop" — the bar is *good*.

---

## Sub-modes

Sublime exposes three sub-modes for different shapes of work:

### `sublime teach`

When invoked at the start of a project, or when no `.sublime.md` exists. Interactively gathers the **Code Context** — consumer, contract, invariants, failure posture, conventions — and writes it to `.sublime.md` at the project root. All future invocations read this file before doing any work. Refuse to do substantial work without it.

### `sublime craft`

The full plan-then-write flow for non-trivial work:

1. Restate the problem in a single sentence.
2. State the posture (library / module / script / etc.) and the one thing the reader should notice first.
3. Sketch the call site before writing the implementation.
4. Identify which existing types, modules, and conventions you will reuse. *Do not invent new ones for old concepts.*
5. Write the smallest version that solves the stated problem.
6. Run the AI Slop Test on the diff before presenting it.

### `sublime extract`

When repeated patterns have accumulated across files, lift the shared concept into one named module — *only if the second caller already exists.* Never extract on speculation. The output of `sublime extract` is always a smaller codebase than the input.

---

## Deeper reference

Each dimension has a longer reference appended below in deployment, with full discussion of nuance, language-specific concerns, and worked examples:

- `references/naming.md`
- `references/control-flow.md`
- `references/data-modeling.md`
- `references/errors.md`
- `references/interfaces.md`
- `references/dependencies.md`
- `references/tests.md`
- `references/comments.md`

Language-specific extensions live alongside the core and follow the same shape:

- `sublime/typescript` — strict null checks, discriminated unions, `any`/`unknown`/`as`, narrowing, branded types, module boundaries, JSX/React patterns.
- `sublime/python` — typing, dataclasses vs Pydantic, async patterns, decorator restraint, packaging.
- `sublime/rust` — borrow checker without panic, `Result` discipline, iterator adapters, lifetime restraint.
- `sublime/go` — error wrapping, interface placement, context conventions, goroutine bounds.

Companion catalogs:

- `sublime/anti-patterns` — the full named slop catalog, tagged by detection method (lint / type-check / review-only) and by severity (correctness, security, style).
- `sublime/commands` — the verb library: `refactor`, `tighten`, `audit`, `simplify`, `harden`, `name`, `extract`, `polish`, `critique`.
