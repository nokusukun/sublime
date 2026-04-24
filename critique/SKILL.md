---
name: critique
description: "Read code and produce a design-quality verdict — whether the concept, names, structure, abstraction level, and interface are right for the problem. Does not produce a diff. Use when you want to know if the design itself is sound, before committing to a refactor. Pairs with audit (technical quality) — audit finds what is broken, critique asks whether it is shaped right."
argument-hint: "[target (file, directory, module...)]"
license: MIT
user-invocable: true
---

## MANDATORY PREPARATION

Invoke `{{command_prefix}}sublime` — it contains the code-craft foundation, the Hard BANs, the AI Slop Test, and the Code Context Gathering Protocol. Every sublime verb leans on it.

Follow the Context Gathering Protocol before proceeding. If no `.sublime.md` exists and no Code Context has been loaded, you MUST run `{{command_prefix}}sublime teach` first and gather context interactively. Do NOT skip this step. Do NOT infer Code Context from the codebase alone — conventions in a codebase are usually load-bearing, and only the author can tell you the invariants.

---

# /critique

Read code and report on design quality — whether the structure, names, and abstractions are right for the problem.

## When to use it

Use `critique` when the code runs, the tests pass, the linter is quiet, and you still want to know: *is this the right shape?* Critique is the design-review partner to `audit`. Audit asks "what is wrong or risky here?" Critique asks "is this the right design?" Reach for it before a merge into a module you will maintain for years, after a first-draft implementation lands, or when reviewing a PR where nothing is broken but something feels off. Do not use it on throwaway scripts — design critique on glue code is its own slop.

## How it works

Critique reviews across five dimensions, in this order:

1. **Concept.** Is the code solving the right problem, at the right layer? Is there a missing concept hiding behind a `Manager`/`Helper`/`Service`? Is one idea stretched across three types, or three ideas compressed into one?
2. **Names.** Do the names read as sentences at the call site? Could you swap a name for its definition and still understand the call? Are names consistent across the module, or does `userData` become `user_data` become `data`? See `../sublime/references/naming.md`.
3. **Structure.** Does the happy path run down the left margin? Are the layers honest — boundary validation at the boundary, domain logic in domain terms? Is the module shaped by the problem, or by a framework template?
4. **Abstraction fit.** Does every abstraction have two real callers? Is there a factory for one producer, a strategy for one strategy, an interface for one implementation? Conversely — is there copy-paste that is *asking* to be extracted, but hasn't been?
5. **Interface.** Is the public surface small? Does the call site read well? Are booleans flag parameters in disguise? Would you enjoy calling this API from another module?

For each dimension: state a position, point to the specific place in the code that proves it, and propose the shape that would be better — without restructuring the code yourself.

## Try it

```
{{command_prefix}}critique src/billing/
```

Expected output shape: five short sections, one per dimension, each with a direct verdict and evidence.

> **Concept.** `BillingService`, `InvoiceManager`, and `PaymentHelper` are the same concept in three shirts. The domain has one idea here — *charges* — and it is spread across three files. The `Manager`/`Service`/`Helper` suffixes are covering for a missing concept. Rename and merge around `Charge`.
>
> **Names.** `processData(x, true, false)` at `billing.ts:87` reads as nothing. The booleans flip refund-mode and dry-run. Split into `chargeCustomer` and `previewCharge`.
>
> **Abstraction fit.** `InvoiceStrategy` has one implementation and one caller. It is pure reading tax. Inline it until a second caller appears.

Critique does not produce a diff. It produces a verdict per dimension with enough evidence to act on.

## Pitfalls

- **Running critique without audit first.** Design critique on broken code is premature. Fix the dangerous findings from `{{command_prefix}}audit` first — the shape of the fixes often clarifies the design question.
- **Treating critique as audit.** Critique is not a bug hunt. Do not list "missing null check on line 42" — that is an audit finding. Keep the critique at the level of concepts, names, structure, abstraction, and interface.
- **Opinion-based critique with no evidence.** Every verdict must point at a specific place in the code. "Feels overengineered" is not a critique; "the `EmailStrategy` interface has one implementation at `email.ts:12` and one call site at `send.ts:34` — inline it" is.
- **Redesigning inside critique.** Critique proposes the better shape; it does not refactor. If the user wants the code restructured, the next command is `refactor` or `simplify`. Keep the scope honest.

## Recommended Actions

Critique produces scores, not diffs. Each dimension maps to a sublime verb that can act on it:

- **Concept** weak → revisit with the human; no verb replaces the conversation.
- **Names** weak → [`{{command_prefix}}name`](../name/SKILL.md) runs the anti-attractor procedure.
- **Structure** weak → [`{{command_prefix}}refactor`](../refactor/SKILL.md) restructures without changing behavior.
- **Abstraction fit** weak → [`{{command_prefix}}simplify`](../simplify/SKILL.md) if over-abstracted; [`{{command_prefix}}extract`](../extract/SKILL.md) if under-abstracted AND a second caller exists.
- **Interface** weak → [`{{command_prefix}}refactor`](../refactor/SKILL.md) with an explicit call-site-first rewrite of the interface.

Re-run `{{command_prefix}}critique` after changes to verify the design bar lifted. Other sublime verbs available: {{available_commands}}

---

## SKILL.md

You are operating in `critique` mode. Your job is to read code and report on *design quality* — whether the structure, names, and abstractions are right for the problem. You are not hunting bugs. You are not producing a diff. You are delivering a design verdict with evidence.

This command is the design-review partner to `audit`. Audit asks *what is wrong or risky here?* Critique asks *is this the right design?* Do not let them blur. If your finding is a correctness risk, a BAN hit, or a slop tell, it belongs in an audit, not here.

**Method.**

**Before you critique:**

1. Verify the Code Context is loaded. Design is judged against consumer, posture, and invariants — you cannot critique a library with script-bar thinking, or vice versa. See `../sublime/SKILL.md` Context Gathering Protocol.

2. Read the target code end-to-end, including neighboring files and call sites. Design quality is relational — you need the surrounding shape to judge the shape of this piece.

**How you review — five dimensions, in order:**

3. **Concept.** Ask: what concept is this code about? Is it named? Is it one concept or several? Is there a missing concept hiding behind a `Manager`/`Service`/`Helper`/`Handler`/`Util` — see `../anti-patterns/naming-slop.md`. Is one concept scattered across three files, or three concepts crammed into one?

4. **Names.** Read the call sites. Do they read as sentences? Could you swap a name with its definition and keep understanding? Check for mid-module casing drift, generic reach-fors (`data`, `item`, `result`, `handle`), and type-shape divergence (`UserData`, `UserInfo`, `UserDetails`). See `../sublime/references/naming.md`.

5. **Structure.** Is the happy path down the left margin? Is validation at the boundary and trust inside, or is the same value re-validated at every layer? Does each function do one thing? Does the file shape come from the problem or from a framework template? See `../sublime/references/control-flow.md`.

6. **Abstraction fit.** For every abstraction, count the real callers. Single-use Factory, Builder, Strategy, Provider, or interface is a BAN — see the BAN list in `../sublime/SKILL.md` and `../anti-patterns/gratuitous-abstraction.md`. Conversely, look for copy-paste across files that is begging for extraction — but only if the second caller already exists.

7. **Interface.** Is the public surface small? Do call sites read well? Are there boolean flag parameters? Are internal types leaking through public signatures? See `../sublime/references/interfaces.md`.

**How you report:**

8. One short section per dimension. Each section delivers a direct verdict, points at the specific place in the code that proves it, and proposes the shape that would be better — without producing the diff.

9. State positions. Refuse hedging. "This is the wrong shape because X" beats "this might potentially be considered slightly awkward."

10. When you see slop tells that are correctness or security risks, note them briefly and say *"this is an audit finding, not a critique one — run `{{command_prefix}}audit` for the full list."* Stay in the design lane.

**Refuse to:** produce a diff (escalate to `refactor` or `simplify`); critique based on feelings without pointing at code; critique a throwaway script as if it were a library.

**Invocation pattern:** `{{command_prefix}}critique <path-or-file>` or `{{command_prefix}}critique <module>`. Best results on modules and directories — single-file critique is often too local to see the design question.
