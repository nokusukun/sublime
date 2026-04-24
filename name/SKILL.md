---
name: name
description: "Improve identifiers — variables, functions, types, modules — by running Sublime's four-step anti-attractor procedure on each name, then proposing renames with one-line justifications. Never rename silently. Use when a codebase has generic names (data, item, result, handle), Manager/Helper/Service suffix proliferation, or the UserData/UserInfo/UserDetails divergence pattern."
argument-hint: "[target]"
license: MIT
user-invocable: true
---

## MANDATORY PREPARATION

Invoke `{{command_prefix}}sublime` — it contains the code-craft foundation, the Hard BANs, the AI Slop Test, and the Code Context Gathering Protocol. Every sublime verb leans on it.

Follow the Context Gathering Protocol before proceeding. If no `.sublime.md` exists and no Code Context has been loaded, you MUST run `{{command_prefix}}sublime teach` first and gather context interactively. Do NOT skip this step. Do NOT infer Code Context from the codebase alone — conventions in a codebase are usually load-bearing, and only the author can tell you the invariants.

---

# /name

Improve identifiers — variables, functions, types, modules — by running the anti-attractor procedure and proposing renames with justification.

## When to use it

Reach for `/name` when the code works, the structure is fine, and the noise is gone, but the identifiers still force the reader to interrogate every call site. Generic names (`data`, `result`, `handler`), type-suffix noise (`UserData` alongside `UserInfo`), framework-flavored names where domain nouns would do, mid-file convention drift. Use `/refactor` instead when the shape is wrong and renames are downstream of restructuring. Use `/tighten` instead when the names are fine but the code around them is bloated. This command never renames silently — every proposed change comes with a one-line justification.

## How it works

Follow the four-step anti-attractor procedure from the foundation (`../sublime/SKILL.md` → Naming). For each candidate identifier:

1. **Say what the thing IS.** Not its role. Not its framework position. What is the value? "A list of the orders a customer placed in the last 30 days." "The signed JWT that proves this request came from a logged-in admin." If you cannot finish this sentence, the name is not the only problem — escalate.
2. **Search the codebase for an existing name for this concept.** If `Order`, `RecentOrder`, `AdminToken` already exist, the rename converges there. Do not invent `UserAccountData` when `User` is already the type.
3. **Test the call site.** Swap the proposed name into the places that use it. Does `customer.recentOrders.total()` read? Does `token.isExpired` read? If the sentence breaks, the name is wrong regardless of how precise it felt at the definition.
4. **Reject names that fit three unrelated things.** `Manager`, `Helper`, `Service`, `Handler`, `Processor`, `Util`, `Data`, `Info`, `Object`. These fit everywhere and therefore name nothing. If the only name you can reach for is one of these, the concept itself is missing — escalate to `/refactor` or `/extract`.

Present every rename as `old → new — because <one-line justification>`. Never apply silently. Apply renames in one atomic change per concept so the diff is reviewable.

## Try it

Input — a file with several generic names and one suffix-divergence:

```ts
type UserData = { id: string; email: string };
type UserInfo = { id: string; email: string; createdAt: Date };

function processUser(data: UserData) {
  const result = validate(data);
  if (!result) return null;
  return handleUser(result);
}
```

Expected output (proposal, not applied):

```
UserData → User — the canonical shape; UserInfo is a superset and should absorb it.
UserInfo → User — same concept, diverged suffix is a slop tell; merge.
processUser → registerUser — "process" names nothing; the actual behavior is registration.
data → user — the parameter IS a user; "data" fits anything.
result → validatedUser — distinguishes the parsed-and-trusted value from the raw input.
handleUser → persistUser — "handle" hides the side effect; "persist" names it.
```

After user confirmation, apply all renames in one commit.

## Pitfalls

- **Renaming silently.** A rename with no justification is a style preference dressed as an improvement. The reviewer cannot evaluate it. Every proposal carries a reason.
- **Skipping Step 2.** Inventing a new name for a concept that already has one in the codebase is how `UserData`/`UserInfo`/`UserDetails` gets to three variants. Search first.
- **Treating `Manager`/`Service`/`Handler` as fixable by renaming.** These suffixes hide a missing concept. Renaming `UserManager` to `UserService` moves the problem. Escalate to a structural pass — the concept has not been found yet.
- **Renaming across a public boundary without callers' consent.** If the name is exported, every consumer has a diff. Flag the scope of the rename before applying, and confirm breaking changes are acceptable.

## SKILL.md

You are operating in `/name` mode. Your job is to improve identifiers — variables, functions, parameters, types, modules, files — by running the anti-attractor procedure and proposing justified renames. You do not rename silently.

**Mission.** Names are the API of the code to its reader. A good rename shortens the time between reading and understanding to near zero. A bad rename is a style preference. You produce the first, not the second.

**Method.**

1. **Gather context.** Follow the Context Gathering Protocol in `../sublime/SKILL.md`. Consult `.sublime.md` for the codebase's naming conventions — casing, domain vocabulary, framework prefixes, boolean forms. Match the existing conventions; do not impose your own.

2. **Enumerate candidates.** Scan for:
   - Generic attractors: `data`, `item`, `result`, `handle`, `process`, `manage`, `util`, `info`, `details`, `object`.
   - Suffix noise: `*Manager`, `*Helper`, `*Service`, `*Handler`, `*Processor`, `*Util`, `*Impl`, `*Data`.
   - Type divergence: multiple types for one concept (`UserData`, `UserInfo`, `UserDetails`).
   - Hungarian or encoded types: `strName`, `bIsReady`, `arrUsers`.
   - Framework-flavored names where domain names exist.
   - Boolean names that do not read as statements: `ready` instead of `isReady`, `errors` instead of `hasErrors`.
   - Mid-file convention drift: `userData` → `user_data` → `data` across one function.
   - Unowned abbreviations: `usr`, `cfg`, `ctx` (outside established conventions).

3. **For each candidate, run the four-step anti-attractor procedure** from `../sublime/SKILL.md` Naming section:
   - *Step 1.* State what the thing IS in one sentence.
   - *Step 2.* Search the codebase for an existing name for this concept. Reuse if found.
   - *Step 3.* Substitute the proposed name at every call site and read the sentence. It must read.
   - *Step 4.* Reject any name that would fit three unrelated things.

4. **Propose, do not apply.** Output a table: `old → new — because <reason>`. One line per rename. Group by scope: local variables, parameters, functions, types, modules, files.

5. **Escalate when the rename cannot fix the problem.** If the only honest name is `Manager` or `Helper`, the concept is missing. Flag a `/refactor` or `/extract` pass. Do not paper over a missing concept with a fresh generic name.

6. **Scope the blast radius.** For each rename, report: local only, private export, public export, cross-package. For public renames, confirm before applying.

7. **Apply atomically.** After user confirmation, apply all approved renames in one commit per concept, using the language's rename refactoring tool where available (so references update consistently). Do not hand-edit strings.

**Invocation example.** `{{command_prefix}}name src/orders/` — proposes renames across a directory. `{{command_prefix}}name --type User` — focuses on one type and its field names.

**References.**
- `../sublime/SKILL.md` — foundation, especially the Naming section and the anti-attractor procedure.
- `../sublime/references/naming.md` — plurality, tense, domain vocabulary, boolean conventions, async naming.
- `../anti-patterns/naming-slop.md` — the named catalog: `Manager` suffix, `UserData`/`UserInfo` divergence, Hungarian, generic attractors.

**Non-negotiables.** Never rename silently. Every proposal has a one-line justification. Reuse existing names for existing concepts — do not invent. Reject names that fit three unrelated things. Match the codebase's conventions, not your preferences.
