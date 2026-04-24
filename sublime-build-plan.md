# Sublime — Build Plan for Claude Code

**Dispatch this document to Claude Code along with the three attached artifacts.** This plan turns our drafts and research into a complete, installable skill system modeled on impeccable.style.

---

## How to use this plan

1. Open Claude Code in an empty repo (`sublime/`).
2. Paste this document as the initial message.
3. Attach all three reference artifacts (see *Attached context* below).
4. Tell Claude Code which phases to run — either "execute Phase 1 only" or "execute all phases sequentially, pause for review after each phase."
5. Each phase has explicit acceptance criteria. Do not advance past a phase until they pass.

Claude Code should treat this plan as authoritative for *what* to build and *how it should read*. The attached artifacts are authoritative for the *content* — what code anti-patterns exist, what voice the project uses, and what structural shape every output should follow.

---

## Attached context (read these first, in this order)

1. **`impeccable-style-architecture.md`** — Full architectural analysis of impeccable.style. This is the structural blueprint. Every directory layout, document shape, internal-section pattern, and voice convention in Sublime mirrors this. **Read this before writing any file.**

2. **`llm-slop-taxonomy.md`** — Research synthesis of ~70 named LLM-slop patterns the developer community has converged on, organized into 13 categories with sources, code examples, and detectability tags. This is the raw material for the anti-pattern catalog (Phase 3) and for the negative examples threaded through every reference file.

3. **`sublime-SKILL.md`** — The current draft of the core foundation file. Phase 1 starts here. Treat it as 90% done; tighten it but do not rewrite it from scratch.

---

## Mission

Sublime is a code-craft skill for AI coding agents (Claude Code, Cursor, Codex CLI, Gemini CLI). It does for code what impeccable.style does for design: gives the model a working vocabulary, an opinionated foundation, a verb-style command library, and a named anti-pattern catalog so it stops producing the same predictable slop.

The deliverable is a public, installable skill repo with a single-line install (`npx skills add <org>/sublime` or equivalent), a foundation document loaded into the AI's context on every code task, language-specific extensions, verb commands, and an anti-pattern catalog.

---

## Final architecture

```
sublime/
├── SKILL.md                          # The foundation (Phase 1)
├── references/                       # Deep reference, one per dimension (Phase 2)
│   ├── naming.md
│   ├── control-flow.md
│   ├── data-modeling.md
│   ├── errors.md
│   ├── interfaces.md
│   ├── dependencies.md
│   ├── tests.md
│   └── comments.md
├── anti-patterns/                    # The named slop catalog (Phase 3)
│   ├── README.md                     # Index page; explains tags
│   ├── over-defensive.md             # Category 1
│   ├── gratuitous-abstraction.md     # Category 2
│   ├── naming-slop.md                # Category 3
│   ├── comment-slop.md               # Category 4
│   ├── file-organization.md          # Category 5
│   ├── boilerplate-and-ceremony.md   # Category 6
│   ├── stylistic-tells.md            # Category 7
│   ├── security-and-correctness.md   # Category 8
│   ├── testing-slop.md               # Category 9
│   ├── architectural-slop.md         # Category 10
│   ├── dependency-slop.md            # Category 11
│   └── review-burden.md              # Category 13
├── commands/                         # Verb commands (Phase 4)
│   ├── README.md                     # Catalog page
│   ├── audit/SKILL.md
│   ├── critique/SKILL.md
│   ├── refactor/SKILL.md
│   ├── tighten/SKILL.md
│   ├── simplify/SKILL.md
│   ├── name/SKILL.md
│   ├── extract/SKILL.md
│   ├── harden/SKILL.md
│   ├── polish/SKILL.md
│   └── scaffold/SKILL.md
├── typescript/                       # First language extension (Phase 5)
│   ├── SKILL.md
│   └── references/
│       ├── strictness.md
│       ├── unions-and-narrowing.md
│       ├── any-unknown-as.md
│       ├── branded-types.md
│       ├── module-boundaries.md
│       └── react-patterns.md
├── README.md                         # Marketing + install + index (Phase 6)
├── CONTRIBUTING.md
├── LICENSE
└── package.json                      # If we ship via npm
```

Language extensions for `python/`, `rust/`, `go/` are out of scope for this build but should be possible to add later without restructuring.

---

## Voice and style conventions (apply to every file in every phase)

These are non-negotiable. Every output Claude Code produces must match them.

**Voice.** Second-person, imperative, opinionated. Declares positions, refuses hedging. "Don't use `Math.random()` for tokens" not "It is generally inadvisable to consider using `Math.random()` for tokens." Frame Sublime as a partner, not a linter — it can be pushed back on with a real reason, but it has positions.

**AI-aware framing.** Where relevant, name the model's failure mode explicitly: "Your natural failure mode is to wrap everything in `try/catch`…" This pattern (the **anti-attractor procedure**) is reserved for the highest-stakes choices where models reflexively reach for the wrong default — not every section gets one.

**Recurring shapes.** Every dimension and reference file uses the same vocabulary of structures:
- *Governing belief* — one short paragraph stating the principle.
- *"Always apply these — no reference needed"* — 3–5 inline non-negotiable bullets.
- *Anti-attractor procedure* (when warranted) — numbered Step 1 / Step 2 / Step 3 / Step 4 forcing reflex rejection.
- *DO / DO NOT lists* — short imperatives. Every DO NOT paired with a brief *why*.
- *BAN blocks* — `PATTERN · FORBIDDEN · WHY · REWRITE` — for the hard prohibitions only.
- *Tables* for multi-axis comparisons.
- *Inline code examples* at exactly the points where abstract guidance would be unfalsifiable.
- *Arrow-link to deeper reference* — `→ Consult [<topic> reference] for …` — separates *what you always do* from *what you optionally consult*.
- *Closing "Avoid:" line* on every reference file — a one-line summary of anti-patterns.

**Length discipline.** Foundation: ~3500–4500 words. Reference files: ~1500–2500 words each. Anti-pattern entries: ~50–150 words each. Command SKILL.mds: ~400–800 words each. Resist sprawl — every additional sentence is reading tax for the AI consuming this.

**No slop in our slop guide.** Sublime documents must themselves pass the AI Slop Test. No emoji in headers. No "Let's…" or "Now we…". No tutorial voice. No hedging. No banner comments. No re-stating section titles in their first sentence. Read the foundation's tone and match it.

---

## Phase 1 — Polish the foundation

**Input:** `sublime-SKILL.md` (attached draft).

**Goal:** Lock the foundation. Move it to `SKILL.md` at repo root. Tighten language. Verify structure matches impeccable's foundation (per `impeccable-style-architecture.md` §3).

**Tasks:**
1. Create the repo skeleton — empty directories per the *Final architecture* above, with `.gitkeep` placeholders.
2. Copy the draft to `SKILL.md`. Audit it against the *Voice and style conventions* above; tighten any drift.
3. Verify each of the 8 dimensions has: governing belief → "Always apply these" bullets → DO / DO NOT lists. The Naming and Errors sections additionally have an anti-attractor procedure — do not add anti-attractor procedures to the others.
4. Verify the 10 Hard BANs each follow the `PATTERN · FORBIDDEN · WHY · REWRITE` shape exactly. No extra prose.
5. Verify the AI Slop Test reads as catch-on-sight tells, not abstract principles.
6. Verify the sub-modes section names exactly three modes: `teach`, `craft`, `extract`.
7. Verify the closing `## Deeper reference` section accurately enumerates the 8 reference files, the language extensions, and the companion catalogs that follow.

**Acceptance criteria:**
- File reads end-to-end without breaking voice.
- A reader unfamiliar with the project can answer: *what does Sublime do, what shape does its guidance take, and what should I never do regardless of context?* in under 10 minutes.
- No section is longer than the others by 2× without justification.
- No emoji, no markdown banners, no "Let's…" voice.

---

## Phase 2 — Write the eight reference files

**Inputs:** `SKILL.md` (Phase 1 output), `llm-slop-taxonomy.md`, `impeccable-style-architecture.md` §4 (the reference-file pattern).

**Goal:** Produce the 8 deeper-reference files, one per craft dimension. Each is a self-contained technical essay (~1,500–2,500 words) that matches the *internal beats* impeccable's references use: short taxonomy → tables → code samples → closing *Avoid:* list.

**Per-file specification.** Each reference file must:
1. Open with one sentence stating the dimension's central claim.
2. Lay out a short taxonomy of the sub-topics within the dimension (4–8 sub-headings).
3. Use at least one table where multi-axis comparison applies (e.g., for errors: kind / when / handling layer).
4. Include inline code examples in the language(s) most relevant to the dimension. Prefer language-agnostic pseudocode for principles; use real syntax (TS, Python) only where syntax is the point.
5. Pull at least 3 named anti-patterns from `llm-slop-taxonomy.md` into a *Common AI failure modes for this dimension* sub-section, by name.
6. Close with an `### Avoid` block — a bulleted, one-line-each summary that maps to entries in the anti-pattern catalog.

**Per-file content guidance:**

- **`references/naming.md`** — plurality and tense; domain vocabulary vs framework vocabulary; the cost of generic names; the *UserData/UserInfo/UserDetails* divergence pattern; conventions for booleans, predicates, and async. Pull patterns 3.1–3.6 from the taxonomy.

- **`references/control-flow.md`** — early returns; nesting limits; one-screen rule; expression vs statement bias; state-machine modeling; the god-component pattern (10.7). Pull patterns 1.6, 10.7, 10.8.

- **`references/data-modeling.md`** — discriminated unions; making illegal states unrepresentable; parsing at boundaries; immutability defaults; the "absent vs empty vs loading" distinction; phantom validation (1.4). Pull patterns 1.4, 8.11.

- **`references/errors.md`** — taxonomy of failure (validation, not-found, timeout, contention, bug); the "handle at the right layer" principle; retries with backoff and jitter; bulkheads and circuit breakers; logging vs throwing; result types vs exceptions. Pull patterns 1.1, 1.5, 1.7, 8.10.

- **`references/interfaces.md`** — Postel's Law applied; designing the call site first; options objects vs positional args; the second-caller rule for abstraction; the preemptive-interface anti-pattern; module boundary placement. Pull patterns 2.1–2.7.

- **`references/dependencies.md`** — slopsquatting and how to defend against it (verify, lockfile, audit); the standard-library-first principle; the cost of every dependency; deprecated alternatives to avoid; pinning and version discipline; package-namespace conventions. Pull patterns 8.2, 11.1–11.5.

- **`references/tests.md`** — behavior vs implementation; the phantom-assertion epidemic and how to recognize it; property-based testing where it pays; arrange-act-assert; what to mock and what not to mock; snapshot discipline; flake budget. Pull patterns 9.1–9.8.

- **`references/comments.md`** — comments for *why*, never *what*; decision records and the case for ADRs; how to write a useful TODO; banner-comment prohibition; emoji prohibition; markdown-in-docstrings prohibition. Pull patterns 4.1–4.8.

**Acceptance criteria for Phase 2:**
- All 8 files exist, each ~1,500–2,500 words.
- Each file follows the internal beat structure.
- Each file ends with an `### Avoid` block.
- Each named anti-pattern referenced in a file also appears in the Phase 3 catalog under the same name.

---

## Phase 3 — Build the anti-pattern catalog

**Input:** `llm-slop-taxonomy.md` (the full ~70-pattern research). This is the raw material; the catalog is its productized form.

**Goal:** Convert the research taxonomy into a browseable, citable, lint-rule-ready catalog. Mirror the structure of impeccable.style/anti-patterns (per `impeccable-style-architecture.md` §5).

**Per-entry shape.** Every named pattern gets a stable entry with these fields:

```markdown
### [Pattern name]

**Tags:** AI-slop | Quality · Lint | Type-check | Review · Universal | Lang:<x>

**Pattern.** [One-sentence signature — what this looks like in code.]

**Forbidden example.**
```<lang>
[3–8 lines showing the slop]
```

**Why it hurts.** [1–3 sentences. Quote a developer source if available.]

**Rewrite.**
```<lang>
[3–8 lines showing the fix]
```

**See in `/sublime`:** [Link to the section of SKILL.md or the reference file that governs this.]
```

**Tag definitions:**
- *AI-slop* vs *Quality*: AI-slop = visible tells of LLM-generated code. Quality = general design mistakes that aren't AI-specific but show up frequently in LLM output.
- *Lint* / *Type-check* / *Review*: how the pattern is detectable. Lint = static AST/regex; Type-check = type system can catch it; Review = needs semantic understanding.
- *Universal* vs *Lang:<x>*: applies to all languages, or scoped to one.

**Per-file specification.** One file per category from the taxonomy (the 13 from `llm-slop-taxonomy.md`). Each file opens with a short paragraph framing the category, then lists every entry in that category using the standard shape above. Cross-reference into other categories where patterns interact.

**The 13 category files** map directly to the taxonomy. Skip Category 12 (language-specific) — those entries belong inside their respective language extension's anti-patterns, not in the universal catalog.

**Index.** `anti-patterns/README.md` lists every pattern alphabetically with its tags and a one-line description, plus links into the per-category files. This is the page someone lands on when searching "what's that AI tell called."

**Acceptance criteria for Phase 3:**
- Every named pattern from `llm-slop-taxonomy.md` (excluding the language-specific Category 12) appears in the catalog with all fields filled.
- Every pattern's "See in `/sublime`" link resolves to a real anchor in `SKILL.md` or a reference file.
- The README index is complete and sorted.
- Tags are consistent — same pattern type, same tag set.

---

## Phase 4 — Write the verb commands

**Input:** `impeccable-style-architecture.md` §1 and §6.3 (per-command template).

**Goal:** A library of verb-named commands that steer the foundation toward specific intents. Mirror impeccable's grouping (Create / Evaluate / Refine / Simplify / Harden) and per-command page template.

**The starting set of 10 commands:**

| Group | Command | One-line purpose |
|---|---|---|
| Create | `scaffold` | Bootstrap a new module, file, or feature with the conventions of this codebase. |
| Evaluate | `audit` | Read code and report on technical quality, slop tells, and risks. |
| Evaluate | `critique` | Read code and report on design quality, naming, structure, and abstraction. |
| Refine | `refactor` | Restructure for clarity without changing behavior. |
| Refine | `tighten` | Compress, remove ceremony, raise signal-to-noise. |
| Refine | `name` | Improve names at every level — variables, functions, modules, types. |
| Simplify | `simplify` | Strip abstraction back to the smallest version that solves the problem. |
| Simplify | `extract` | Lift repeated patterns into a shared module — only if a second caller exists. |
| Harden | `harden` | Tighten error handling, validation, and failure modes. |
| Harden | `polish` | Final-pass review for style, consistency, and presentation. |

**Per-command file.** Each command lives at `commands/<verb>/SKILL.md` and follows this template (impeccable's, adapted):

```markdown
# /<verb>

[One-sentence purpose.]

## When to use it

[2–4 sentences on intent, fit, and any sub-modes.]

## How it works

[The method, in 3–6 numbered steps or named dimensions. This is the part the AI executes.]

## Try it

[A concrete realistic example invocation with sample input and expected output shape.]

## Pitfalls

[2–4 named common mistakes when applying this command.]

## SKILL.md

[The actual canonical skill definition the AI harness loads. This is the prompt block. Use {{command_prefix}} placeholders where needed.]
```

**Catalog page.** `commands/README.md` is the parallel of impeccable.style/skills — lists the 10 commands grouped by intent (Create / Evaluate / Refine / Simplify / Harden), with one-line purposes.

**Acceptance criteria for Phase 4:**
- All 10 command files exist.
- Each follows the template exactly.
- Each command's SKILL.md block can be loaded standalone — it does not assume the foundation is also loaded, but it can reference it.
- The catalog page is complete and groups correctly.

---

## Phase 5 — TypeScript extension

**Input:** `llm-slop-taxonomy.md` Category 12 (language-specific section, TypeScript entries), the foundation, the references.

**Goal:** Build the first language-specific skill that extends the core. Same structural shape as the core itself — a `SKILL.md` that follows the foundation's pattern, plus its own reference files.

**`typescript/SKILL.md` structure** (mirrors the core foundation, scoped to TS):

- Opening one-sentence positioning.
- *Context Gathering Protocol (TS-specific)* — note `tsconfig.json` strictness, framework (React / Next.js / Node / Deno / Bun), package manager, ESM vs CJS.
- *TypeScript Direction* — commit to a strictness posture; note compatibility constraints.
- *Craft Guidelines* — TS-specific dimensions (5–7), each with the standard internal shape:
  1. **Strictness and configuration** — what `tsconfig` flags must be on; the cost of `noImplicitAny: false`.
  2. **`any`, `unknown`, and `as`** — the discipline; when each is acceptable; the `as unknown as Foo` smell.
  3. **Discriminated unions and narrowing** — modeling state with tags; type guards; `never` for exhaustiveness.
  4. **Branded and opaque types** — when nominal typing is worth it; the `UserId` vs `string` problem.
  5. **Module boundaries and exports** — barrel files (don't), public vs internal, `import type`, declaration files.
  6. **React patterns** (if React is in scope) — props discipline; `useEffect` restraint; the `useMemo` overuse trap; `"use client"` discipline in Next.js App Router.
  7. **Generics restraint** — when generics earn their keep; the *premature generic* trap.
- *Hard BANs (TypeScript)* — TS-specific patterns that should never appear:
  - `any` in production type signatures
  - `as unknown as Foo` double-cast to defeat the type system
  - `// @ts-ignore` without a comment explaining why
  - Optional-chaining cascades on non-nullable types
  - Empty types (`interface Foo {}` extending nothing)
  - Enum where union of string literals would do
- *AI Slop Test (TypeScript)* — TS-specific catch-on-sight tells.
- *Implementation Principles* — closing.
- *Deeper reference* — pointing to the TS reference files.

**TS reference files** (one per dimension above, ~1,200–2,000 words each):
- `references/strictness.md`
- `references/unions-and-narrowing.md`
- `references/any-unknown-as.md`
- `references/branded-types.md`
- `references/module-boundaries.md`
- `references/react-patterns.md`

**TS-specific anti-patterns:** Add a new file `typescript/anti-patterns.md` listing the TS-specific entries from Category 12 of the taxonomy, using the same per-entry shape as Phase 3.

**Acceptance criteria for Phase 5:**
- The TypeScript extension can be loaded *with* or *without* the core foundation and remain useful (it should reference the core, not duplicate it).
- Every TS BAN is one Sublime would not have to argue for to a TS-literate engineer.
- All TS reference files are written and follow the standard shape.
- TS anti-patterns are catalogued.

---

## Phase 6 — Distribution & top-level docs

**Goal:** Make the skill installable, discoverable, and contributable.

**Tasks:**

1. **`README.md` (repo root)** — The marketing page + install + index. Mirror impeccable.style's homepage structure (per `impeccable-style-architecture.md` §6.4): a numbered ladder of two-word section titles with one-line elaborations.
   - Suggested ladder: **01 The Foundation · 02 The Language · 03 The Antidote · 04 Install · 05 What's New · 06 FAQ.**
   - Include a one-line install snippet (see Open Decisions).
   - Include a "Try it" example invocation.

2. **`CONTRIBUTING.md`** — How to add a new anti-pattern, a new command, or a new language extension. Include the per-entry shape and the voice conventions.

3. **`LICENSE`** — Decide and add (see Open Decisions).

4. **`package.json`** (if shipping via npm) — Minimal manifest with `name`, `version`, `description`, `repository`, `keywords`, `license`. No code dependencies.

5. **Install mechanism** — Verify the chosen install path (see Open Decisions) actually works end-to-end. Document it in the README.

**Acceptance criteria for Phase 6:**
- A user landing on the repo can install Sublime in one command.
- A user can find any command, anti-pattern, or reference within two clicks of the README.
- A contributor can submit a new anti-pattern with no ambiguity about format.

---

## Cross-phase quality gates

Run these after every phase, before advancing:

1. **The Sublime-eats-its-own-cooking test.** Load the new files into Claude or another editor. Ask: *would the Sublime foundation flag anything in these files as slop?* If yes, fix before advancing.

2. **The "no synonym drift" check.** Search the repo for inconsistent terminology. If one place says "early-return" and another says "guard-clause" for the same idea, pick one and unify.

3. **The link integrity check.** Every `→ Consult [...]` arrow link, every "See in `/sublime`" cross-reference, every README index entry must resolve. No 404s.

4. **The voice consistency spot-check.** Pick three random sections from three random files. Read them aloud. They should sound like the same author. If one drifts toward neutral-encyclopedia voice or tutorial voice, rewrite.

5. **The naming consistency check.** Anti-pattern names in the catalog, in the references, and in `SKILL.md` must be identical. No "phantom assertion" in one place and "phantom test" in another.

---

## Open decisions — flag back to user before starting

These are not decided in this plan. Claude Code should pause and ask if any of these are unresolved when reached.

1. **Brand and repo name.** Confirm "Sublime" is the final name. If yes, confirm the repo and namespace (`<org>/sublime`).

2. **License.** MIT, Apache-2.0, or other?

3. **Install mechanism.** Three options:
   - (a) Distribute via the existing `skills` CLI (impeccable-style): `npx skills add <org>/sublime`. Requires Sublime to follow whatever skill-format spec that CLI expects.
   - (b) Standalone npm package with a custom CLI.
   - (c) Plain git clone + manual context-load. Lowest friction to ship; lowest discoverability.

4. **Anti-pattern catalog organization.** Per-category files (currently planned) vs one big `anti-patterns.md`. Per-category is cleaner for browsing; single file is easier to grep.

5. **React-in-TS scope.** Should the TypeScript extension include React patterns (currently planned), or split React into its own `react/` skill that builds on `typescript/`?

6. **Landing page.** Is this build limited to the repo + README, or do we also want a standalone marketing site at a domain (parallel to impeccable.style)? If yes, that becomes a Phase 7.

7. **Voice authorship.** Should the foundation and references be attributed to a single named author (impeccable.style is by Paul Bakaus), or anonymous/collective? Affects voice in subtle ways.

---

## Out of scope for this build

- Python, Rust, Go language extensions (build later, same shape as TypeScript extension).
- A `visual mode` equivalent (impeccable has one; for code, the parallel would be IDE integration showing slop highlighted in-editor — large engineering project, not in this build).
- Telemetry, analytics, opt-in feedback — none of that.
- A web UI for the catalog — README-level browsability is enough.

---

## Suggested dispatch sequence

If running phase-by-phase with review checkpoints, this is the cleanest ordering:

1. **Phase 1** (1 session) → review the foundation.
2. **Phase 2** (2–3 sessions; references in batches of 3–4) → review reference voice consistency.
3. **Phase 3** (1–2 sessions) → review anti-pattern entries for shape consistency, then publish.
4. **Phase 4** (1–2 sessions) → review command set for completeness and overlap.
5. **Phase 5** (1–2 sessions) → use the TypeScript extension on a real TS project; iterate.
6. **Phase 6** (1 session) → ship.

If running end-to-end with one final review, expect 4–6 hours of Claude Code work and 2–3 hours of human review.
