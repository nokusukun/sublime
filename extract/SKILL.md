---
name: extract
description: "Lift repeated patterns into a shared module — only if a second real caller exists today. Refuses speculative DRY; the second-caller rule is the contract. Use when similar logic has been copy-pasted across endpoints, components, or modules and a bug fix would need to happen in multiple places. Produces one named module, updates call sites, and leaves fewer lines than it started with."
argument-hint: "[target]"
license: MIT
user-invocable: true
---

## MANDATORY PREPARATION

Invoke `{{command_prefix}}sublime` — it contains the code-craft foundation, the Hard BANs, the AI Slop Test, and the Code Context Gathering Protocol. Every sublime verb leans on it.

Follow the Context Gathering Protocol before proceeding. If no `.sublime.md` exists and no Code Context has been loaded, you MUST run `{{command_prefix}}sublime teach` first and gather context interactively. Do NOT skip this step. Do NOT infer Code Context from the codebase alone — conventions in a codebase are usually load-bearing, and only the author can tell you the invariants.

---

# /extract

Lift repeated patterns into a shared module — only if a second caller already exists.

## When to use it

Reach for `extract` when the same logic has shown up in two or more places and the duplication is now a liability. A bug fix would have to happen in every copy; a new field would need to be added in parallel; the copies have already drifted by three-character differences. `extract` is the disciplined version of DRY — it refuses to dry up code that is not actually repeated enough to justify the abstraction. The rule is simple and non-negotiable: the second caller must exist today. Not planned, not imagined, not likely — present, written, running. If the second caller is hypothetical, run `{{command_prefix}}simplify` instead and come back when reality catches up.

## How it works

1. **Confirm two real callers.** Point at both. Paste the two snippets side by side. If the match is partial, name precisely which lines are shared and which differ.
2. **Name the shared concept.** What is the extracted thing, in domain terms? If the only honest name is `processData` or `doStuff`, the callers are not actually doing the same thing and you should stop.
3. **Design the call site first.** Write the line each caller will have after extraction. Does it read as a sentence? Is the parameter list short? If not, the shape is wrong — the shared concept is either under-specified or over-specified.
4. **Locate the home.** The extracted module goes with the domain concept, not in `utils.ts` or `common/`. If no existing module fits, that signals a missing concept — name it, create it.
5. **Extract, then inline the callers.** Move the shared logic into the new module. Update both call sites. Diff should show duplication removed, one new named concept added.
6. **Verify zero behavior change.** Both callers should produce the same outputs, raise the same errors, touch the same state as before.

## Try it

Input — two endpoints that each build a paginated response the same way, differing only in the query:

```ts
// handlers/listOrders.ts
const orders = await db.orders.where(...).limit(pageSize + 1).offset(cursor);
const hasMore = orders.length > pageSize;
return { items: orders.slice(0, pageSize), nextCursor: hasMore ? cursor + pageSize : null };

// handlers/listInvoices.ts
const invoices = await db.invoices.where(...).limit(pageSize + 1).offset(cursor);
const hasMore = invoices.length > pageSize;
return { items: invoices.slice(0, pageSize), nextCursor: hasMore ? cursor + pageSize : null };
```

Expected output — a `paginate` helper in `pagination.ts` that takes the query and returns the shape. Both handlers now call `paginate(query, { cursor, pageSize })`. The home is `pagination.ts`, not `utils.ts`.

## Pitfalls

- **Extracting on speculation.** The second caller is not written yet. This is the single most common failure mode. Do not extract; wait.
- **Extracting a partial match.** The two callers look similar but diverge on behavior the extracted version papers over with boolean flags or optional parameters. The extracted abstraction is now worse than the duplication was.
- **Dumping the extraction into `utils.ts`.** The helper has no real home because the concept has no name. Name the concept; create the module; resist the utility dumping ground.
- **Breaking the call site reading test.** If the post-extraction call site reads worse than the pre-extraction duplication, the abstraction is worse than the problem. Revert.

## SKILL.md

You are operating in `{{command_prefix}}extract` mode. Your job is to lift a repeated pattern into a shared module — only when a second caller already exists.

**Mission.** Reduce duplication that has actually accumulated. Never invent abstractions for speculative future callers. The output is a smaller codebase — one named concept added, N duplicated copies removed, net line count down.

**Method.**
1. Verify two or more concrete callers exist in the current codebase. Paste them. If only one exists, refuse and suggest `{{command_prefix}}simplify` instead.
2. Name the shared concept in domain terms. If the best name you can produce is generic (`processData`, `handleItem`, `doWork`), stop — the callers are not actually the same.
3. Design the call site first. Write the line each caller will read post-extraction. If the call site is unreadable, the shape is wrong.
4. Choose a home module by domain. Reject `utils.ts`, `helpers.ts`, `common/`, `misc/`, `shared/`. If no existing module fits, create one named for the concept.
5. Move the shared logic. Update every caller. Verify behavior is unchanged.
6. Confirm the diff: one new named thing, N duplicated copies gone, net reduction.

**Constraints.**
- The second caller must exist today. No speculative abstractions.
- Parameters: options object for three or more; no boolean flags that flip behavior.
- No partial-match extractions. If behavior diverges, the abstraction is wrong.
- No extracting into a utility dumping ground. Name the module by what it contains.
- Preserve behavior exactly. This is a structural change, not a semantic one.

**References.**
- Foundation: `../sublime/SKILL.md` — see *Interfaces & boundaries*, BAN 6 (utility dumping ground), BAN 7 (single-use abstraction).
- `../anti-patterns/gratuitous-abstraction.md` — the catalog of premature abstractions.
- `../anti-patterns/file-organization.md` — why `utils.ts` is the wrong home.
- `../sublime/references/interfaces.md` — the second-caller rule.

The natural failure mode in this mode is to extract because the code "looks similar" or because a second caller is "coming soon." Neither is a reason. Two real callers, today, doing the same domain operation, or you do not extract.
