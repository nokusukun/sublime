---
name: polish
description: "Zero-behavior-change final pass. Harmonizes naming, comments, imports, and presentation with the codebase's existing conventions; removes banner comments, emoji, tutorial-voice narration, and JSDoc-that-mirrors-types. Use as the last step before shipping a change — after audit, harden, and any refactors. Never changes behavior; never rewrites; never redesigns."
argument-hint: "[target]"
license: MIT
user-invocable: true
---

## MANDATORY PREPARATION

Invoke `{{command_prefix}}sublime` — it contains the code-craft foundation, the Hard BANs, the AI Slop Test, and the Code Context Gathering Protocol. Every sublime verb leans on it.

Follow the Context Gathering Protocol before proceeding. If no `.sublime.md` exists and no Code Context has been loaded, you MUST run `{{command_prefix}}sublime teach` first and gather context interactively. Do NOT skip this step. Do NOT infer Code Context from the codebase alone — conventions in a codebase are usually load-bearing, and only the author can tell you the invariants.

---

# /polish

Final-pass review for style, consistency, and presentation.

## When to use it

Reach for `polish` at the end of a change, after the work is correct, after `{{command_prefix}}audit` or `{{command_prefix}}critique` have surfaced the structural issues, and after `{{command_prefix}}harden` has closed the failure gaps. `polish` is the meticulous last mile — the pass that makes the diff look like it was written by someone who cares. It touches naming consistency across files, import order, file organization, banner comments, tutorial-voice narration, emoji, docstring conventions, stray `console.log` calls, commented-out code, and the small presentation details that separate "works" from "ships." `polish` does not change behavior. If your diff alters what the code does, you ran the wrong command.

## How it works

1. **Naming consistency.** Pick the canonical name for every concept that appears in the diff. `user` vs `usr` vs `u` — one wins. `fetchUser` vs `getUser` vs `loadUser` — one wins. Apply it everywhere in the change, and fix mid-function casing drift (`userData` → `user_data` → `data`).
2. **Comment audit.** Delete every line-narration comment (the code already says what the line does). Delete banner comments (`//// SECTION ////`). Delete commented-out code. Remove tutorial voice ("Let's...", "Now we..."). Remove emoji. Keep the comments that explain *why*.
3. **Import and file-top hygiene.** Sort imports by the codebase's convention — match the existing files, do not invent a new order. Remove unused imports. Collapse duplicates. Remove stray `console.log`, `debugger`, `TODO` without owner.
4. **Signature and shape consistency.** Match the rest of the module — parameter order, options-object shape, return-type conventions, export style (named vs default), file-level organization (types, consts, functions, export).
5. **Presentation details.** Trailing whitespace, final newlines, consistent quote style, consistent semicolon policy — whatever the codebase has already chosen. Match it.
6. **Run the AI Slop Test.** Read the diff once more. Does any line read like an AI wrote it? Gradient-text equivalents for code — the emoji in a log message, the banner comment, the over-earnest docstring on a two-line helper — get cut.

## Try it

Input — a two-file change that works correctly but reads uneven: mixed naming, a rocket emoji in a startup log, a banner comment, line-narration comments, an unused import, and tutorial-voice JSDoc:

```ts
import { readFile, writeFile } from "fs/promises";
import { z } from "zod";  // unused

//// CONFIG LOADING ////
/**
 * Let's load the config file. First we read the file, then we parse it,
 * then we return the result.
 * @param path - The path
 */
export async function loadCfg(path: string) {
  // read the file
  const contents = await readFile(path, "utf8");
  // parse it
  const cfg = JSON.parse(contents);
  console.log("Loaded config");
  return cfg;
}
```

Expected output — unused import gone, banner gone, narration gone, tutorial voice gone, name harmonized with the rest of the codebase (`loadConfig` not `loadCfg`), stray log removed:

```ts
import { readFile } from "fs/promises";

export async function loadConfig(path: string): Promise<Config> {
  const contents = await readFile(path, "utf8");
  return JSON.parse(contents);
}
```

Zero behavior change. Every line reads.

## Pitfalls

- **Polishing work that is not done.** If the change still has real bugs, gaps in error handling, or structural problems, polish is premature. Run `{{command_prefix}}audit`, `{{command_prefix}}critique`, and `{{command_prefix}}harden` first.
- **Treating polish as redesign.** Renaming `userId` to `customerId` across a module is a design decision, not polish. If the rename changes meaning, it belongs in a separate change.
- **Introducing new conventions.** Polish matches the codebase's existing conventions. If the rest of the repo uses single quotes, the polished file uses single quotes — even if double quotes are "better." Convention wins.
- **Changing behavior in passing.** Removing a `console.log` that a log aggregator depends on, deleting a comment that documents an invariant, reformatting a query that changes its plan. Polish is behavior-preserving. If you are unsure, the comment stays.

## SKILL.md

You are operating in `{{command_prefix}}polish` mode. Your job is the final-pass review — style, consistency, and presentation, with zero behavior change.

**Mission.** Make the diff read like it was written by one careful author who knows the codebase. Remove the visible AI tells — emoji, banner comments, line narration, tutorial voice, drift in naming — and harmonize with the conventions already present in the repo.

**Method.**
1. Naming consistency: one canonical name per concept, applied across the whole diff; no mid-function casing drift; no generic placeholders (`data`, `item`, `result`) left behind.
2. Comments: delete every comment that restates the code; delete banner comments; delete commented-out code; remove tutorial voice and emoji; preserve comments that explain *why*.
3. Imports and file-top: match the codebase's sort order; remove unused imports; collapse duplicates; remove stray `console.log`, `debugger`, unowned `TODO`.
4. Signatures and shape: match the module's existing parameter conventions, return-type style, and export style.
5. Presentation: whitespace, final newlines, quotes, semicolons — match the codebase.
6. Run the AI Slop Test on the diff. Cut anything that reads like an AI wrote it.

**Constraints.**
- Zero behavior change. If you are tempted to alter semantics, route it to a different command.
- Match existing conventions. Do not introduce new ones.
- Renames that change meaning are out of scope — handle them separately.
- Run *after* `{{command_prefix}}audit`, `{{command_prefix}}critique`, and `{{command_prefix}}harden`, not before.

**References.**
- Foundation: `../sublime/SKILL.md` — see *Comments & docs*, *Naming*, the AI Slop Test.
- `../anti-patterns/comment-slop.md` — what to delete.
- `../anti-patterns/stylistic-tells.md` — the visible AI tells.
- `../anti-patterns/naming-slop.md` — the drift patterns.
- `../sublime/references/comments.md` — why comments earn their place.

The natural failure mode in this mode is to over-polish — rewording prose, re-renaming types, rearranging files in ways that force reviewers to re-read everything. Polish is the smallest diff that removes the tells. Restraint.
