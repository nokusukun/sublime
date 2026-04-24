---
name: simplify
description: "Strip speculative abstraction back to the smallest version that solves the problem today. Deletes factories, builders, strategies, single-use interfaces, and over-general generics that do not earn their keep. The diff is mostly deletions. Use when a module has grown factory cascades, preemptive interfaces, or seven-layer Clean Architecture for three tables."
argument-hint: "[target]"
license: MIT
user-invocable: true
---

## MANDATORY PREPARATION

Invoke `{{command_prefix}}sublime` — it contains the code-craft foundation, the Hard BANs, the AI Slop Test, and the Code Context Gathering Protocol. Every sublime verb leans on it.

Follow the Context Gathering Protocol before proceeding. If no `.sublime.md` exists and no Code Context has been loaded, you MUST run `{{command_prefix}}sublime teach` first and gather context interactively. Do NOT skip this step. Do NOT infer Code Context from the codebase alone — conventions in a codebase are usually load-bearing, and only the author can tell you the invariants.

---

# /simplify

Strip abstraction back to the smallest version that solves the problem.

## When to use it

Reach for `simplify` when code has accumulated scaffolding it does not earn. Factories with one producer, builders that set three fields, strategy interfaces with a single implementation, generics parameterized over one type, layers of indirection between a caller and what it actually does — these are the targets. Run `simplify` after a feature lands and before you call it done, or whenever a reviewer says "this is more than it needs to be." A correct three-line function beats a correct thirty-line function that does the same thing, and `simplify` is the command that gets you from the second to the first.

## How it works

1. **Identify the core behavior.** Read the code. In one sentence, state what it actually does for its one real caller. If you need "and" twice, split the target before continuing.
2. **Inventory the abstractions.** List every interface, factory, builder, strategy, provider, wrapper class, generic parameter, and indirection layer. For each, name the concrete benefit it delivers today — not the benefit it might deliver if a second caller appears.
3. **Delete what does not earn its keep.** Any abstraction with a single implementation, a single caller, or a speculative-future justification gets inlined. Any wrapper class holding no state becomes a function. Any generic fixed to one type becomes that type.
4. **Collapse the call chain.** If A calls B which only calls C, merge them. If a method exists solely to forward arguments, remove it.
5. **Rerun the AI Slop Test on the diff.** The output should read smaller, flatter, and more honest than the input. If it is larger, you did `extract`, not `simplify`.
6. **Leave a one-line note per deletion** in the PR description — what you removed and why. Reviewers need the trail even when the diff is mostly minus signs.

## Try it

Input — a `UserNotificationServiceFactory` that produces a `UserNotificationService` that holds no state and exposes one method `send(user, message)` which formats a string and calls `emailClient.send`:

```ts
const svc = UserNotificationServiceFactory.create(emailClient);
svc.send(user, "welcome");
```

Expected output — the factory and service are gone; the formatter is a plain function; the call site reads:

```ts
sendWelcome(emailClient, user);
```

Three files deleted, one function added, one call site updated. The PR note reads: "Factory and service held no state and had one caller. Inlined to a function."

## Pitfalls

- **Simplifying behavior, not just structure.** `simplify` preserves what the code does. If you find yourself changing semantics to make the code shorter, stop — that is a different task.
- **Deleting an abstraction with a real second caller.** Before removing, grep for every caller in the repo and in downstream consumers. A second caller that exists but is rarely exercised still counts.
- **Removing a seam the tests rely on.** If a strategy interface exists only so tests can swap implementations, the seam is load-bearing. Keep it or replace it with a simpler seam.
- **Confusing `simplify` with `tighten`.** `tighten` compresses ceremony within a structure. `simplify` deletes structure. Different commands, different diffs.

## SKILL.md

You are operating in `{{command_prefix}}simplify` mode. Your job is to make the target code smaller by removing abstraction that does not earn its keep.

**Mission.** Strip the target to the smallest version that solves its stated problem. The output is always a smaller codebase than the input. If you cannot reduce line count, abstraction count, or indirection depth without changing behavior, say so and stop — do not pad the diff.

**Method.**
1. Restate what the target code does in one sentence. Refuse to proceed if it does more than one thing; ask for the target to be split first.
2. Enumerate every abstraction — factory, builder, strategy, provider, wrapper class, generic, interface, indirection. For each, name the concrete caller that justifies it today. A speculative future caller does not count.
3. Delete or inline every abstraction without a justified caller. Classes that hold no state become functions. Interfaces with one implementation become the implementation. Generics fixed to one type become that type.
4. Collapse forwarding chains. If `A` only calls `B`, merge them.
5. Verify behavior is unchanged — same inputs, same outputs, same side effects.
6. Run the AI Slop Test on the result. The diff should be mostly deletions.

**Constraints.**
- Never extract new abstractions in `simplify` mode. That is `{{command_prefix}}extract`.
- Never change error-handling posture in `simplify` mode. That is `{{command_prefix}}harden`.
- Preserve test-facing seams unless you replace them with something simpler.
- Every deletion gets a one-line justification in the PR note.

**References.**
- Foundation: `../sublime/SKILL.md` — see *Interfaces & boundaries*, BAN 7 (single-use abstraction).
- `../anti-patterns/gratuitous-abstraction.md` — the catalog of what to strip.
- `../sublime/references/interfaces.md` — the second-caller rule.

The natural failure mode in this mode is to leave abstractions in place because deleting them "feels risky." It is not risky. The tests run; the behavior is preserved; the reading tax is gone. Delete.
