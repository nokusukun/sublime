---
name: refactor
description: "Restructure existing code for clarity — extract, inline, collapse, split — without changing behavior or names. Behavior preservation is the contract; the diff must shrink more than it grows. Use when a module has drifted into deep nesting, god components, copy-paste duplication, or layered indirection, and the shape is wrong but the logic is right."
argument-hint: "[target]"
license: MIT
user-invocable: true
---

## MANDATORY PREPARATION

Invoke `{{command_prefix}}sublime` — it contains the code-craft foundation, the Hard BANs, the AI Slop Test, and the Code Context Gathering Protocol. Every sublime verb leans on it.

Follow the Context Gathering Protocol before proceeding. If no `.sublime.md` exists and no Code Context has been loaded, you MUST run `{{command_prefix}}sublime teach` first and gather context interactively. Do NOT skip this step. Do NOT infer Code Context from the codebase alone — conventions in a codebase are usually load-bearing, and only the author can tell you the invariants.

---

# /refactor

Restructure existing code for clarity without changing its behavior or its names.

## When to use it

Reach for `/refactor` when the code works but its shape is wrong: a function that nests four levels deep, a module where two concepts are tangled into one, a handler that does three things in sequence without seams. The semantics are fine; the structure hides them. Use `/tighten` instead when the code is structurally fine but noisy. Use `/name` instead when the structure is fine but the identifiers mislead. A refactor can surface naming or noise problems — flag them, do not fix them in the same pass.

## How it works

1. **Confirm behavior is locked.** Read the tests. If no tests pin the behavior you are about to preserve, say so before touching code. A refactor without a behavioral net is a rewrite pretending otherwise.
2. **Name the structural problem.** In one sentence: "This function does parsing and validation and dispatch in one body." "This module conflates the queue and the worker." If you cannot name it, do not refactor.
3. **Pick one move.** Extract function, inline variable, collapse conditional, split module, invert dependency, replace nested `if` with early returns. One move per commit.
4. **Preserve the public surface.** Exported signatures, parameter order, thrown error types, return shapes — all unchanged. The diff lives inside the function body or between private helpers.
5. **Shrink the diff, not grow it.** A good refactor usually removes more lines than it adds. If the diff grew, you probably restructured *and* added features. Separate them.
6. **Re-run the tests.** Green before, green after, same assertions. If a test had to change, the behavior changed — you did a rewrite, not a refactor.

## Try it

Input — a 40-line handler mixing validation, DB work, and response formatting:

```ts
async function createOrder(req, res) {
  if (!req.body.userId) return res.status(400).json({error: "missing userId"});
  if (!req.body.items?.length) return res.status(400).json({error: "no items"});
  const user = await db.users.find(req.body.userId);
  if (!user) return res.status(404).json({error: "user not found"});
  // ... 30 more lines of DB work and formatting
}
```

Expected output — same behavior, structure now telegraphs its shape:

```ts
async function createOrder(req, res) {
  const input = parseOrderInput(req.body);         // throws ValidationError
  const order = await placeOrder(input);            // throws NotFoundError, ConflictError
  return res.status(201).json(formatOrder(order));
}
```

Three named helpers, each one concern. Public route unchanged. Tests unchanged.

## Pitfalls

- **Refactor-plus-rewrite.** Sneaking a behavior change under a refactor PR. The reviewer signs off on "no behavior change" and ships a bug. Keep them separate.
- **Renaming during a refactor.** Rename is a `/name` pass. Combining them makes the diff unreviewable — the reviewer cannot tell which lines moved and which got a new identifier.
- **Extracting too early.** Pulling out a helper with one caller for "future reuse." You just paid reading tax for no one. Extract when the second caller appears, or when the extracted name genuinely reads better at the call site.
- **Refactoring without tests.** You are not preserving behavior; you are hoping. Add a characterization test first, then refactor.

## SKILL.md

You are operating in `/refactor` mode. Your job is to restructure code for clarity without changing its observable behavior or its identifiers.

**Mission.** Take working code whose shape obscures its intent and produce working code whose shape telegraphs its intent. You are not rewriting, not renaming, not adding features, not removing ceremony. You are moving structure.

**Method.**

1. **Gather context.** Confirm `.sublime.md` or loaded instructions provide consumer, contract, invariants, and failure posture. Refer to `../sublime/SKILL.md` for the Context Gathering Protocol. If no tests pin the behavior, state that refactoring is unsafe and ask the user to confirm or to add a characterization test first.

2. **Name the structural problem in one sentence.** If you cannot, stop. Examples of legitimate problems: nested conditionals deeper than two levels, a function that requires "and" to describe, two concepts in one module, duplicated logic in three or more sites, a boundary that leaks internals.

3. **Choose one move.** Prefer, in order: early-return to flatten, extract named helper, inline redundant variable, split module, replace conditional with polymorphism, invert dependency. Do not combine moves in one diff.

4. **Preserve the surface.** Exported names, argument order, return types, thrown error types, logged messages, HTTP contracts — all identical. The change is structural, not interfacial.

5. **Keep the diff small.** Aim for fewer lines after than before. A growing refactor is usually a disguised rewrite.

6. **Verify behavior.** Every existing test still passes without modification. If a test needed changing, the behavior changed — abandon the diff or reclassify it as a rewrite.

7. **Surface adjacent problems, do not fix them.** If you notice bad names, call them out as a candidate `/name` pass. If you notice ceremony, flag a `/tighten` pass. Do not bundle.

**Invocation example.** `{{command_prefix}}refactor src/orders/handler.ts` — restructures one file. `{{command_prefix}}refactor --function placeOrder` — scopes to a single function.

**References.**
- `../sublime/SKILL.md` — foundation, especially *Control flow & structure* and *Interfaces & boundaries*.
- `../sublime/references/control-flow.md` — flattening patterns, extraction heuristics, the one-screen rule.
- `../sublime/references/interfaces.md` — when a structural split crosses a module boundary.
- `../anti-patterns/architectural-slop.md` — the god-component and god-handler patterns that most often prompt a refactor.
- `../anti-patterns/gratuitous-abstraction.md` — the limit case: over-refactoring into single-use abstractions.

**Non-negotiables.** Do not rename identifiers. Do not change behavior. Do not add tests (unless characterization tests are needed before the refactor; those are a separate commit). Do not bundle moves. Shrink the diff.
