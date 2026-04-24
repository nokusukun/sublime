---
name: scaffold
description: "Bootstrap a new module, file, or feature using the conventions already present in the codebase. Surveys existing code (naming, structure, imports, error handling, test layout) before emitting the smallest working skeleton that matches local convention. Use when starting a new module or feature in an existing project — never as generic boilerplate generation."
argument-hint: "[module or feature description]"
license: MIT
user-invocable: true
---

## MANDATORY PREPARATION

Invoke `{{command_prefix}}sublime` — it contains the code-craft foundation, the Hard BANs, the AI Slop Test, and the Code Context Gathering Protocol. Every sublime verb leans on it.

Follow the Context Gathering Protocol before proceeding. If no `.sublime.md` exists and no Code Context has been loaded, you MUST run `{{command_prefix}}sublime teach` first and gather context interactively. Do NOT skip this step. Do NOT infer Code Context from the codebase alone — conventions in a codebase are usually load-bearing, and only the author can tell you the invariants.

---

# /scaffold

Bootstrap a new module, file, or feature using the conventions already present in this codebase.

## When to use it

Use `scaffold` when you are about to add a new concept — a new route, a new service, a new type, a new test file — and the codebase already has a shape for that concept. This is not boilerplate generation. It is the opposite: a survey-first command that refuses to produce anything until it has seen how the codebase does this kind of thing, then produces the smallest working skeleton that matches local convention. Reach for `scaffold` instead of asking the model to "create a new X from scratch" — that path produces a generic template; this path produces code that reads like it already belonged.

## How it works

1. **Survey first.** Locate 2–3 existing examples of the nearest analogous concept in the codebase. If none exist, say so and ask the user whether this is a genuinely new category of thing or whether you missed the precedent.
2. **Extract the convention.** Name the conventions the existing examples share: file location, naming pattern, import order, error-handling style, test-file placement, type-level idioms. Write them down explicitly before writing any code.
3. **Confirm the posture.** Restate the posture (library / internal module / one-shot script / hot path) and the consumer. If context is missing, stop and gather it — see the Context Gathering Protocol in the foundation.
4. **Produce the smallest skeleton.** Emit only the files and declarations that are load-bearing for the first real use. No speculative helpers, no placeholder tests that assert nothing, no commented-out hooks "for later."
5. **Hand off explicitly.** List what is intentionally missing and what the next concrete step is — the first real call site, the first real test case, the first integration point.

## Try it

```
{{command_prefix}}scaffold a webhook handler for Stripe payment_intent.succeeded events under src/webhooks/
```

Expected output shape: a short survey ("I found `src/webhooks/github.ts` and `src/webhooks/slack.ts`. Both export a single `handle` function, validate the signature inline, and live alongside a `*.test.ts` peer."), a named-convention block, and a minimal `src/webhooks/stripe.ts` + `src/webhooks/stripe.test.ts` that mirrors the pair exactly — no new abstractions, no unused parameters.

## Pitfalls

- **Scaffolding without surveying first.** If you skip the survey step, you produce the generic tutorial version of the concept and ignore three working precedents sitting next to it. The whole point of this command is to refuse that path.
- **Treating scaffold as boilerplate generation.** Scaffold is not "give me a template." It is "match the template that already lives in this repo." If there is no precedent, say so — do not invent one.
- **Adding speculative surface.** No unused parameters, no empty hook functions, no `// TODO: implement` placeholder tests. Emit only what the first real caller needs.
- **Running scaffold on a codebase you have no context for.** Without the Code Context, you cannot tell which of the existing "conventions" are load-bearing and which are historical accidents. Run `sublime teach` first.

## SKILL.md

You are operating in `scaffold` mode. Your job is to bootstrap a new module, file, or feature using the conventions that already exist in this codebase. You are not generating a template. You are matching the template that already lives here.

**Method.**

**Before you write any code:**

1. Verify the Code Context is loaded (from current instructions or `.sublime.md`). If not, stop and run `sublime teach` — you cannot scaffold without knowing the consumer and invariants. See `../sublime/SKILL.md` for the full Context Gathering Protocol.

2. Locate 2–3 existing examples of the nearest analogous concept in the codebase. Read them. If none exist, ask the user whether this is a genuinely new category or whether you missed the precedent — do not proceed on assumption.

3. Write down the conventions the examples share, explicitly, before writing any code: file location, naming, import order, error-handling posture, test-file placement, type-level idioms, export style.

4. Restate the posture (library / internal module / script / hot path) and the one thing a reader should notice first. Match the bar of the existing code — do not apply library-level ceremony to glue code, do not apply script-level care to a library.

**When you write:**

5. Produce the smallest skeleton that supports the first real use. No speculative helpers. No placeholder tests that only assert `toBeDefined`. No abstractions with one caller — see the single-use abstraction BAN in the foundation and `../anti-patterns/gratuitous-abstraction.md`.

6. Use the names, casing, and import style already in the surrounding files. Mid-file casing drift is a slop tell.

7. If a test file is conventional for this concept in the codebase, produce it alongside. If tests in this codebase assert on specific values and shapes, yours must too — no phantom assertions.

**When you finish:**

8. List what is intentionally missing ("no rate-limit handling yet — the two existing webhooks also defer this"), and name the next concrete step: the first real call site, the first real test case, the first integration point.

**Invocation pattern:** `{{command_prefix}}scaffold <what> [under <where>]`. Always pair with enough context for the survey step — if the user does not name the location, ask before guessing.

**Refuse to:** invent a convention the codebase does not already use; emit 15 files when 3 would do; produce a scaffold that would fail the AI Slop Test in `../sublime/SKILL.md`.
