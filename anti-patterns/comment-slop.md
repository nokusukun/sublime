# Comment slop

Comments should carry information the code cannot. Models reflexively produce the opposite: narration that mirrors the next line, JSDoc that re-describes the type, tutorial voice, emoji, banner art, and unowned TODOs. The common root cause is training on heavily-commented tutorial corpora, where the comment is the teaching surface. In production code, that same reflex becomes reading tax — doubling the work to understand each line and drifting out of sync the moment the code changes. Watch for any comment whose content is fully present in the adjacent code.

### Line-narration

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A comment whose content is fully reproduced by the next line of code.

**Forbidden example.**
```ts
// increment i by 1
i += 1;
// loop through users
for (const user of users) {
  // get the name
  const name = user.name;
}
```

**Why it hurts.** Dr. Derek Austin ranks this as the #1 revived anti-pattern across LLM-generated code. The comment adds zero information, doubles the reading work, and silently drifts as the code is edited. It also signals "AI wrote this" on first glance, which erodes reviewer trust in everything else on the page.

**Rewrite.**
```ts
i += 1;
for (const user of users) {
  const name = user.name;
}
```

**See in `/sublime`:** [SKILL.md#comments--docs](../sublime/SKILL.md#comments--docs), [BAN 8](../sublime/SKILL.md#hard-bans), [references/comments.md](../sublime/references/comments.md).

### JSDoc-that-mirrors-types

**Tags:** `AI-slop` · `Lint` · `Lang:ts`

**Pattern.** A JSDoc block whose `@param` and `@returns` tags restate information the type signature already carries.

**Forbidden example.**
```ts
/**
 * @param {string} name - The name.
 * @param {number} age - The age.
 * @returns {User} The user.
 */
function createUser(name: string, age: number): User {
  return { name, age };
}
```

**Why it hurts.** The JSDoc adds no information beyond the TypeScript signature. It doubles the maintenance cost — rename the parameter and the doc silently lies. It crowds out the comments that would actually help a reader: intent, invariants, and rejected alternatives.

**Rewrite.**
```ts
function createUser(name: string, age: number): User {
  return { name, age };
}
```

**See in `/sublime`:** [SKILL.md#comments--docs](../sublime/SKILL.md#comments--docs), [references/comments.md](../sublime/references/comments.md).

### README-on-trivial-helper

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A block comment with `@example`, `@since`, `@author`, or a multi-paragraph description on a one-line internal helper.

**Forbidden example.**
```ts
/**
 * Adds two numbers together and returns the sum.
 *
 * @example
 *   const result = add(2, 3); // 5
 * @since 1.0.0
 * @author Engineering Team
 */
function add(a: number, b: number): number {
  return a + b;
}
```

**Why it hurts.** The ceremony exceeds the code by an order of magnitude. Library-bar documentation on a glue-code helper is a posture mismatch: you are paying the library tax on code that is not a library. Future edits now have to maintain the doc too.

**Rewrite.**
```ts
function add(a: number, b: number): number {
  return a + b;
}
```

**See in `/sublime`:** [SKILL.md#comments--docs](../sublime/SKILL.md#comments--docs), [references/comments.md](../sublime/references/comments.md).

### Meta-narration ("Let's... Now we...")

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Tutorial-voice comments that narrate the author's procedure: "Let's...", "First we will...", "Now we...", "Finally, we..."

**Forbidden example.**
```python
# First, we will initialize the array.
results = []
# Now let's loop over each item.
for item in items:
    # Here we apply the transformation.
    results.append(transform(item))
# Finally, we return the results.
return results
```

**Why it hurts.** This is the signature voice of tutorial-trained models. It treats the reader as a student watching a lesson, not an engineer reading production code. The narration adds no information and locks in a voice that is wrong for a codebase.

**Rewrite.**
```python
return [transform(item) for item in items]
```

**See in `/sublime`:** [SKILL.md#comments--docs](../sublime/SKILL.md#comments--docs), [references/comments.md](../sublime/references/comments.md).

### Emoji comments

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Emoji in code comments — rockets on `startServer`, checkmarks on success paths, party poppers on initialization, warning signs on edge cases.

**Forbidden example.**
```ts
// Start the server
function startServer() {
  // Bind to port
  listen(3000);
  // Ready to accept traffic
  console.log("ready");
}
```

**Why it hurts.** Strongly ChatGPT-associated; unmistakable as a generation tell. Emoji in code signals throwaway work, not craft. They also break grep, fight with terminal fonts, and invite escalating emoji noise across the codebase once tolerated.

**Rewrite.**
```ts
function startServer() {
  listen(3000);
  console.log("ready");
}
```

**See in `/sublime`:** [SKILL.md#comments--docs](../sublime/SKILL.md#comments--docs), [references/comments.md](../sublime/references/comments.md).

### Section divider comments

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Banner comments carving a single file into labeled sections: `// ===== HELPERS =====`, `// ---- TYPES ----`, `// ### STATE ###`.

**Forbidden example.**
```ts
// ===== TYPES =====
type User = { id: string };

// ===== HELPERS =====
function toId(x: User) { return x.id; }

// ===== EXPORTS =====
export { toId };
```

**Why it hurts.** A file that needs ASCII-art section headers is a file that wants to be several files. The banners paper over a missing module boundary and train readers to scroll instead of navigate. Structure the code; do not decorate it.

**Rewrite.**
```ts
type User = { id: string };

function toId(x: User) { return x.id; }

export { toId };
```

**See in `/sublime`:** [SKILL.md#comments--docs](../sublime/SKILL.md#comments--docs), [references/comments.md](../sublime/references/comments.md).

### Empty TODO

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A `TODO` comment with no owner, no date, no ticket, and no description of the case it means to handle.

**Forbidden example.**
```ts
function parseDate(input: string): Date {
  // TODO: handle this case
  return new Date(input);
}
```

**Why it hurts.** Muhammad Sohail: "The model identified a gap but didn't fill it." The TODO is decoration — it signals awareness of a missing case without recording which case, why it matters, or who owns it. It accumulates silently and trains reviewers to ignore TODOs entirely.

**Rewrite.**
```ts
function parseDate(input: string): Date {
  // TODO(von, 2026-04-17, #482): reject strings that Date coerces to Invalid Date
  // rather than propagating NaN timestamps downstream.
  return new Date(input);
}
```

**See in `/sublime`:** [SKILL.md#comments--docs](../sublime/SKILL.md#comments--docs), [references/comments.md](../sublime/references/comments.md).

### Commented-out "just in case" code

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** The previous implementation left as a commented block below the new one, "in case we need it later."

**Forbidden example.**
```ts
function total(items: Item[]): number {
  return items.reduce((sum, i) => sum + i.price, 0);
  // Old implementation:
  // let total = 0;
  // for (let i = 0; i < items.length; i++) {
  //   total = total + items[i].price;
  // }
  // return total;
}
```

**Why it hurts.** Version control already remembers. Commented-out code rots silently, confuses readers about what is live, and invites resurrection of code that no longer fits the surrounding types. Addy Osmani names this as a core symptom of AI-driven dead-code accumulation.

**Rewrite.**
```ts
function total(items: Item[]): number {
  return items.reduce((sum, i) => sum + i.price, 0);
}
```

**See in `/sublime`:** [SKILL.md#comments--docs](../sublime/SKILL.md#comments--docs), [references/comments.md](../sublime/references/comments.md).
