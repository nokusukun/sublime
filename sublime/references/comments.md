# Comments

A comment earns its place only when it carries information the code cannot.

The code is the *what*. A good comment is the *why* behind a non-obvious choice, the *invariant* a reader would otherwise violate, the *alternative rejected* that a future maintainer would otherwise try again. Everything else is noise. Most comments a model produces on its first pass are noise — they restate the next line, narrate the obvious, cite parameter types the type system already enforces, and sign the file with emoji. The result is indistinguishable from tutorial copy pasted into source.

## The two-column test

Imagine each line of code and each comment on opposite sides of a sheet. Ask for each comment: does this column tell the reader anything the other column does not? If no, cross the comment out. If yes, keep it and make sure what it says is worth saying. Most line-level AI comments fail this test on sight:

```
// increment the counter
counter += 1

// loop over each user and send an email
for user in users:
    send_email(user)
```

Both comments are the code in English. Deleting them makes the code easier to read, not harder. The rule is simple: if the comment paraphrases the next line, one of them is redundant and it is almost never the code.

## What comments are for

Comments are worth writing when they say one of these things:

- **Why this, and not the obvious alternative.** "Tried X; broke Y under load; this is why we do Z."
- **An invariant the code relies on but does not enforce.** "Callers must hold `lock` for the duration of this call." "Input is assumed UTF-8; validated at the HTTP boundary."
- **A non-obvious external reference.** A link to an RFC section, a bug ticket, a vendor quirk, a hardware erratum.
- **A warning for the next reader.** "Do not reorder these two lines; the second depends on side effects of the first."
- **A decision recorded at the point of impact.** Short inline rationale where a decision record would be overkill.

These are the only comment genres with durable value. Everything else either restates the code, decays as the code changes, or adds tutorial voice to a codebase that is not a tutorial.

## Comment decay

Every comment is a second source of truth. When the code changes, the comment must change with it — and usually does not. A stale comment is worse than no comment, because a future reader will trust it over the code and make a wrong decision.

The mitigations:

- Place a comment where the thing it describes happens, not at the top of the function. A comment next to the line it explains has a fighting chance of being updated when that line changes.
- Make the comment specific enough that it cannot silently lie. "This handles the 401 retry case" can go stale quietly. "Retry once on 401 because the auth token may have expired during the request" cannot — if the code stops retrying, the comment is visibly wrong.
- Delete comments when you change the code they describe. The cost of a stale comment is real; do not leave one because you were "only touching the code."

## Decision records for decisions that outgrow a line

Some decisions are too big for an inline comment and too scattered to live next to a single line. That is what a decision record is for — a short document, committed to the repo, that captures one decision, its alternatives, and its consequences.

A workable ADR format, for reference:

| Field | What goes in it |
|---|---|
| Title | `ADR-042: Switch payment provider from Stripe to Adyen` |
| Status | `Proposed` / `Accepted` / `Deprecated` / `Superseded by ADR-N` |
| Context | The problem forcing the decision. Two paragraphs, not twenty. |
| Decision | The choice, in imperative voice. One paragraph. |
| Consequences | What becomes easier, what becomes harder, what must now be true. |
| Alternatives | What was considered and rejected, with one-sentence reasons. |

ADRs are not comments, but they serve the same purpose at a different scale: they exist so that a future maintainer does not have to re-derive why the code looks the way it does. Link to the ADR from the affected code with a single comment: `// see ADR-042 for why this is two-phase.` That is one sentence of inline comment paying for fifty lines of context a reader can reach when they need it.

## TODOs that are not litter

An unowned `TODO` is a Post-it on someone else's desk. It will not be read, will not be done, and will survive every rewrite. A useful TODO carries enough information for someone who did not write it to act on it.

| Bad | Why it fails |
|---|---|
| `// TODO: fix this` | No owner, no condition, no definition of "fix". |
| `// TODO: handle errors` | Will never be satisfied because "handle errors" is not a task. |
| `// TODO(later): refactor` | "Later" is the date that never comes. |

| Good | Why it works |
|---|---|
| `// TODO(von, 2026-06-01): remove this workaround once issue #1842 ships.` | Named owner, dated, ticketed, explicit removal condition. |
| `// TODO: replace with crypto.randomUUID() when min Node moves to 20.` | Concrete trigger, concrete replacement, no owner needed because the trigger is deterministic. |

If you cannot write the owner, the trigger, or the ticket, you do not have a TODO. You have a confession that you chose not to do the work. Write `FIXME` for a bug you are knowingly leaving; write `HACK` for a workaround you want future-you to revisit; but give every marker an attachment point to reality — a name, a date, a ticket, or a condition.

## Function-level documentation

Docstrings on public functions exist to describe contract: what the function promises about its inputs, outputs, and effects that the types alone do not convey. In a typed language, the signature already tells the reader the shapes. A docstring that retypes the signature is pure reading tax.

```
// bad — the types already say this
/**
 * @param {string} name - The name.
 * @param {number} age - The age.
 * @returns {User} The user.
 */
function createUser(name: string, age: number): User { ... }

// good — the docstring carries what types cannot
/**
 * Creates a user with today's date as createdAt and a generated v7 UUID.
 * Throws DuplicateEmailError if the email is already registered.
 * Does not send the welcome email; the caller is responsible.
 */
function createUser(params: CreateUserParams): User { ... }
```

The good version tells the caller: what side effects happen, what errors can throw, what responsibilities remain with the caller. The bad version tells the caller what the signature already told them and loses.

Write docstrings as complete sentences in the voice of a contract, not a tutorial. No "Let's…", no "Now we…", no markdown bullets, no emoji. The docstring will show up in editor tooltips and API documentation; tutorial voice there is permanently embarrassing.

## Prohibited shapes

A few comment shapes never earn their place. They are banned regardless of language or posture.

**No banner comments.** `// ===== SECTION: HELPERS =====` is a decorator for a file that should not need one. If a file is long enough to feel like it needs section dividers, split the file. If splitting isn't warranted, use an empty line — the reader's eye will find the break.

**No emoji in comments or log messages.** `// 🚀 Initialize the server` is instantly recognizable as generated. Emoji in code and logs leak into production dashboards, grep output, and error reporters where they render as mojibake or take up space reserved for real information. Ship plain text.

**No markdown-in-docstrings.** Bold, bullets, headers, and fenced code inside a docstring render as noise in most tooling and as literal asterisks in the rest. The idiom in Python is plain prose. The idiom in TypeScript is plain sentences and `@tags` where the tooling actually uses them. The idiom in Go is a leading sentence that starts with the identifier's name. Match the idiom; do not paste README syntax into a docstring.

**No commented-out code.** If the old implementation is worth keeping, version control has it. If it isn't, delete it. A block of commented-out code says to the next reader "I was not sure I could commit to this change," and the next reader will not be sure either. Commit to the change or revert it.

## Common AI failure modes

**Line-narration (4.1).** `i += 1  // increment i` is the canonical AI tell. Born from training data full of tutorials where every operation had to be explained to a beginner. A model will produce this reflexively whenever it generates more than a handful of lines. Strip them. A comment that says what the next line says is a comment that costs reading time and gives nothing back.

**JSDoc-that-mirrors-types (4.2).** `@param {string} name - The name.` adds zero information beyond the TypeScript signature and decays silently when the signature changes. The model reaches for it because training-data JSDoc was written before strict typing was common. In a typed codebase it is pure overhead. If the type is the whole story, write no docstring; if there is more to say, say only the more.

**README-on-trivial-helper (4.3).** A five-line block comment with `@example`, `@since`, `@author` on a function that adds two numbers. The ceremony belongs in a published library entry point, not a private helper. Keep docstring intensity proportional to public surface and user-facing impact. An internal helper needs a one-sentence docstring if any.

**Meta-narration "Let's... Now we..." (4.4).** `// First, we will initialize the array. Now let's loop over it.` Tutorial voice. It does not belong in source because source is not a lesson — it is the thing itself. Rewrite in imperative voice or delete.

**Emoji comments (4.5).** Rocket on `startServer`, checkmark on `success`, party on `initialized`. Instantly recognizable as generated; never survive a serious code review; render badly in tooling. Delete on sight.

**Section divider comments (4.6).** `// ===== HELPERS =====` inside a forty-line file. The divider is trying to solve a file-structure problem with ASCII art. Solve it with file structure instead. If the divisions inside a file are load-bearing, they are probably separate files.

**Empty TODO (4.7).** `// TODO: handle this case` with no indication of what case, who owns it, or when it comes due. The model noticed a gap and did not fill it; the comment exists to launder the gap into the next reader's problem. Either do the work, write a real TODO with owner and trigger, or delete the marker and accept the debt in the open.

**Commented-out "just in case" code (4.8).** Old implementation left in comments below the new one so "we have it if we need it." You do not have it — you have a lie that diverges from the live code as both evolve. Version control remembers for you; delete.

### Avoid

- Line-narration comments that restate the next line.
- JSDoc or docstrings whose entire content is a paraphrase of the signature types.
- README-density block comments on trivial internal helpers.
- Tutorial voice: "Let's…", "Now we…", "First we'll…".
- Emoji in comments, log messages, or identifiers.
- ASCII-art section dividers inside a single file.
- `TODO` with no owner, no trigger, and no ticket.
- Commented-out old implementations kept "just in case."
- Markdown formatting — bullets, bold, headers — inside docstrings.
- Comments at the top of a function that drift silently from the behaviour below them.
