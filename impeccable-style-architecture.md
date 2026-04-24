# impeccable.style: Full content and architectural analysis

**impeccable.style is not a writing style guide in the traditional sense — it is an installable "skill" (a structured prompt bundle) that teaches AI coding agents design fluency, plus a curated vocabulary of 18 slash commands and 37 anti-patterns that operate on that foundation.** The word "style" in the domain refers to *aesthetic craft delivered to AI harnesses* (Claude Code, Cursor, Codex CLI, Gemini CLI, etc.), not to prose style. It is an opinionated design handbook, a taxonomy of failures, and a verb system — fused into a single SKILL.md artifact that gets loaded into the AI's context every time it writes frontend code. This is a very useful template to mirror for code: it shows how to build *one deep foundational skill* plus *many narrow, imperatively-named commands* that all reach back to the foundation.

The project was built by Paul Bakaus as an upgrade to Anthropic's original `frontend-design` skill. Below you will find (1) a structural map of the site and its hierarchy, (2) the verbatim core content of the foundational SKILL.md and the 7 reference files, (3) the full anti-pattern catalog, and (4) a detailed voice/format analysis tuned for re-use on a code spec.

---

## 1. Site map and information architecture

The site has five top-level destinations, and the structure itself is the spec:

| URL | Role |
|---|---|
| `/` (home) | Marketing + BLUF: numbered sections **01 Foundation → 07 FAQ**. Pitches the philosophy, install, changelog. |
| `/skills` (Docs) | The command catalog, grouped by intent into **Create · Evaluate · Refine · Simplify · Harden**. |
| `/skills/impeccable` | The **core/foundation skill** — the canonical SKILL.md loaded into AI context. Everything else leans on it. |
| `/skills/<name>` (×17 more) | One page per command: *When to use it · How it works · Try it · Pitfalls · SKILL.md inline*. |
| `/anti-patterns` | 37 rules in 8 categories (Visual Details, Typography, Color & Contrast, Layout & Space, Motion, Interaction, Responsive, General quality), each tagged **AI slop** or **Quality**, and **CLI / Browser / LLM-only** for how it is detected. |
| `/visual-mode`, `/cheatsheet`, `/tutorials/*` | Supporting surfaces. |

The hierarchy is clean and deliberate: **one foundation, five verb categories, a parallel anti-pattern catalog, and deeper reference files embedded inside the foundation**. This is exactly the shape you would mirror for a code spec — a single `/impeccable-code` foundation, verb-style skills (`/refactor`, `/tighten`, `/harden`, `/name`, `/simplify`, `/audit`), and a language-specific extension (`/impeccable-code typescript`) that replaces or augments the reference files.

### The five intent categories (from `/skills`)

> One skill, `/impeccable`, teaches your AI design. Eighteen commands steer the result. Each command does one job with an opinion about what good looks like.
> 
> Skills are named after the intent you bring to them. Reviewing something? `/critique` or `/audit`. Fixing type? `/typeset`. Last-mile pass before shipping? `/polish`.

- **Create** (2): `/impeccable`, `/shape` — build something new from blank.
- **Evaluate** (2): `/audit` (technical quality), `/critique` (design quality).
- **Refine** (8): `/animate`, `/bolder`, `/colorize`, `/delight`, `/layout`, `/overdrive`, `/quieter`, `/typeset` — improve one dimension.
- **Simplify** (3): `/adapt`, `/clarify`, `/distill` — strip complexity.
- **Harden** (3): `/harden`, `/optimize`, `/polish` — make production-ready.

Plus three sub-modes on the foundation itself: `/impeccable teach` (project context setup), `/impeccable craft` (full shape-then-build flow), `/impeccable extract` (pull reusable components into the design system).

---

## 2. Core philosophy (what "impeccable style" actually means)

Distilled from the homepage and the core SKILL.md:

> **Great design prompts require design vocabulary. Most people don't have it.** Impeccable teaches your AI real design and gives you 18 commands to steer the result.

> Every AI model learned from the same templates. Without intervention, they all produce the same predictable mistakes. Impeccable names them, detects them, and teaches the AI to avoid them.

Three pillars underlie the whole project:

1. **Deep reference knowledge across 7 dimensions**, loaded every time the AI writes code. (Typography, Color & Contrast, Spatial Design, Motion, Interaction, Responsive, UX Writing.)
2. **18 commands forming a shared vocabulary** between you and your AI — each encodes a specific discipline so you can steer with precision.
3. **A curated anti-pattern library** — "Every AI model learned from the same templates. Without intervention, they all produce the same predictable mistakes." The biggest conceptual unlock is the **anti-attractor procedure**: forcing the model to enumerate and reject its reflex defaults before picking.

The home page uses a numbered ladder that itself is a tiny manifesto:

> **01 The Foundation.** Before commands, before detection, Impeccable teaches your AI real design. Deep reference knowledge across 7 dimensions, loaded every time your AI writes code.
>
> **02 The Language.** 18 commands form a shared vocabulary between you and your AI. Each one encodes a specific design discipline, so you can steer with precision.
>
> **03 The Antidote.** Every AI model learned from the same templates. Without intervention, they all produce the same predictable mistakes. Impeccable names them, detects them, and teaches the AI to avoid them.
>
> **04 Visual Mode.** See design issues highlighted directly on the page. No screenshots, no guesswork.
>
> **05 Get Started.** `npx skills add pbakaus/impeccable`.

That three-word trio — **Foundation · Language · Antidote** — is the cleanest way to describe the entire philosophy, and the single most useful structure to steal for a code version.

---

## 3. The foundation: full text of the `/impeccable` SKILL.md

This is the heart of the spec. It is what gets injected into the AI's context window on every design task. It is presented here essentially verbatim; the structure alone is the blueprint for a code equivalent.

### 3.1 Top-level structure of the foundation

```
## Context Gathering Protocol          ← mandatory preflight
## Design Direction                    ← commit to a bold vision
## Frontend Aesthetics Guidelines
    ### Typography                     → also links to reference-typography
    ### Color & Theme                  → also links to reference-color-and-contrast
    ### Layout & Space                 → also links to reference-spatial-design
    ### Visual Details                 ← hard "BAN" patterns
    ### Motion                         → also links to reference-motion-design
    ### Interaction                    → also links to reference-interaction-design
    ### Responsive                     → also links to reference-responsive-design
    ### UX Writing                     → also links to reference-ux-writing
## The AI Slop Test                    ← one-line quality gate
## Implementation Principles
## Craft Mode / Teach Mode / Extract Mode   ← sub-mode branches
## Deeper reference                    ← 7 long reference files appended
```

Each aesthetics subsection follows the **same internal shape** — a pattern ripe for reuse:

1. A **one-line arrow link** pointing to the deeper reference: *"→ Consult [typography reference] for OpenType features, web font loading, and the deeper material on scales."*
2. A short paragraph stating the **governing belief** ("Choose fonts that are beautiful, unique, and interesting. Pair a distinctive display font with a refined body font.").
3. **"Always apply these — do not consult a reference, just do them"**: 3–5 bullet rules that are non-negotiable and inline.
4. In critical subsections, an **anti-attractor procedure** (e.g., a font-selection step procedure that forces the model to reject its reflex fonts).
5. A **DO** list (short imperatives).
6. A **DO NOT** list (with reason).

### 3.2 The Context Gathering Protocol

> Design skills produce generic output without project context. You MUST have confirmed design context before doing any design work.
>
> **Required context** (every design skill needs at minimum):
> - **Target audience**: Who uses this product and in what context?
> - **Use cases**: What jobs are they trying to get done?
> - **Brand personality/tone**: How should the interface feel?
>
> **CRITICAL**: You cannot infer this context by reading the codebase. Code tells you what was built, not who it's for or what it should feel like. Only the creator can provide this context.
>
> **Gathering order:**
> 1. **Check current instructions (instant)**: If your loaded instructions already contain a **Design Context** section, proceed immediately.
> 2. **Check .impeccable.md (fast)**: If not in instructions, read `.impeccable.md` from the project root.
> 3. **Run impeccable teach (REQUIRED)**: If neither source has context, you MUST run `/impeccable teach` NOW before doing anything else.

This **refusal-until-context** pattern is one of the most distinctive design moves in the spec. For code, the parallel is "refuse to modify code until you know the contract, the invariants, and the consumer."

### 3.3 Design Direction (the BOLD commitment)

> **Commit to a BOLD aesthetic direction:**
> - **Purpose**: What problem does this interface solve? Who uses it?
> - **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc.
> - **Constraints**: Technical requirements (framework, performance, accessibility).
> - **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?
>
> **CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work. The key is intentionality, not intensity.

### 3.4 Aesthetics guidelines — Typography (verbatim excerpt to show form)

> Choose fonts that are beautiful, unique, and interesting. Pair a distinctive display font with a refined body font.
>
> **Always apply these — do not consult a reference, just do them:**
> - Use a modular type scale with fluid sizing (clamp) for headings on marketing/content pages. Use fixed `rem` scales for app UIs and dashboards.
> - Use fewer sizes with more contrast. A 5-step scale with at least a 1.25 ratio between steps creates clearer hierarchy than 8 sizes that are 1.1× apart.
> - Line-height scales inversely with line length. Narrow columns want tighter leading, wide columns want more. For light text on dark, ADD 0.05-0.1 to normal line-height.
> - Cap line length at ~65-75ch.
>
> **[Anti-attractor procedure — DO THIS BEFORE TYPING ANY FONT NAME]**
>
> The model's natural failure mode is "I was told not to use Inter, so I will pick my next favorite font, which becomes the new monoculture." Avoid this by performing the following procedure on every project, in order:
>
> *Step 1.* Read the brief once. Write down 3 concrete words for the brand voice (e.g., "warm and mechanical and opinionated", "calm and clinical and careful"). NOT "modern" or "elegant" — those are dead categories.
>
> *Step 2.* List the 3 fonts you would normally reach for. Reject every font on the reflex_fonts_to_reject list (Fraunces, Newsreader, Lora, Crimson, Playfair Display, Cormorant, Syne, IBM Plex, Space Mono, Space Grotesk, Inter, DM Sans, DM Serif, Outfit, Plus Jakarta Sans, Instrument Sans/Serif, …). They are your training-data defaults.
>
> *Step 3.* Browse a font catalog with the 3 brand words in mind. Look for something that fits the brand as a *physical object* — a museum caption, a hand-painted shop sign, a 1970s mainframe terminal manual, a fabric label. Reject the first thing that "looks designy."
>
> *Step 4.* Cross-check. The right font for an "elegant" brief is NOT necessarily a serif. The right font for a "technical" brief is NOT necessarily a sans-serif.
>
> **DO** use a modular type scale with fluid sizing on headings.
> **DO** vary font weights and sizes to create clear visual hierarchy.
> **DO** vary your font choices across projects.
>
> **DO NOT** use overused fonts like Inter, Roboto, Arial, Open Sans, or system defaults.
> **DO NOT** use monospace typography as lazy shorthand for "technical/developer" vibes.
> **DO NOT** put large icons with rounded corners above every heading.
> **DO NOT** use only one font family for the entire page.
> **DO NOT** use a flat type hierarchy where sizes are too close together.
> **DO NOT** set long body passages in uppercase.

### 3.5 Visual Details (the "hard BAN" pattern)

Certain rules are elevated to CSS-pattern-level **BANs** with a unique form: pattern, forbidden examples, why, rewrite guidance.

> **BAN 1: Side-stripe borders on cards/list items/callouts/alerts**
> - PATTERN: `border-left:` or `border-right:` with width greater than 1px
> - INCLUDES: hard-coded colors AND CSS variables
> - FORBIDDEN: `border-left: 3px solid red`, `border-left: 4px solid var(--color-warning)`, `border-left: 5px solid oklch(...)`
> - WHY: this is the single most overused "design touch" in admin, dashboard, and medical UIs. It never looks intentional regardless of color, radius, opacity, or variable name.
> - REWRITE: use a different element structure entirely. Do not just swap to box-shadow inset. Reach for full borders, background tints, leading numbers/icons, or no visual indicator at all.
>
> **BAN 2: Gradient text**
> - PATTERN: `background-clip: text` combined with a gradient background
> - FORBIDDEN: any fill coming from `linear-gradient`, `radial-gradient`, or `conic-gradient`
> - WHY: one of the top three AI design tells
> - REWRITE: use a single solid color for text. If you want emphasis, use weight or size.

The BAN form is extremely stealable for code: *pattern · forbidden examples · why · rewrite*.

### 3.6 The AI Slop Test (a single-line gate)

> **Critical quality check**: If you showed this interface to someone and said "AI made this," would they believe you immediately? If yes, that's the problem.
>
> A distinctive interface should make someone ask "how was this made?" not "which AI made this?"

The code equivalent writes itself: *"If you showed this code and said 'AI wrote this,' would they believe you?"*

### 3.7 Implementation Principles (the closing punch)

> Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention.
>
> Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. NEVER converge on common choices across generations.
>
> Remember: {{model}} is capable of extraordinary creative work. Don't hold back.

---

## 4. The seven reference files (depth layer)

Appended inside the foundation under `## Deeper reference`, each is a self-contained technical essay of ~1,500–2,500 words. **These are the closest analog to "language-specific" docs you're building** — they are domain-specific *dimensions* rather than language-specific, but the mechanics of how they attach to the core are identical to how a TypeScript extension would attach.

Each reference has the same internal beats: **short taxonomy → tables → code samples → "Avoid:" closer.**

| Reference | Typical structure | Characteristic content |
|---|---|---|
| **Typography** | Classic principles → Font selection → Web loading → System architecture → Accessibility | Vertical rhythm, modular scale, anti-reflex process, `size-adjust` fallback overrides, OpenType features, fluid type rules. |
| **Color & Contrast** | OKLCH > HSL → Functional palettes → Contrast/WCAG → Theming → Alpha is a smell | Tinted neutrals, 60-30-10 as *visual weight*, "Dark mode is not inverted light mode." |
| **Spatial Design** | 4pt base → Grid → Hierarchy → Container queries → Optical adjustments → Depth | Self-adjusting grid, Squint Test, touch-target-vs-visual-size pattern. |
| **Motion** | 100/300/500 rule → Easing curves → Two animatable properties → Stagger → Reduced motion → Perceived performance | "Exit animations are ~75% of enter duration"; the 80ms threshold; ban on bounce/elastic. |
| **Interaction** | Eight states → Focus rings → Forms → Loading → Modals (inert) → Popover API → Anchor positioning → Destructive actions → Keyboard → Gestures | "Undo > Confirm"; roving tabindex; position-anchor patterns. |
| **Responsive** | Mobile-first → Content-driven breakpoints → Input method > screen size → Safe areas → Images → Testing | Pointer/hover queries, `env(safe-area-*)`, "Don't trust DevTools alone." |
| **UX Writing** | Button labels → Error messages → Empty states → Voice vs Tone → Accessibility → Translation → Consistency | Error formula (what/why/how), expansion factors by language, "Never humor for errors." |

Each closes with a crisp **Avoid:** list — a recurring structural motif.

---

## 5. Anti-patterns catalog (the Antidote)

The `/anti-patterns` page is a parallel spec, **37 rules in 8 sections**, each rule tagged two axes:

- **Kind**: `AI slop` (the visible tells of AI-generated UIs) vs `Quality` (general design mistakes that are not AI-specific).
- **Detection**: `CLI` (deterministic file scan) vs `Browser` (deterministic but needs browser layout) vs `LLM only` (only `/critique`'s review pass catches it).

Selected rules to show the form (each is ~one sentence description + rewrite guidance + "See in /impeccable" backlink):

- **Side-tab accent border** — *AI slop · CLI.* Thick colored border on one side of a card — the most recognizable tell.
- **Glassmorphism everywhere** — *AI slop · LLM only.* Blur/glass/glow used as decoration rather than to solve a real layering problem.
- **Rounded rectangles with generic drop shadows** — *AI slop · LLM only.* The safest, most forgettable shape on the web.
- **Flat type hierarchy** — *AI slop · CLI.* Font sizes too close together. Aim for ≥1.25 ratio.
- **Overused font** — *AI slop · CLI.* Inter, Roboto, Open Sans, Lato, Montserrat, Arial.
- **AI color palette** — *AI slop · CLI.* Purple/violet gradients and cyan-on-dark.
- **Gradient text** — *AI slop · CLI.* Use solid colors for text.
- **Hero metric layout** — *AI slop · LLM only.* Big number, small label, three supporting stats, gradient accent.
- **Identical card grids** — *AI slop · LLM only.* Same-sized cards with icon + heading + text repeated endlessly.
- **Nested cards** — *AI slop · CLI.* Flatten the hierarchy.
- **Bounce or elastic easing** — *AI slop · CLI.* Use exponential easing instead.
- **Every button is a primary button** — *Quality · LLM only.* Hierarchy matters.
- **Redundant information** — *Quality · LLM only.* "Intros that restate the heading. Section labels that repeat the page title."
- **Amputating features on mobile** — *Quality · LLM only.* Adapt, do not strip.
- **Low contrast text** — *Quality · CLI.* WCAG 4.5:1 / 3:1.
- **Skipped heading level** — *Quality · CLI.* h1 → h3 without h2.
- **Tiny body text** — *Quality · CLI.* Below 12px.

The catalog is the **mirror image** of the foundation: every DO/DON'T in the handbook has (ideally) a detectable anti-pattern here. For code, this is your lint catalog: every principle in the foundation gets a named anti-pattern with a machine-detectable signature when possible.

---

## 6. Voice, tone, and format — the style of the style spec

This is the most reusable layer. The writing has a very specific, consistent voice that you can imitate directly.

### 6.1 Voice: opinionated expert, not neutral reference

- **Second-person, imperative.** "Don't use `ease`. It's a compromise that's rarely optimal." / "Stop using HSL." / "Never `outline: none` without replacement."
- **Declares positions, refuses hedging.** "Pure gray is dead." "Alpha is a design smell." "Modals are lazy."
- **Frames itself as a *partner*, not a *linter*.** From the /impeccable page: *"It is an opinionated design partner, not a linter. The defaults exist to raise the floor, not to overrule your judgment. If you have a real reason to push back, push back and explain why."*
- **Self-aware about AI failure modes.** Rules are explicitly written against the model's known reflexes ("Your natural failure mode is…").
- **Dry humor surfaces occasionally.** "Gallery of Shame." "Cyberpunk-by-default slop." "Every SaaS homepage looks like this."

### 6.2 Format: a tight vocabulary of recurring shapes

Every section reuses the same small kit of structures. This is key — a reader (or AI) always knows what to expect.

1. **Governing belief** — one short paragraph asserting the principle.
2. **"Always apply these — do not consult a reference, just do them"** — 3–5 inline non-negotiable bullets.
3. **Anti-attractor procedure** (used sparingly, for the highest-risk areas) — numbered Step 1 / Step 2 / Step 3 / Step 4 that force reflex rejection before a choice.
4. **DO / DO NOT lists** — short imperatives, each DO NOT paired with a brief *why*.
5. **BAN blocks** — *pattern · forbidden examples · why · rewrite*.
6. **Tables** for multi-axis comparisons (duration/use/CSS; state/when/visual; role/ratio/use case).
7. **Inline code examples** at exactly the point where abstract guidance would otherwise be unfalsifiable.
8. **Arrow-link to deeper reference**: *"→ Consult [typography reference] for the deeper material on scales."* — separates *what you always do* from *what you optionally consult*.
9. **Closing "Avoid:" line** on every reference file — a one-line summary of anti-patterns.

### 6.3 Per-command page template (`/skills/<name>`)

Every one of the 18 command pages follows the same 5-beat structure, which is worth copying exactly for code commands:

1. **One-sentence purpose** ("The meticulous final pass between good and great.")
2. **When to use it** — the intent framing and the sub-modes if any.
3. **How it works** — the method, usually in 3–6 dimensions or steps.
4. **Try it** — a concrete invocation with a realistic example.
5. **Pitfalls** — 2–4 common mistakes, named. ("Polishing work that is not done." / "Treating polish as redesign." / "Running /polish without /audit first.")
6. **SKILL.md** — the canonical, templateable skill definition the AI harness loads, with `{{command_prefix}}` placeholders.

### 6.4 Homepage BLUF pattern

The numbered **01 Foundation · 02 Language · 03 Antidote · 04 Visual · 05 Install · 06 New · 07 FAQ** structure is worth copying. Two words per section, with a one-line elaboration underneath. That numbering turns the landing page itself into the mental model.

---

## 7. How this maps to a code equivalent

Because your goal is to mirror this for code (core + TypeScript extension), here is the direct mapping this spec hands you:

**Foundation → `/impeccable-code` (language-agnostic core).** Shape it as:
- **Context Gathering Protocol** → *know the consumer, the invariant, the failure mode before touching the code.*
- **Code Direction** → commit to an intent (readability-first, performance-critical, throwaway, library-for-others) the way `/impeccable` commits to an aesthetic.
- **Craft Guidelines** in ~7 dimensions, each with *Always apply these* + *DO / DO NOT* + deeper reference link. Candidate dimensions:
  1. Naming
  2. Control flow & structure
  3. Data modeling & state
  4. Errors & failure modes
  5. Interfaces & boundaries
  6. Tests
  7. Comments & docs
- **Hard BANs** (the code equivalent of gradient text): mutation-through-aliased-refs, catch-and-swallow, nullable-as-error-channel, magic numbers, etc.
- **The AI Slop Test for code**: *"If you showed this code and said 'AI wrote this,' would they believe you immediately?"* — and enumerate the tells (over-abstraction, defensive `try/catch` on everything, stringly-typed everything, redundant comments, `utils.ts`, gratuitous helper layers).
- **Implementation Principles** closing.

**Language (verbs) → your `/refactor`, `/tighten`, `/audit`, `/name`, `/simplify`, `/harden`, `/optimize`, `/extract`, `/critique`, `/polish`** — group by *Create / Evaluate / Refine / Simplify / Harden*. Use the exact per-command template (When / How / Try / Pitfalls / SKILL.md).

**Antidote → your `/code-anti-patterns`** catalog, tagged `AI slop` vs `Quality` and `AST` (detectable statically) vs `Type-checker` vs `LLM only`. Mirror the 37-rule density.

**Language-specific skill → `/impeccable-code typescript`**, which is exactly analogous to the 7 reference files but scoped to TS: discriminated unions, strict null checks, `unknown` vs `any`, `as` casts, module boundaries, `readonly`, branded types, narrowing, declaration files. Each file uses the same internal shape as the design references: taxonomy → tables → code samples → closing *Avoid:* list.

**Voice to imitate.** Second-person imperative. Explicit about AI failure modes. Opinionated, not neutral. Refuses hedging. Pairs every *DO NOT* with a *why*. Uses *anti-attractor procedures* (Step 1 / Step 2 / Step 3) at the highest-risk decision points — for code, that is probably *naming*, *error handling*, and *abstraction choice*, where the model has the strongest reflex defaults.

## Conclusion

impeccable.style succeeds because it isolates three independently-reusable layers — **a vocabulary (commands), a foundation (principles + references), and an antidote (anti-patterns)** — and lets them reinforce one another. Every command leans on the foundation; every anti-pattern mirrors a rule in the foundation; every reference file closes with an *Avoid:* that feeds the anti-patterns. The voice is confident, imperative, and explicitly anti-reflex. Mirror those three layers and that voice for code, and the TypeScript extension almost writes itself as one more reference file appended to the core — exactly how the 7 design references attach to `/impeccable` today.