---
name: tighten
description: "Delete-only pass on working code. Removes ceremony, redundant guards, empty catches, banner comments, JSDoc that mirrors types, and other noise while leaving behavior identical. The diff must end strictly smaller than it started. Use when code works but carries LLM-generated ceremony that raises reading tax without raising signal."
argument-hint: "[target]"
license: MIT
user-invocable: true
---

## MANDATORY PREPARATION

Invoke `{{command_prefix}}sublime` — it contains the code-craft foundation, the Hard BANs, the AI Slop Test, and the Code Context Gathering Protocol. Every sublime verb leans on it.

Follow the Context Gathering Protocol before proceeding. If no `.sublime.md` exists and no Code Context has been loaded, you MUST run `{{command_prefix}}sublime teach` first and gather context interactively. Do NOT skip this step. Do NOT infer Code Context from the codebase alone — conventions in a codebase are usually load-bearing, and only the author can tell you the invariants.

---

# /tighten

Compress working code by deleting ceremony, noise, and redundant guards while leaving behavior identical.

## When to use it

Reach for `/tighten` when the code is correctly structured and correctly named but bloated: empty `catch` blocks, redundant null guards on non-nullable values, JSDoc that restates the type signature, banner comments, single-use wrappers, `if (x) return true; else return false`. The "make this 30% shorter without changing what it does" pass. Use `/refactor` instead when the structure itself is wrong. Use `/simplify` instead when the abstraction is wrong and the right answer is removing a layer entirely, not trimming it.

## How it works

1. **Establish the behavior baseline.** Run the tests. Every deletion must leave the green bar green. If a deletion flips a test red, the code was not ceremony — put it back.
2. **Scan for the named noise patterns.** Empty or pass-through `catch`. Optional chaining on typed-non-nullable values. `|| 0` / `?? []` fallbacks that mask missing data. JSDoc mirroring TS types. Banner comments. Line-narration comments. Single-use wrappers around a standard-library call. Ceremonial classes with no state. Re-exports that add nothing.
3. **Delete, do not rewrite.** Every change should be a pure removal or a replacement strictly shorter than what it replaced. If you caught yourself adding logic, you left `/tighten` and entered `/refactor`.
4. **Preserve structure and names.** Function boundaries stay where they are. Identifiers stay the same. The shape of the code is untouched; only the filler between the shape goes.
5. **Account for every deletion.** For each removed block, you should be able to say *why behavior is preserved*: "the catch only logged and re-threw," "the guard checks a value the type system already proves non-null," "the comment restated the next line." If you cannot justify, do not delete.
6. **Re-run the tests.** Same assertions, same results. A tighten that changed any assertion is a rewrite.

## Try it

Input — 24 lines, most of them noise:

```ts
/**
 * Fetches the user by id.
 * @param id The user id.
 * @returns The user, or null.
 */
export async function getUser(id: UserId): Promise<User | null> {
  try {
    const user = await db.users.findById(id);
    if (user) {
      return user;
    } else {
      return null;
    }
  } catch (e) {
    console.log(e);
    throw e;
  }
}
```

Expected output — 3 lines, same behavior:

```ts
export async function getUser(id: UserId): Promise<User | null> {
  return db.users.findById(id);
}
```

The JSDoc duplicated the types. The try/catch only logged and re-threw. The `if/else` collapsed to its expression. The wrapping `await` was ceremony — the function already returns a promise.

## Pitfalls

- **Tightening into a rewrite.** The moment you add a line, rename a variable, or move a function, you are no longer tightening. Stop and classify the change correctly.
- **Deleting guards that actually guard.** A null check on a value typed `T | null` is not ceremony; it is the type system working. Only delete guards on values whose type already proves the guard redundant.
- **Removing `try/catch` that catches a specific recoverable error.** The BAN is on *empty or pass-through* catches. A catch that handles `NetworkError` by returning a cached value is doing real work — leave it.
- **Running `/tighten` before `/refactor`.** You will compress noise inside a structure that is about to be torn apart. Fix the shape first, then squeeze the filler out.

## SKILL.md

You are operating in `/tighten` mode. Your job is to remove code — noise, ceremony, redundant guards — while leaving behavior bit-for-bit identical.

**Mission.** The code works and the structure is correct. You are stripping filler. Every diff you produce should be smaller after than before. If a change would grow the diff, you are in the wrong command.

**Method.**

1. **Gather context.** Confirm `.sublime.md` or loaded instructions are present per the Context Gathering Protocol in `../sublime/SKILL.md`. Confirm tests exist and pass. Without tests, tightening is guessing.

2. **Scan for the named slop patterns,** from `../sublime/SKILL.md` and `../anti-patterns/`:
   - *Empty or pass-through catch* (BAN 2): `catch (e) {}`, `catch (e) { console.log(e) }`, `catch (e) { throw e }`. Remove the try/catch entirely.
   - *Fallback-masks-bug* (BAN 9): `data.count || 0`, `items ?? []` where missing data is a real case. Replace with explicit handling or boundary validation.
   - *Line-narration comment* (BAN 8): any comment whose content is the next line's code. Delete.
   - *Banner comments*: `//// SECTION ////`. Delete.
   - *JSDoc mirroring types*: `@param {string} name The name` on a typed parameter. Delete the docblock unless it documents non-obvious behavior.
   - *Single-use abstraction* (BAN 7): a class wrapping a function with no state, a factory for one implementation, a re-export that adds nothing. Inline.
   - *Optional-chaining cascades on non-nullable types*: `user?.name` where `user: User`. Remove the `?`.
   - *Ceremonial if/else returning booleans*: `if (x) return true; else return false`. Return `x` (or its boolean form).
   - *Emoji in code, comments, or logs*: delete.

3. **Delete, replace-shorter, or leave alone.** These are the only three moves. No additions. No renames. No moves.

4. **Justify every deletion.** For each removed block, state in one clause why behavior is preserved. If you cannot justify, restore.

5. **Verify.** All tests pass unchanged. Linter and type-checker pass. If any assertion had to change, you exited `/tighten` — revert.

6. **Flag what you will not delete.** If you see structural problems (bad shape) or naming problems (bad identifiers), call them out as candidate `/refactor` or `/name` passes. Do not fix them here.

**Invocation example.** `{{command_prefix}}tighten src/auth/session.ts` — tightens one file. `{{command_prefix}}tighten --diff` — tightens only the staged changes.

**References.**
- `../sublime/SKILL.md` — foundation, especially the Hard BANs section and *Comments & docs*.
- `../sublime/references/errors.md` — distinguishing real error handling from ceremonial `try/catch`.
- `../sublime/references/comments.md` — what a comment earns its place by, and what gets deleted.
- `../anti-patterns/over-defensive.md` — paranoid try/catch, redundant guards, optional-chaining cascades.
- `../anti-patterns/comment-slop.md` — line narration, banner comments, JSDoc mirroring types.
- `../anti-patterns/boilerplate-and-ceremony.md` — wrappers, re-exports, ceremonial classes.

**Non-negotiables.** Do not rename. Do not restructure. Do not add. Every commit must be strictly smaller than the one before it. Every test must still pass without modification.
