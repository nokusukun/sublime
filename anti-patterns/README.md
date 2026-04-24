# Sublime — Anti-pattern catalog

Named failure modes of LLM-generated code. Use this catalog as a field guide: if you recognize a pattern here in your own output, rewrite.

Every entry has the same shape — *Pattern · Forbidden example · Why it hurts · Rewrite · See in `/sublime`* — and three tag axes so entries are filterable at a glance.

## Tags

**First axis — kind:**
- `AI-slop` — visible tells of LLM-generated code. If an experienced reviewer would say "an AI wrote this" on sight, it's AI-slop.
- `Quality` — general design mistakes that are not AI-specific but show up constantly in LLM output.

**Second axis — detectability:**
- `Lint` — statically detectable by AST or regex. A linter can catch it.
- `Type-check` — the type system will catch it if the types are tight enough.
- `Review` — needs semantic understanding. No tool catches it without human eyes or an LLM review pass.

**Third axis — scope:**
- `Universal` — language-agnostic.
- `Lang:<x>` — scoped to one language (TS, Python, Rust, Go, etc.).

## Categories

- [Over-defensive programming](over-defensive.md) — paranoid try/catch, phantom validation, fallbacks that hide bugs.
- [Gratuitous abstraction](gratuitous-abstraction.md) — factories, builders, and interfaces with one caller.
- [Naming slop](naming-slop.md) — suffix proliferation, generic-where-specific, type divergence.
- [Comment slop](comment-slop.md) — line narration, tutorial voice, emoji, empty TODOs.
- [File organization](file-organization.md) — `utils.ts`, barrel re-exports, paranoid layering.
- [Boilerplate and ceremony](boilerplate-and-ceremony.md) — empty classes, trivial getters, `if __name__ == "__main__"` on libraries.
- [Stylistic tells](stylistic-tells.md) — emoji logs, entry/exit logging, markdown in docstrings.
- [Security and correctness](security-and-correctness.md) — fabricated APIs, slopsquatting, SQL concatenation, `Math.random` for tokens.
- [Testing slop](testing-slop.md) — phantom assertions, tautological tests, catch-all wrappers.
- [Architectural slop](architectural-slop.md) — microservices for a function, Clean-Architecture-7-layers-for-CRUD, god-prompt components.
- [Dependency slop](dependency-slop.md) — lodash-for-isEmpty, axios-when-fetch-suffices, deprecated suggestions.
- [Review burden](review-burden.md) — comprehension debt, dead-code accumulation, PR-slop.

## Alphabetical index

| Pattern | Tags | Category |
|---|---|---|
| [AI-review-noise](review-burden.md#ai-review-noise) | `AI-slop` · `Review` · `Universal` | Review burden |
| [All-caps ceremony constants](stylistic-tells.md#all-caps-ceremony-constants) | `AI-slop` · `Lint` · `Universal` | Stylistic tells |
| [Assumption propagation](security-and-correctness.md#assumption-propagation) | `Quality` · `Review` · `Universal` | Security & correctness |
| [Barrel index.ts re-exports everything](file-organization.md#barrel-index-ts-re-exports-everything) | `Quality` · `Lint` · `Lang:TS` | File organization |
| [Builder for two fields](gratuitous-abstraction.md#builder-for-two-fields) | `AI-slop` · `Review` · `Universal` | Gratuitous abstraction |
| [Bypassing framework CSRF/CORS](security-and-correctness.md#bypassing-framework-csrf-cors) | `Quality` · `Lint` · `Universal` | Security & correctness |
| [Catch-all test](testing-slop.md#catch-all-test) | `AI-slop` · `Lint` · `Universal` | Testing slop |
| [Clean-Architecture-7-layers-for-CRUD](architectural-slop.md#clean-architecture-7-layers-for-crud) | `AI-slop` · `Review` · `Universal` | Architectural slop |
| [Commented-out "just in case" code](comment-slop.md#commented-out-just-in-case-code) | `AI-slop` · `Lint` · `Universal` | Comment slop |
| [Comprehension debt](review-burden.md#comprehension-debt) | `Quality` · `Review` · `Universal` | Review burden |
| [Console.log as observability strategy](stylistic-tells.md#console-log-as-observability-strategy) | `AI-slop` · `Lint` · `Universal` | Stylistic tells |
| [`const noop = () => {}`](boilerplate-and-ceremony.md#const-noop-) | `AI-slop` · `Lint` · `Universal` | Boilerplate |
| [Constructor-that-only-assigns-fields](boilerplate-and-ceremony.md#constructor-that-only-assigns-fields) | `AI-slop` · `Lint` · `Universal` | Boilerplate |
| [Convergence cliff](review-burden.md#convergence-cliff) | `Quality` · `Review` · `Universal` | Review burden |
| [Copy-paste architecture](architectural-slop.md#copy-paste-architecture) | `Quality` · `Lint` · `Universal` | Architectural slop |
| [Dead-code accumulation](review-burden.md#dead-code-accumulation) | `Quality` · `Lint` · `Universal` | Review burden |
| [Deep-nested paranoid layering](file-organization.md#deep-nested-paranoid-layering) | `AI-slop` · `Lint` · `Universal` | File organization |
| [Deprecated-suggestion](dependency-slop.md#deprecated-suggestion) | `AI-slop` · `Lint` · `Universal` | Dependency slop |
| [Drive-by one-shot PR](review-burden.md#drive-by-one-shot-pr) | `AI-slop` · `Review` · `Universal` | Review burden |
| [Emoji comments](comment-slop.md#emoji-comments) | `AI-slop` · `Lint` · `Universal` | Comment slop |
| [Emoji in log messages](stylistic-tells.md#emoji-in-log-messages) | `AI-slop` · `Lint` · `Universal` | Stylistic tells |
| [Empty interface / marker class](boilerplate-and-ceremony.md#empty-interface-marker-class) | `Quality` · `Lint` · `Universal` | Boilerplate |
| [Empty TODO](comment-slop.md#empty-todo) | `AI-slop` · `Lint` · `Universal` | Comment slop |
| [Enterprise-patterns-in-scripts](architectural-slop.md#enterprise-patterns-in-scripts) | `AI-slop` · `Review` · `Universal` | Architectural slop |
| [Event-driven-for-synchronous-workflow](architectural-slop.md#event-driven-for-synchronous-workflow) | `Quality` · `Review` · `Universal` | Architectural slop |
| [Fabricated API call](security-and-correctness.md#fabricated-api-call) | `AI-slop` · `Lint` · `Universal` | Security & correctness |
| [Factory/Strategy/Provider spam](gratuitous-abstraction.md#factory-strategy-provider-spam) | `AI-slop` · `Review` · `Universal` | Gratuitous abstraction |
| [Fake-data / lying tests](testing-slop.md#fake-data-lying-tests) | `AI-slop` · `Review` · `Universal` | Testing slop |
| [Fallback-masks-bug](over-defensive.md#fallback-masks-bug) | `AI-slop` · `Review` · `Universal` | Over-defensive |
| [Generic-name-where-specific-needed](naming-slop.md#generic-name-where-specific-needed) | `AI-slop` · `Lint` · `Universal` | Naming slop |
| [God-prompt-component](architectural-slop.md#god-prompt-component) | `AI-slop` · `Lint` · `Universal` | Architectural slop |
| [GraphQL-for-two-endpoints](architectural-slop.md#graphql-for-two-endpoints) | `AI-slop` · `Review` · `Universal` | Architectural slop |
| [Happy-path utopia](over-defensive.md#happy-path-utopia) | `Quality` · `Review` · `Universal` | Over-defensive |
| [Hardcoded secret in source](security-and-correctness.md#hardcoded-secret-in-source) | `Quality` · `Lint` · `Universal` | Security & correctness |
| [Heavyweight-for-trivial](dependency-slop.md#heavyweight-for-trivial) | `AI-slop` · `Review` · `Universal` | Dependency slop |
| [Hungarian resurgence](naming-slop.md#hungarian-resurgence) | `AI-slop` · `Lint` · `Universal` | Naming slop |
| [`if __name__ == "__main__":` on library modules](boilerplate-and-ceremony.md#if-name-main-on-library-modules) | `AI-slop` · `Lint` · `Lang:Python` | Boilerplate |
| [Impl-named test](testing-slop.md#impl-named-test) | `Quality` · `Lint` · `Universal` | Testing slop |
| [INFO-on-every-entry](stylistic-tells.md#info-on-every-entry) | `AI-slop` · `Lint` · `Universal` | Stylistic tells |
| [Inconsistent casing shifts mid-function](naming-slop.md#inconsistent-casing-shifts-mid-function) | `AI-slop` · `Lint` · `Universal` | Naming slop |
| [Line-narration](comment-slop.md#line-narration) | `AI-slop` · `Lint` · `Universal` | Comment slop |
| [Lodash-for-isEmpty](dependency-slop.md#lodash-for-isempty) | `AI-slop` · `Lint` · `Lang:JS` | Dependency slop |
| [JSDoc-that-mirrors-types](comment-slop.md#jsdoc-that-mirrors-types) | `AI-slop` · `Lint` · `Lang:TS` | Comment slop |
| [Manager/Helper/Service/Handler/Util suffix proliferation](naming-slop.md#manager-helper-service-handler-util-suffix-proliferation) | `AI-slop` · `Lint` · `Universal` | Naming slop |
| [Markdown in docstrings](stylistic-tells.md#markdown-in-docstrings) | `AI-slop` · `Lint` · `Universal` | Stylistic tells |
| [Math.random for security tokens](security-and-correctness.md#math-random-for-security-tokens) | `Quality` · `Lint` · `Universal` | Security & correctness |
| [Meta-narration ("Let's... Now we...")](comment-slop.md#meta-narration-lets-now-we) | `AI-slop` · `Lint` · `Universal` | Comment slop |
| [Microservices-for-a-function](architectural-slop.md#microservices-for-a-function) | `AI-slop` · `Review` · `Universal` | Architectural slop |
| [Mock-the-thing-under-test](testing-slop.md#mock-the-thing-under-test) | `Quality` · `Review` · `Universal` | Testing slop |
| [N+1 query](security-and-correctness.md#n-1-query) | `Quality` · `Review` · `Universal` | Security & correctness |
| [No pagination / unbounded fetch](security-and-correctness.md#no-pagination-unbounded-fetch) | `Quality` · `Review` · `Universal` | Security & correctness |
| [Optional-chaining paranoia](over-defensive.md#optional-chaining-paranoia) | `AI-slop` · `Type-check` · `Lang:TS` | Over-defensive |
| [Orphan migration / schema drift](file-organization.md#orphan-migration-schema-drift) | `Quality` · `Lint` · `Universal` | File organization |
| [Outdated API version](dependency-slop.md#outdated-api-version) | `AI-slop` · `Review` · `Universal` | Dependency slop |
| [Over-destructure-with-defaults](gratuitous-abstraction.md#over-destructure-with-defaults) | `AI-slop` · `Review` · `Lang:JS` | Gratuitous abstraction |
| [Over-split one-function-per-file](file-organization.md#over-split-one-function-per-file) | `AI-slop` · `Lint` · `Universal` | File organization |
| [Paranoid try/catch everywhere](over-defensive.md#paranoid-try-catch-everywhere) | `AI-slop` · `Lint` · `Universal` | Over-defensive |
| [Phantom assertion](testing-slop.md#phantom-assertion) | `AI-slop` · `Lint` · `Universal` | Testing slop |
| [PR-slop / verbose-LLM-description](review-burden.md#pr-slop-verbose-llm-description) | `AI-slop` · `Lint` · `Universal` | Review burden |
| [Premature generics](gratuitous-abstraction.md#premature-generics) | `AI-slop` · `Review` · `Universal` | Gratuitous abstraction |
| [Provider/Context-for-one-value](gratuitous-abstraction.md#provider-context-for-one-value) | `AI-slop` · `Lint` · `Lang:TS` | Gratuitous abstraction |
| [Pydantic-for-a-dict](boilerplate-and-ceremony.md#pydantic-for-a-dict) | `AI-slop` · `Review` · `Lang:Python` | Boilerplate |
| [Redundant existence checks](over-defensive.md#redundant-existence-checks) | `AI-slop` · `Lint` · `Universal` | Over-defensive |
| [Redux-for-local-state](architectural-slop.md#redux-for-local-state) | `AI-slop` · `Review` · `Lang:TS` | Architectural slop |
| [README-on-trivial-helper](comment-slop.md#readme-on-trivial-helper) | `AI-slop` · `Lint` · `Universal` | Comment slop |
| [Re-validation at every layer / phantom validation](over-defensive.md#re-validation-at-every-layer-phantom-validation) | `AI-slop` · `Review` · `Universal` | Over-defensive |
| [Resume-padding / green-square farming](review-burden.md#resume-padding-green-square-farming) | `AI-slop` · `Review` · `Universal` | Review burden |
| [Section divider comments](comment-slop.md#section-divider-comments) | `AI-slop` · `Lint` · `Universal` | Comment slop |
| [Single-use interface](gratuitous-abstraction.md#single-use-interface) | `AI-slop` · `Lint` · `Universal` | Gratuitous abstraction |
| [Slop-loop addiction](review-burden.md#slop-loop-addiction) | `AI-slop` · `Review` · `Universal` | Review burden |
| [Slopsquatting / hallucinated import](security-and-correctness.md#slopsquatting-hallucinated-import) | `AI-slop` · `Lint` · `Universal` | Security & correctness |
| [Snapshot-of-meaningless-output](testing-slop.md#snapshot-of-meaningless-output) | `AI-slop` · `Lint` · `Universal` | Testing slop |
| [SQL-string-concat](security-and-correctness.md#sql-string-concat) | `Quality` · `Lint` · `Universal` | Security & correctness |
| [Stanford "insecure-but-confident" effect](security-and-correctness.md#stanford-insecure-but-confident-effect) | `Quality` · `Review` · `Universal` | Security & correctness |
| [Swallowed exception](over-defensive.md#swallowed-exception) | `AI-slop` · `Lint` · `Universal` | Over-defensive |
| [Tautological test](testing-slop.md#tautological-test) | `AI-slop` · `Lint` · `Universal` | Testing slop |
| [Test duplicates production logic](testing-slop.md#test-duplicates-production-logic) | `Quality` · `Review` · `Universal` | Testing slop |
| [Trivial getters/setters](boilerplate-and-ceremony.md#trivial-getters-setters) | `AI-slop` · `Lint` · `Universal` | Boilerplate |
| [Tutorial-scale descriptive names](naming-slop.md#tutorial-scale-descriptive-names) | `AI-slop` · `Lint` · `Universal` | Naming slop |
| [Unbounded goroutine / unbounded worker](security-and-correctness.md#unbounded-goroutine-unbounded-worker) | `Quality` · `Review` · `Lang:Go` | Security & correctness |
| [Unnecessary class wrapping functions](boilerplate-and-ceremony.md#unnecessary-class-wrapping-functions) | `AI-slop` · `Review` · `Universal` | Boilerplate |
| [UserData / UserInfo / UserDetails divergence](naming-slop.md#userdata-userinfo-userdetails-divergence) | `AI-slop` · `Review` · `Universal` | Naming slop |
| [`utils.ts` / `helpers.ts` / `common.ts` dumping ground](file-organization.md#utils-ts-helpers-ts-common-ts-dumping-ground) | `AI-slop` · `Lint` · `Universal` | File organization |
| [Verbose bulleted error messages](stylistic-tells.md#verbose-bulleted-error-messages) | `AI-slop` · `Lint` · `Universal` | Stylistic tells |
| [Wrapper-that-forwards-args](gratuitous-abstraction.md#wrapper-that-forwards-args) | `Quality` · `Lint` · `Universal` | Gratuitous abstraction |
| [`/constants/` for two values](file-organization.md#constants-for-two-values) | `AI-slop` · `Review` · `Universal` | File organization |
| [Over-capitalized success/error strings](stylistic-tells.md#over-capitalized-success-error-strings) | `AI-slop` · `Lint` · `Universal` | Stylistic tells |

Language-specific catalogs live inside their language extension:

- [languages/typescript/anti-patterns.md](../languages/typescript/anti-patterns.md) — `any` abuse, `as unknown as Foo`, `useEffect` deps, `"use client"` by default, and other TS/React tells.
- [languages/python/anti-patterns.md](../languages/python/anti-patterns.md) — `dict-str-any-smell`, pre-PEP-585/604 typing (`List[X]`, `Optional[X]`), Pydantic v1→v2 drift, `diaper-anti-pattern`, async-everywhere-cargo-cult, `blocking-http-in-async`, and the rest of the Python tells.
- [languages/go/anti-patterns.md](../languages/go/anti-patterns.md) — `naked-err-return`, `preemptive-single-impl-interface`, `unbounded-go-in-loop`, `defer-in-loop`, `background-in-handler`, `utils-common-helpers`, `manual-contains-loop`, `ioutil-post-deprecation`, and the rest of the Go tells.
