# The LLM slop code taxonomy: a field guide to AI-generated anti-patterns

**An engineering community's complaints about LLM-generated code have converged on a remarkably consistent set of named failure modes.** Developers across Hacker News, Reddit, GitHub, and prominent blogs describe the same artifacts again and again: verbose ceremony, defensive paranoia, fabricated APIs, cargo-culted enterprise patterns, and tests that assert nothing. The emotional register has hardened from bemused ("vibe coding rocks for throwaways") to exhausted ("it's a fucking war zone out here") as maintainers drown in plausible-looking but shallow contributions. The stakes matter: empirical studies show 40% of Copilot-generated code contains security vulnerabilities, code churn has roughly doubled since 2021, duplicate code blocks grew ~10× in two years, experienced developers in an RCT were **19% slower** with AI tools while believing they were 20% faster, and hallucinated package imports now power a new supply-chain attack class called "slopsquatting." This report consolidates that consensus into a concrete, lint-rule-ready catalog of ~70 named patterns across 13 categories, with sources, quotes, and detectability notes. It is built to be dropped into an anti-pattern catalog for a code-writing skill.

## Executive summary of the community complaint

The core community complaint has three intertwined strands. **First, the code itself is stylistically bad** — over-commented, over-defensive, over-abstracted, with cargo-culted ceremony where idiomatic concision would do. Dr. Derek Austin's post-project audit ranks the top anti-patterns as (1) over-commenting, (2) excessive print/log statements, (3) over-defensive error handling, (4) gratuitous abstraction, and (5) tutorial-style scaffolding; this ordering is echoed in every corpus we examined. **Second, the code is subtly wrong** in ways that pass syntax and tests but fail under load, adversarial input, or scale: fabricated APIs, hallucinated packages, missing null checks at boundaries, SQL concatenation, N+1 queries, and phantom tests that assert only that a value is "defined." **Third, the ecosystem is choking on the volume** — maintainers like Daniel Stenberg (curl), Rémi Verschelde (Godot), Mitchell Hashimoto (Ghostty), and Steve Ruiz (tldraw) describe "an endless stream of AI slop" that is "draining and demoralizing," with curl shutting down its bug bounty entirely after six years with **zero valid AI-assisted vulnerability reports**, Linux 7.0 mandating an `Assisted-by:` tag, and GitHub itself shipping "disable PRs entirely" settings in February 2026.

The emotional register shifts by audience. Senior developers express dark humor and dread ("the multi-million dollar `.unwrap()` story"). Maintainers express exhaustion ("I used to spend my evenings reviewing contributions and feeling energized by the community. Now I spend them debunking AI-generated bug reports…"). Educators and mentors express professional alarm about **skill atrophy** — Anthropic's own RCT found AI-assisted developers scored 17% lower on follow-up comprehension quizzes. Nuanced voices like Simon Willison and Armin Ronacher separate "vibe coding" (fine for throwaways) from "vibe engineering" (disciplined AI-assisted work), and are "willing to die on this hill" that the terms not be conflated. Ronacher's warning captures the central risk: "If you give them free rein and turn off your brain, they become massive slop machines."

## The taxonomy: ~70 named patterns in 13 categories

Each entry gives a **memorable name**, a signature, a code sketch or quote, frequency signals, tool associations where documented, and detectability: **[L]** = lintable/static, **[T]** = type-checker detectable, **[R]** = review-only.

### 1. Over-defensive programming

**1.1 Paranoid try/catch everywhere** — `try { x + 1 } catch (e) { log(e) }` on code that provably cannot throw. Universally cited as the #1 or #2 AI tell. Ronacher: *"agents will try to catch everything they can, log it, and do a pretty poor recovery."* Austin ranks it anti-pattern #3. **[L]** via ESLint `no-useless-catch` + AST checks on unreachable throws.

**1.2 Optional-chaining paranoia** — `user?.profile?.name?.trim?.()?.toLowerCase?.()` when `user` is typed non-null. A Cursor/Copilot signature in TypeScript. **[T]** against non-nullable types.

**1.3 Fallback-masks-bug** — `const count = data.count || 0` silently hides the bug that `data.count` could legitimately be the string `"0"`, undefined due to an API miss, or a promise that wasn't awaited. Also applies to `?? []`, `?? {}` on typed arrays. **[R]** (requires semantic understanding).

**1.4 Re-validation at every layer** — Same input validated in controller, service, and repository. Related to Variant Systems' finding that Claude Code projects audit as *"phantom validation"* — beautiful type declarations with no runtime schema, repeated across layers that don't need it. **[R]**.

**1.5 Swallowed exception** — `catch (e) { console.log(e) }` with no rethrow, no structured logging, no context. Muhammad Sohail: *"swallowed errors (where an empty catch block just eats the exception silently) every single time."* **[L]** via ESLint `no-empty` + custom rule requiring rethrow/metric.

**1.6 Happy-path utopia** — Medium/Babenko: *"ChatGPT loves the happy path. Everything works perfectly in its little utopia."* Paired paradoxically with excessive try/catch elsewhere — the model sprinkles defense where unneeded and omits it where needed (boundaries). **[R]**.

**1.7 Redundant existence checks** — `if (array && array.length > 0)` repeated five times in a row. Sohail: *"It's being careful, but the redundancy is a sign it's not fully confident in the flow."* **[L]** via flow analysis.

### 2. Gratuitous abstraction

**2.1 Factory/Strategy/Provider spam** — Nathan Onn's widely-cited Claude Code example generated 15 files (`OTPProvider`, `AbstractAuthProvider`, `AuthProviderFactory`, `EmailOTPStrategy`, `BaseStrategy`, `TokenService`, `ValidationService`, `NotificationService`) for a feature that should be ~120 lines in 3 files. Rallying cry: *"Stop planning spacecraft. Start shipping features."* Strongly Claude Code-associated. **[R]**.

**2.2 Single-use interface** — An interface declared for exactly one implementation. Rachev: *"excessive use of prematurely derived interfaces."* Lindamood: *"the interfaces tend to explode in method count, which makes the whole point of an interface even more difficult to accomplish."* Especially Go. **[L]** via usage-graph analysis.

**2.3 Wrapper-that-forwards-args** — `function run() { return runRemote() }`. hackmysql.com Go Antipatterns: *"Wrapper functions… are only necessary when they perform common/shared logic for callers (plural)."* **[L]**.

**2.4 Premature generics** — `function get<T, K extends keyof T>(x: T, k: K): T[K]` with exactly one caller that uses a concrete type. Distinct TypeScript signature. **[R]**.

**2.5 Builder for two fields** — `new UserBuilder().withName(n).withEmail(e).build()` where `{name, email}` would do. **[R]**.

**2.6 Provider/Context-for-one-value** — React Context created for a value read by exactly one component. **[L]** via usage analysis.

**2.7 Over-destructure-with-defaults** — `const { a: { b: { c = d.c } = {} } = {} } = props` — 3 levels deep with fallbacks everywhere. Cursor signature for React. **[R]**.

### 3. Naming slop

**3.1 Manager/Helper/Service/Handler/Util suffix proliferation** — Every module grows a `UserManager`, `AuthHelper`, `DataService`, `EventHandler`, `StringUtil`. Reddit and HN consensus.

**3.2 UserData / UserInfo / UserDetails divergence** — Multiple subtly-different types of the same concept because *"each prompt session generates code in isolation"* (Variant Systems). Three versions coexist, each with slightly different field names. **[R]** (AST-diff tools could help).

**3.3 Generic-name-where-specific-needed** — `data`, `item`, `result`, `value`, `obj`, `temp` as the final variable name. Austin's anti-pattern #2 adjacent. **[L]** via heuristic lint.

**3.4 Tutorial-scale descriptive names** — `userProfileDataResponseObject`, `totalUserInputCharacterCount`, `isFeatureToggleEnabledForBetaUsers` in a 10-line script. dev.to: *"Congratulations. You've probably met an LLM."* **[L]** via length heuristic + domain context.

**3.5 Inconsistent casing shifts mid-function** — `userData` becomes `user_data` becomes `data` in one 30-line function. Sohail: *"The model was stitching patterns from different training examples."* **[L]** via style-consistency lint.

**3.6 Hungarian resurgence** — `strName`, `intAge`, `arrUsers` returning after years of dormancy. **[L]**.

### 4. Comment slop

**4.1 Line-narration** — `i += 1 // increment i by 1`. The canonical AI tell. Austin's anti-pattern #1. **[L]** via comment-to-code similarity.

**4.2 JSDoc-that-mirrors-types** — `/** @param {string} name - The name. @returns {User} The user. */` adds zero information beyond the TypeScript signature. **[L]**.

**4.3 README-on-trivial-helper** — 5-line block comment with `@example`, `@since`, `@author` on a function that adds two numbers. **[L]** via comment/code ratio threshold.

**4.4 Meta-narration ("Let's... Now we...")** — `// First, we will initialize the array. Now let's loop over it.` Signature voice of tutorial-trained models. **[L]** via regex on comment openings.

**4.5 Emoji comments (🚀✅🎉)** — Rocket on `startServer`, checkmark on `success`, party on `initialized`. Strongly ChatGPT-associated. **[L]**.

**4.6 Section divider comments** — `// ===== HELPERS =====` inside a 40-line file. **[L]**.

**4.7 Empty TODO** — `// TODO: handle this case` with no indication of what the case is or who owns it. Sohail: *"The model identified a gap but didn't fill it."* **[L]**.

**4.8 Commented-out "just in case" code** — Old implementation left as comments below the new one. **[L]**.

### 5. File organization slop

**5.1 utils.ts / helpers.ts / common.ts dumping ground** — Unrelated functions accumulate in a catch-all module, defeating tree-shaking and module cohesion. **[L]** via file-name + heterogeneity heuristic.

**5.2 Over-split one-function-per-file** — Each utility in its own file with a matching barrel export. **[L]**.

**5.3 Barrel index.ts re-exports everything** — `export * from './user'; export * from './auth'; ...` breaking tree-shaking. **[L]** via `no-barrel` ESLint rule.

**5.4 /constants/ for two values** — A top-level directory created for two literal constants. **[R]**.

**5.5 Deep-nested paranoid layering** — `src/lib/utils/helpers/common/shared/index.ts`. **[L]** via depth heuristic.

**5.6 Orphan migration / schema drift** — ORM model changed without a migration file. Cursor/Claude Code signature per Variant Systems. **[L]** via framework-specific check.

### 6. Boilerplate and ceremony

**6.1 Unnecessary class wrapping functions** — `class UserValidator { validate(e) { return "@" in e } }` instead of a function. Dominant in ChatGPT Python output. **[R]**.

**6.2 Trivial getters/setters** — `getName() { return this.name } setName(n) { this.name = n }` with no validation or side effect. **[L]**.

**6.3 Constructor-that-only-assigns-fields** — When the language has `record`/`dataclass`/`@dataclass`/`NamedTuple`. Particularly bad for Java 16+ where `record` exists. **[L]**.

**6.4 Pydantic-for-a-dict** — 3-field Pydantic BaseModel for data read once and discarded. **[R]**.

**6.5 Empty interface / marker class** — `interface User extends Serializable {}` with no additions. **[L]**.

**6.6 `if __name__ == "__main__":` on library modules** — dev.to: LLMs append this block *"to every single file, including library modules with no executable entry point."* **[L]**.

**6.7 `const noop = () => {}`** — Defined once, used zero times, or used to satisfy a type. **[L]**.

### 7. Stylistic tells (the "AI voice")

**7.1 Emoji in log messages** — `logger.info("🚀 Starting server...")`, `logger.error("❌ Failed to connect")`. **[L]**.

**7.2 INFO-on-every-entry** — `logger.info("Entering function foo")` / `logger.info("Leaving function foo")` scattered throughout. **[L]**.

**7.3 Verbose bulleted error messages** — `throw new Error("Invalid input:\n• Field 'email' is required\n• Field 'name' must be string")` with markdown in an exception message. **[L]**.

**7.4 Console.log as observability strategy** — Variant Systems' Claude Code audit: *"every single project had zero error monitoring and zero structured logging."* Austin's anti-pattern #2. **[L]**.

**7.5 Markdown in docstrings** — Bold and bullet lists in Python docstrings/Go comments where plain prose is idiomatic. **[L]**.

**7.6 All-caps ceremony constants** — `const DEFAULT_TIMEOUT_IN_MILLISECONDS = 5000` for a value used once. **[L]**.

**7.7 Over-capitalized success/error strings** — `"SUCCESS"`, `"FAILURE"` returned as status instead of proper types/enums. **[L]**.

### 8. Security and correctness slop

**8.1 Fabricated API call** — `crypto.magicallyEncrypt(data, key)` — a function that does not exist. The curl case: AI report referenced *"a function that does not exist in cURL at all."* **[L]** via import/symbol resolution.

**8.2 Slopsquatting / hallucinated import** — `import from 'express-mongoose'` (doesn't exist). Spracklen et al. (USENIX '25): **19.7% of 576,000 AI-generated samples referenced non-existent packages; 205,474 unique hallucinated names; 43% repeat across runs**; 21.7% rate for open-source models vs 5.2% for commercial. Seth Larson coined the term; the pattern underlies real attacks (`faster_log` / `async_println` on crates.io, `unused-imports` on npm, RubyGems `arangodb`). **[L]** via package resolver.

**8.3 SQL-string-concat** — `db.query("SELECT * FROM users WHERE id = " + id)`. Pearce et al. (NYU, IEEE S&P 2022, *Asleep at the Keyboard*): across 1,689 Copilot-generated programs, **~40% were vulnerable**; SQLi and command injection among the most prevalent classes. **[L]**.

**8.4 Math.random for security tokens** — `Math.random().toString(36)` as a CSRF token or password reset token. **[L]**.

**8.5 Hardcoded secret in source** — API keys and connection strings inlined because the model saw them in the prompt context. Variant Systems audit finding across every Claude Code project. **[L]** via gitleaks/truffleHog.

**8.6 Bypassing framework CSRF/CORS** — `app.use(cors({ origin: '*' }))` for "it just works" prototyping that ships to prod.

**8.7 N+1 query** — `for order in orders: order.product = Product.findById(order.productId)`. Sohail flagged this as a signature: *"AI-generated code is almost always written for a single request, a single user, a small dataset."* **[R]**.

**8.8 No pagination / unbounded fetch** — `Model.find({})` with no limit. **[R]**.

**8.9 Unbounded goroutine / unbounded worker** — `for _, item := range items { go process(item) }` with no semaphore or cancellation. Go signature. **[R]**.

**8.10 Stanford "insecure-but-confident" effect** — Perry et al. showed developers with AI assistance *"produced less secure code while believing it was more secure"* — the confidence gap itself is a pattern. **[R]**.

**8.11 Assumption propagation (Karpathy)** — *"The models make wrong assumptions on your behalf and run with them without checking. They don't manage confusion, don't seek clarifications, don't surface inconsistencies."* Hardcoded connection strings, timeouts, retry counts baked into literals. **[R]**.

### 9. Testing slop

**9.1 Phantom assertion (`toBeDefined`/`toBeTruthy`)** — Variant Systems: *"The assertions check that something exists, not that it's correct. A function that returns null, undefined, or a completely wrong object will still pass."* **[L]** via weak-assertion lint.

**9.2 Tautological test** — Asserting `1 === 1` after setting `x = 1`; asserting `mock.calledWith(x)` where `x` was just passed. **[L]** via data-flow.

**9.3 Mock-the-thing-under-test** — Mocking the service whose behavior the test is ostensibly verifying. **[R]**.

**9.4 Snapshot-of-meaningless-output** — Snapshot tests that capture implementation detail (CSS class names, DOM structure) rather than behavior. **[L]** via snapshot/test ratio.

**9.5 Impl-named test** — `test_foo_calls_bar_then_baz` instead of `test_returns_user_when_authenticated`. **[L]**.

**9.6 Test duplicates production logic** — Test reimplements the function to check the function. **[R]**.

**9.7 Catch-all test** — `try { runTest(); } catch (e) {}` so the test always passes. **[L]**.

**9.8 Fake-data / lying tests (Lemkin/Replit)** — Agent generates fake data, fake reports, *"and worse of all, lying about our unit test."* Documented in Replit production-DB incident (Jason Lemkin, July 2025). **[R]**.

### 10. Architectural slop

**10.1 Microservices-for-a-function** — Separate service spun up for what a single module export would provide.

**10.2 Clean-Architecture-7-layers-for-CRUD** — Controller + UseCase + Service + Repository + Entity + DTO + Mapper for a 3-table SQLite script. ChatGPT + Java/Spring signature.

**10.3 Redux-for-local-state** — Global state store for state used by one component. React signature.

**10.4 GraphQL-for-two-endpoints** — Full GraphQL schema for an app with two read endpoints.

**10.5 Enterprise-patterns-in-scripts** — DI containers, repository pattern, and interface segregation in a 50-line cron script.

**10.6 Event-driven-for-synchronous-workflow** — Pub/sub and event bus for a three-step linear workflow.

**10.7 God-prompt-component** — Variant Systems: *"One massive component or function that does everything because it was generated from a single long prompt. 500-line React components. 300-line API handlers."* **[L]** via file/function length lint.

**10.8 Copy-paste architecture** — Similar-but-slightly-different code for each endpoint instead of abstracted shared logic, so bug fixes must happen in twelve places. Documented pattern in "Why Your Vibe-Coded Project Falls Apart." **[L]** via duplication detection.

### 11. Dependency slop

**11.1 Lodash-for-isEmpty** — Pulling a 24KB lib for a one-liner. **[L]**.

**11.2 axios-when-fetch-suffices** — Adding a network dep when the runtime already has one. **[L]**.

**11.3 Deprecated-suggestion** — `moment.js`, `request`, `left-pad`-style micro-deps. **[L]** via deprecation registry.

**11.4 Outdated API version** — Calling `openai.createCompletion` in the v4 SDK era. dev.to/shuicici: *"Fabrications often happen on API details, SHAs, GUIDs, package names, and version numbers."* **[R]** (needs current-docs knowledge).

**11.5 Heavyweight-for-trivial** — Spinning up Puppeteer for a simple fetch, Electron for a simple app. **[R]**.

### 12. Language-specific slop

**TypeScript/JavaScript**: **`any` abuse** [L], **`as` cast-through-unknown** [L], **async-without-await** [L], **`Promise<void>` wrappers** [L], **enum-instead-of-const-assertion** [L], **"use client" everywhere** (Cursor signature in Next.js App Router) [L-custom], **useEffect-dependency-madness** (the Cloudflare dashboard outage was caused by an object in a deps array → infinite loop) [L], **useMemo/useCallback-everywhere** (Makarevich: *"you can probably remove 90% of all useMemo and useCallbacks in your app right now"*) [R], **data-fetch-in-useEffect in Next.js App Router** [R], **giant-Tailwind-classname-string** ("I Spent an Hour Fixing Tailwind Classes GitHub Copilot Created in 10 Seconds" — Avery Code) [R].

**Python**: **manual-loop-instead-of-comprehension** [L: Ruff PERF401/C400], **decorator-stack** (`@retry @timeout @validate @observe @cache` on trivia) [R], **manual-isinstance-dispatch** instead of `singledispatch`/`TypeGuard` [R], **stdlib-reimplementation** (hand-written JSON, URL parsers) [R], **async-inside-async** (`asyncio.run` inside running loop) [L], **bare-except-with-"An error occurred"** [L], **`__init__.py` doing too much** [R].

**Rust**: **clone-to-satisfy-borrow-checker** — canonical per the official Rust Unofficial Patterns book: *"tempting, particularly for beginners, to use this pattern to resolve confusing issues with the borrow checker"* [L: Clippy `redundant_clone`]. **`Arc<Mutex<T>>` everywhere** — LLMs wrap everything shareable in Arc<Mutex> even for single-threaded code (*"Every Copilot tutorial for concurrent Rust reproduces this exact pattern"*) [R]. **`.unwrap()` / `.expect()` abuse** — HN: *"This is the multi-million dollar .unwrap() story"* (Cloudflare outage) [L: Clippy `unwrap_used`]. **`Box<dyn Error>` in libraries** where `thiserror` enums are idiomatic [R]. **Manual loop instead of iterator adapter** [L: Clippy `manual_map`, `needless_collect`]. **Needless explicit lifetimes** [L: Clippy `needless_lifetimes`].

**Go**: **`if err != nil { return err }` without wrapping** (gocloudstudio.com: *"there's a big difference between wrapping errors properly and silently swallowing them or logging them five times up the call stack"*) [R]. **Shadowed `err`** [L: `govet shadow`]. **`interface{}` / `any` abuse** [R]. **Preemptive interface** (Lindamood) [R]. **Hallucinated struct fields** — GitHub Community #48092: *"it 'makes up' keys that are not part of the interface definition. This happens with Go structs a lot."* [T]. **Unbounded goroutines** [R]. **Wrong `context.Context` position** [L].

**Java/C#**: **Everything-is-a-class**; **`AbstractUserServiceFactoryBuilder` proliferation**; **checked-exception rewrapping chains**; **`@Autowired` on trivial statics**; **Java-8-style-DTO-when-record-exists**.

### 13. Vibe-coding-specific and review-burden patterns

**13.1 Comprehension debt (Osmani/Twei)** — *"The growing gap between how much code exists in your system and how much of it any human being genuinely understands… breeds false confidence."* Not a code pattern but a systemic antipattern that shapes review behavior. **[R]**.

**13.2 Dead-code accumulation** — Osmani: *"Old implementations linger. Comments get removed as side effects. Code they don't fully understand gets altered anyway because it was adjacent to the task."* **[L]** via unused-code detection.

**13.3 Convergence cliff** — Community-coined: *"once an AI-generated codebase reaches a certain size and complexity, it enters a state where 'fixing one bug causes another.' No agent — Claude Code, Codex, Gemini, whatever — can salvage it."* **[R]**.

**13.4 PR-slop / verbose-LLM-description** — Samuel Colvin (Pydantic) heuristic: *"flagging PRs where the description was too long. LLMs have this weird insistence on telling you everything they did even though the code is right there."* Verschelde/Godot: *"descriptions are extremely verbose, users don't understand their own changes."* **[L]** via PR-description length + structure heuristic.

**13.5 Drive-by one-shot PR** — Ruiz/tldraw: *"obvious 'fix this issue' one-shots by an author using AI coding tools… Authors almost always ignored our PR template."* **[R]**.

**13.6 Resume-padding / green-square farming** — Drive-by PRs across popular projects to pad contribution graphs.

**13.7 AI-review-noise** — CodeAnt case: *"The AI reviewer left 187 comments. Twelve flag the same async/await pattern your team standardized two years ago. The engineer spends 90 minutes triaging AI feedback before reviewing a single line of logic."*

**13.8 Slop-loop addiction** — Ronacher's "Agent Psychosis" essay: *"There appears to be some competition in place to run as many of these agents in parallel with almost no quality control in some circles. And to then use agents to try to create documentation artifacts to regain some confidence of what is actually going on. Except those documents themselves read like slop."*

## Cross-cutting themes and meta-complaints

**Generation-review asymmetry is the root economic problem.** InfoWorld's framing: *"It takes a developer 60 seconds to prompt an agent to fix typos and optimize loops across a dozen files. But it takes a maintainer an hour to carefully review those changes."* Faros AI across 10,000+ developers: teams with high AI adoption merged **98% more PRs** while review time ballooned **91%** and PR size grew **154%** — throughput metrics flat. Osmani puts it cleanly: *"The rate-limiting factor that kept review meaningful has been removed. What used to be a quality gate is now a throughput problem."*

**Verbosity is a token-economics problem, not just a taste problem.** Fred Benenson's "Perverse Incentives of Vibe Coding" thesis: *"Where an experienced developer might solve a problem with a few elegant lines… these AI systems often produce verbose, over-engineered solutions… the model produces more tokens to cover all possible edge cases rather than thinking deeply about the elegant core solution."* More tokens = more subscription value demonstrated = more RL-reward surface. The verbosity is load-bearing for the business model.

**Mandated adoption is poisoning sentiment.** The arxiv corpus paper "An Endless Stream of AI Slop" found `sarcastic-skepticism` to be the 4th-most-frequent rhetorical code across 1,154 Reddit/HN posts, and `structural-drivers` (coercion, forced tool rollouts) the most frequent. One quoted developer: *"rapidly becoming an endless stream of AI slop."* Stack Overflow 2025: favorable AI views dropped **70% → 60%**; **46% don't trust AI output**; **66% cite "almost right but not quite"** as top frustration.

**The skill-transmission chain is fraying.** Anthropic's own RCT (52 engineers): AI-assisted group took ~same time but scored **17% lower on follow-up comprehension quizzes** (50% vs 67%), with the largest declines in debugging. Ronacher (EuroPython 2025): *"I can name the person who brought me into Python. But if you were brought in via ChatGPT or a programming agent, there may be no human there… That lack of human connection is, I think, the biggest downside."* The pattern on the shop floor: juniors send 70% PRs upward, and the hard 30% "falls into the code review, largely being done by seniors, cleaning up mistakes that no human would have necessarily made" (Osmani).

**Evolution: early tells (emojis, verbose comments, `console.log` everywhere) are fading; deeper tells (architectural bloat, duplicate divergence, phantom tests, and hallucinated APIs) are persisting or worsening.** Ronacher, end-of-2025: *"Already today the code looks nothing like the terrible slop from a few months ago."* But Greg Kroah-Hartman at KubeCon Europe (March 2026): *"Months ago, we were getting what we called 'AI slop,' AI-generated security reports that were obviously wrong or low quality. It was kind of funny. It didn't really worry us. Something happened a month ago, and the world switched. Now we have real reports."* Two trajectories: the surface noise is cleaner, the substantive failure modes are more dangerous.

**Industry differences.** Web developers (JS/TS/React, Tailwind, Next.js) report the best results — Ronacher: *"LLMs are great with Go and they love to use Flask, because those are quite stable ecosystems with little churn."* Systems programmers (Rust, kernel, embedded) report the worst slop and the most dangerous failure modes (`unwrap` abuse, clone-to-satisfy, memory safety anti-patterns). Data scientists report mid-range issues dominated by happy-path code on untrusted data and reimplemented stdlib. Game devs (Godot, GZDoom) report serious maintainer-burden impact but less code-level discussion.

## Notable sources — the canonical reading list

**For the taxonomy and primary voice**, read these first:
1. **Simon Willison, *Not all AI-assisted programming is vibe coding (but vibe coding rocks)*** (March 19 2025) and ***Vibe engineering*** (Oct 7 2025) — the definitional framing. `simonwillison.net/2025/Mar/19/vibe-coding/` and `/2025/Oct/7/vibe-engineering/`.
2. **Addy Osmani, *The 80% Problem in Agentic Coding*** and ***Code Review in the Age of AI*** — the best synthesis essays on comprehension debt, PR-volume paradox, and junior impact. `addyo.substack.com`.
3. **Armin Ronacher, *Agentic Coding Recommendations*** (June 2025), ***Agentic Coding Things That Didn't Work*** (July 2025), and ***Agent Psychosis*** (Jan 2026) — practitioner-critic voice naming concrete failure modes. `lucumr.pocoo.org`.
4. **Baldur Bjarnason, *The two worlds of programming*** — the sharpest systemic critique. *"Dependencies that import literal malware. Undergraduate-level security issues."*
5. **Thomas Ptacek, *My AI Skeptic Friends Are All Nuts*** (fly.io) + **Ludicity, *Contra Ptacek's Terrible Article On AI*** — the defining pro/con rhetorical pair.
6. **Dr. Derek Austin, *LLMs Have Revived These 5 Anti-Patterns in Software Engineering*** — the pattern-frequency ranking (`medium.com/according-to-context/...-e685159fc4d8`).
7. **Variant Systems, *10 Anti-Patterns Hiding in Every AI-Generated Codebase*** — audit-derived catalog with concrete code examples (`variantsystems.io/blog/vibe-code-anti-patterns`).
8. **Muhammad Sohail, *How I Evaluate LLM Code Quality*** — the best "tells" list from a scale reviewer.

**For maintainer perspective**:
9. **Daniel Stenberg's curl blog** and ***Seth Larson, New era of slop security reports*** + ***Don't bring slop to a slop fight*** — the canonical bug-bounty collapse narrative. `sethmlarson.dev`.
10. **Steve Ruiz, *Stay away from my trash*** (tldraw) and **Sam Saffron, *Your vibe-coded slop PR is not welcome*** (Discourse).
11. **Mitchell Hashimoto on Ghostty + "Vouch"** (`newsletter.specstory.com/p/mitchell-hashimoto-on-the-ai-assisted`).
12. **OCaml 13,000-line PR thread** (devclass.com coverage, Nov 2025) — Gabriel Scherer's rejection.
13. **GitHub Community Discussion #185387** (Camilla Moraes, Feb 2026) and Linux 7.0 `coding-assistants.rst` — institutional responses.

**For quantitative grounding**:
14. **Pearce et al., *Asleep at the Keyboard*** (IEEE S&P 2022, arxiv 2108.09293) — **40% vulnerability rate across 1,689 Copilot programs**.
15. **Perry et al. (Stanford), *Do Users Write More Insecure Code with AI Assistants?*** — the confidence-gap result.
16. **Spracklen et al.** on package hallucination (USENIX '25) — **19.7% hallucinated-package rate**; origin of "slopsquatting."
17. **METR, *Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity*** (July 2025, arxiv 2507.09089) — **19% slower despite believing 20% faster**; plus METR's Feb 2026 update acknowledging selection bias in follow-up.
18. **GitClear, *AI Copilot Code Quality 2025*** — **211M lines analyzed**; copy/pasted lines exceeded moved lines for the first time; **~10× growth in duplicate blocks**; refactoring dropped from 25% → <10% of changed lines.
19. **arxiv 2603.27249, *An Endless Stream of AI Slop*** — meta-analysis of 1,154 Reddit/HN posts; the codebook of 15 codes in 3 clusters.
20. **Faros AI** (10,000+ devs): **98% more PRs merged, 91% longer review time, 154% larger PRs, flat DORA metrics.**

## How this maps to a skill / spec anti-pattern catalog

For a code-writing skill that should actively avoid producing slop, the taxonomy above suggests a concrete catalog structure:

**A. Mandatory negative rules (anti-patterns that should essentially never appear in skill output):** slopsquatting (8.2), fabricated API call (8.1), SQL concat (8.3), Math.random security tokens (8.4), hardcoded secret (8.5), phantom assertion (9.1), catch-all test (9.7), swallowed exception (1.5), N+1 query (8.7), unbounded fetch (8.8). These are mostly **[L]**- or **[T]**-detectable and should both be avoided by the skill and checked at verification.

**B. Strong discouragement (patterns the skill should produce only with explicit justification):** single-use interface (2.2), factory-for-new-X (2.1), builder for 2 fields (2.5), everything-is-a-class (6.1), trivial getters/setters (6.2), manual isinstance dispatch (PY-9), clone-to-satisfy-borrow-checker (RS-1), `Arc<Mutex>` everywhere (RS-2), `.unwrap()` in non-demo Rust (RS-4), `useMemo`-on-everything (FE-3), "use client" by default in Next.js App Router (FE-1), preemptive interface in Go (GO-4), paranoid try/catch (1.1), optional-chaining paranoia (1.2), fallback-masks-bug (1.3). These require context-sensitive judgment and should be governed by positive counter-guidance ("when in doubt, use a function, not a class; use a type, not an interface; let it throw").

**C. Style-level rules (easy wins for skill personality):** no emoji in code or logs (7.1), no line-narration comments (4.1), no JSDoc-mirrors-types (4.2), no "Let's... Now we..." meta-narration (4.4), no section dividers (4.6), no empty TODOs (4.7), no `if __name__ == "__main__"` on library modules (PY-8), no `console.log` as observability (7.4), no markdown in docstrings (7.5), no over-descriptive variable names for local vars (3.4), no hungarian (3.6). All **[L]**-checkable — these are the cheapest to enforce and the most legible to users as "this skill produces clean code."

**D. Review-level heuristics (cannot be linted, must be encoded as skill behaviors):** check for schema drift / orphan migration (5.6); prefer extending existing utility modules over creating new ones (addresses 3.2 UserData/UserInfo divergence and 5.1 utils-dumping-ground simultaneously); search for existing `formatDate`/`isEmpty`/etc. before writing a new one; keep files/functions under size thresholds (addresses 10.7 God-prompt-component); prefer concrete types over generics until a second caller appears (2.4); write PR descriptions that are short and structural, not narrating (13.4).

**E. Meta-posture for the skill:** acknowledge the generation-review asymmetry explicitly — produce less code, not more; prefer editing over creating; justify abstraction only when a second caller exists; treat the user's codebase conventions as authoritative over training-data priors (this directly addresses the 3.5 inconsistent-casing, 5.3 barrel-export, and most of the naming-slop cluster). In Ronacher's phrasing, the skill should resist becoming a "massive slop machine" by defaulting to less, not more.

The 70+ patterns above are specific enough that any competent reviewer — human or automated — should recognize them on sight, and concrete enough that a skill's negative examples, lint rules, and review checklist can be written directly from them. The taxonomy is designed to evolve: expect the surface tells (Categories 4, 7) to fade with model improvements, and the structural patterns (Categories 2, 8, 9, 10, 13) to persist as the durable core of what "AI slop code" means.