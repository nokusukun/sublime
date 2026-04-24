# Contributing

Sublime is text. Every contribution is prose — positions, patterns, and prompts. Prose has a voice; match it.

## Voice and style

Non-negotiable. Every file in this repo follows these rules. If yours doesn't, it will be rewritten before merge.

- **Second-person, imperative.** "Don't catch `Error` to be safe." Not "It is generally inadvisable to catch `Error` generically."
- **Declares positions, refuses hedging.** If a sentence begins with "it depends" or ends with "in most cases," rewrite it.
- **AI-aware where it earns it.** Name the model's failure mode when the failure mode is the thing: *"Your natural failure mode is to wrap everything in `try/catch`…"* Don't sprinkle this everywhere — reserve it for the highest-stakes choices.
- **No emoji.** Not in prose, not in code examples, not in log messages, not in headings.
- **No tutorial voice.** No "Let's…", "Now we…", "First, we…".
- **No banner comments.** No `//// SECTION ////`. Use headings.
- **Every `DO NOT` gets a `— why` line.** Rules without reasons don't survive edge cases.
- **No trailing summaries.** Don't explain what you just said.
- **Every reference file closes with `### Avoid`** — a bulleted list of one-liners mapping to the anti-pattern catalog.

## Adding an anti-pattern

1. Pick the right category file in `anti-patterns/`. If no existing category fits, stop and open an issue first.
2. Use the exact entry shape:

    ```markdown
    ### [Pattern name]

    **Tags:** `AI-slop` | `Quality` · `Lint` | `Type-check` | `Review` · `Universal` | `Lang:<x>`

    **Pattern.** [One-sentence signature.]

    **Forbidden example.**
    \`\`\`<lang>
    [3–8 lines showing the slop]
    \`\`\`

    **Why it hurts.** [1–3 sentences. Quote a developer source if you have one.]

    **Rewrite.**
    \`\`\`<lang>
    [3–8 lines showing the fix]
    \`\`\`

    **See in `/sublime`:** [Link to a SKILL.md anchor or a reference file that governs this.]
    ```

3. Add one row to `anti-patterns/README.md`'s alphabetical index.
4. If the pattern is TS-specific, put it in `languages/typescript/anti-patterns.md` instead and link from the README.

### Tag discipline

- `AI-slop` vs `Quality`: `AI-slop` = visible tell that an LLM wrote the code. `Quality` = general design mistake that happens to be common in LLM output. Pick one.
- `Lint` / `Type-check` / `Review`: how is it detected? `Lint` = static AST or regex. `Type-check` = the type system catches it. `Review` = needs semantic understanding.
- `Universal` vs `Lang:<x>`: scope. If the pattern is scoped to one language, use `Lang:TS`, `Lang:Python`, etc.

## Adding a command

Each command is its own Agent Skill, a sibling directory at the repo root.

1. Create `<verb>/SKILL.md` at the repo root (not nested — the directory name is the skill name).
2. Every `SKILL.md` must open with YAML frontmatter per the [Agent Skills spec](https://agentskills.io/spec):

    ```markdown
    ---
    name: <verb>
    description: [what it does + when to use it, under 1024 chars]
    license: MIT
    ---
    ```

    The `name` field must match the parent directory name exactly (lowercase, hyphens only, no leading/trailing/consecutive hyphens). Validate with `skills-ref validate ./<verb>` if you have [skills-ref](https://github.com/agentskills/agentskills/tree/main/skills-ref) installed.

3. Follow the six-beat body template:

    ```markdown
    # /<verb>

    [One-sentence purpose.]

    ## When to use it
    ## How it works
    ## Try it
    ## Pitfalls
    ## SKILL.md
    ```

4. The `## SKILL.md` block is the canonical prompt the harness loads. It must work standalone — it can reference [sublime/SKILL.md](sublime/SKILL.md), but it must not assume the foundation is already loaded.
5. Add the command to the catalog in [README.md](README.md) under the right intent group (Create / Evaluate / Refine / Simplify / Harden).
6. Commands should be 400–800 words total (body, not counting frontmatter). Keep each `SKILL.md` under 500 lines per the spec's progressive-disclosure guidance — move depth to `<verb>/references/` if needed.

## Adding a language extension

Language extensions live under [`languages/`](languages/), each its own Agent Skill. [`languages/typescript/`](languages/typescript/) is the canonical template — copy its shape, not its content.

### Directory layout

```
languages/<lang>/
├── SKILL.md                   # Required. Frontmatter + scoped foundation.
├── anti-patterns.md           # Required. Language-specific slop catalog.
└── references/                # Required. One file per craft dimension in this language.
    ├── <dimension-1>.md
    ├── <dimension-2>.md
    └── ...
```

The directory name **is** the skill name (spec requirement). Use the plainest name the language is known by: `typescript`, `python`, `rust`, `go`, `swift`, `kotlin`. No version numbers, no qualifiers.

### File-by-file checklist

**`<lang>/SKILL.md`** — frontmatter (`name: <lang>`) + body, 2,500–3,500 words. Mirror the core foundation's beats, scoped:

1. Opening one-sentence positioning of what this language rewards and how slop escapes it.
2. `## Context Gathering Protocol (<Lang>)` — what to check first (compiler/runtime version, framework, package manager, build tool, config strictness).
3. `## <Lang> Direction` — commit to a posture (strictness level, compatibility targets).
4. `## Craft Guidelines` — 5–7 language-specific dimensions, each with `→ Consult <ref>`, governing belief, *Always apply these* bullets, and `DO` / `DO NOT` lists. Pick dimensions the *language* makes distinctive (TS had: strictness, `any`/`unknown`/`as`, narrowing, branded types, module boundaries, React patterns, generics).
5. `## Hard BANs (<Lang>)` — language-specific `PATTERN · FORBIDDEN · WHY · REWRITE` entries. Only things that are *always* wrong in this language.
6. `## AI Slop Test (<Lang>)` — bulleted catch-on-sight tells specific to this language.
7. `## Implementation Principles` — one short paragraph.
8. `## Deeper reference` — index of the `references/` files and the anti-patterns file.

**`<lang>/references/<dimension>.md`** — 1,200–2,000 words per file, matching the reference-file shape:

1. One-sentence central claim.
2. 4–8 sub-headings forming a taxonomy.
3. At least one table (multi-axis comparison).
4. Inline code examples in the target language (real syntax).
5. `## Common AI failure modes` — pull ≥2 NAMED anti-patterns from [llm-slop-taxonomy.md](llm-slop-taxonomy.md) Category 12 (language-specific) or the universal catalog, by exact name.
6. Closing `### Avoid` bullets.

Reference files do *not* need frontmatter — they are on-demand reads from the parent skill, not separately-registered skills.

**`<lang>/anti-patterns.md`** — language-specific catalog. Open with a one-paragraph intro, then list every language-specific entry using the exact per-entry shape from Category 3 above. Tag scope as `Lang:<X>`.

### Hard rules

- **Load independently.** The extension must work with or without the core [`sublime/`](sublime/) skill loaded. Reference the core — `../../sublime/SKILL.md#hard-bans`, `../../sublime/references/errors.md` — but don't assume it's loaded. Restate any universal principle the extension depends on, concisely.
- **Don't duplicate the core.** If a topic is well-covered in the core and the language doesn't change the position, point at the core and stop.
- **Don't invent new structure.** Same section headings, same beats, same voice. Consistency across extensions is the point — an agent loaded with two language skills should recognize them as members of the same family.
- **Cross-reference exactly.** From a language skill at `languages/<lang>/`, links into the core use `../../sublime/SKILL.md` and `../../sublime/references/<x>.md`. Links into the shared catalog use `../../anti-patterns/<file>.md`. From a reference file at `languages/<lang>/references/`, add one more `../` level. No links to other language siblings — each language is independent.

### Quickstart

```bash
cp -r languages/typescript/ languages/python/
# Rename the `name:` field in languages/python/SKILL.md to `python`.
# Rewrite each section for Python. Delete what doesn't apply.
# Add Python-specific dimensions the TS version wouldn't have — async/await, typing, decorators.
```

Then run the [cross-phase quality gates](#cross-phase-quality-gates) below before opening a PR.

## Length discipline

- Foundation (`SKILL.md`): 3,500–4,500 words.
- Reference files: 1,500–2,500 words each.
- Language extension `SKILL.md`: 2,500–3,500 words.
- Language reference files: 1,200–2,000 words each.
- Anti-pattern entries: 50–150 words each.
- Command `SKILL.md` files: 400–800 words each.

Every additional sentence is reading tax for the AI consuming the skill. Tighter is better.

## Deliberate divergences from Impeccable

Sublime is modeled on [Impeccable](https://impeccable.style). Some Sublime choices **intentionally diverge** from Impeccable's shape. These are the right call for code, and future contributors should not "fix" them back:

- **Separate anti-pattern catalog.** Impeccable's anti-patterns live inline in `SKILL.md` (`<absolute_bans>` + per-dimension DO NOT lists). Sublime ships a [twelve-category catalog](anti-patterns/) as a load-bearing asset, because code anti-patterns are richer, more numerous, and deserve to be addressable across verbs. Every verb skill cross-references catalog entries by name. Keep the catalog.
- **Two-voice verb skill shape.** Impeccable verb skills dive straight into agent instructions. Sublime verb skills have a human-facing `## When to use it` / `## How it works` / `## Try it` / `## Pitfalls` section *before* the `## SKILL.md` canonical agent block. Engineers want to read the verb's character before invoking it. Keep the two-voice shape.
- **Ten Hard BANs instead of two.** Code has more universally-bad-no-matter-what patterns than design does (slopsquatting, `Math.random` for crypto, phantom assertions, SQL concat, etc.). The count is right.
- **Posture taxonomy.** Sublime's Code Direction commits to a *posture* (library / module / script / hot path / glue / prototype) rather than a tone (maximalist / minimalist / brutalist / etc.). Posture is the correct code-equivalent of Impeccable's "Design Direction."
- **Essay-style reference openings.** Sublime references open with a one-sentence governing claim before diving into taxonomy. Impeccable references dive straight into sub-headings. The essay openings set a stronger voice.
- **`### Avoid` bulleted closings.** Sublime references close with a bulleted `### Avoid` block mapping to anti-pattern catalog entries. Impeccable uses a paragraph-form `**Avoid**:` closing. The bulleted form is more scannable and ties one-to-one with the catalog.
- **Language extensions.** Sublime ships language-specific skills under `languages/` (`languages/typescript/`, planned `languages/python/`, `languages/rust/`, `languages/go/`). Impeccable has no analog. Code has language dialects; design does not.
- **Long AI Slop Test.** Sublime's `<sublime_slop_tells>` list runs ~15 tells; Impeccable's is ~5. Code tells are more numerous than design tells.

## Cross-phase quality gates

Before opening a PR, run these checks on your own work:

1. **Would Sublime flag this?** Read your file and ask whether any of the Hard BANs or AI-Slop-Test tells apply. If yes, fix.
2. **Synonym drift.** If you introduced a new term for something already named elsewhere, unify.
3. **Link integrity.** Every arrow link, every cross-reference, every index entry must resolve. No 404s.
4. **Voice.** Read the file aloud. If it drifts toward neutral-encyclopedia voice or tutorial voice, rewrite.
5. **Naming consistency.** Pattern names in the catalog, references, and `SKILL.md` must match exactly.

## Out of scope

- **CLI or package manager.** We ship the text. Integrations belong in other repos.
- **Telemetry, analytics, opt-in feedback.** None.
- **IDE integrations showing slop highlighted in-editor.** Separate project.
