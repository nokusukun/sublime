# Over-defensive programming

Over-defensive code is the most-cited LLM tell in every community survey. The root cause is a model trained to look thorough: it wraps deterministic code in `try/catch`, adds optional chaining to non-nullable values, and defaults away the conditions it should surface. The result is code that *looks* handled and *hides* bugs. Watch for defensive ceremony on pure in-memory operations, for fallbacks that mask missing data, and for exception handlers that only exist to log and swallow.

### Paranoid try/catch everywhere

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Wrapping synchronous, deterministic, in-memory code in `try/catch` blocks that cannot meaningfully fail.

**Forbidden example.**
```ts
try {
  const total = price + tax;
  return total;
} catch (e) {
  console.log(e);
  return 0;
}
```

**Why it hurts.** Ronacher: *"agents will try to catch everything they can, log it, and do a pretty poor recovery."* The `catch` branch either never fires or hides the one thing you needed to see. Austin ranks this the #3 most common AI anti-pattern.

**Rewrite.**
```ts
return price + tax;
```

**See in `/sublime`:** [SKILL.md#errors--failure-modes](../sublime/SKILL.md#errors--failure-modes), [references/errors.md](../sublime/references/errors.md).

---

### Optional-chaining paranoia

**Tags:** `AI-slop` · `Type-check` · `Lang:TS`

**Pattern.** Stacking `?.` operators on values whose types are already non-nullable.

**Forbidden example.**
```ts
function greet(user: User): string {
  return user?.profile?.name?.trim?.()?.toLowerCase?.() ?? "";
}
```

**Why it hurts.** Every `?.` tells a reader "this could be null here." If the type says it cannot, the chain lies about the contract and trains readers to ignore the operator. A Cursor/Copilot signature in TypeScript.

**Rewrite.**
```ts
function greet(user: User): string {
  return user.profile.name.trim().toLowerCase();
}
```

**See in `/sublime`:** [SKILL.md#errors--failure-modes](../sublime/SKILL.md#errors--failure-modes), [references/data-modeling.md](../sublime/references/data-modeling.md).

---

### Fallback-masks-bug

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Using `||` or `??` to substitute a default where the missing value is itself the bug to investigate.

**Forbidden example.**
```ts
const count = data.count || 0;
const items = response.items ?? [];
render(count, items);
```

**Why it hurts.** A silently-substituted default turns a loud API bug into a quiet data bug that surfaces weeks later. `data.count` may be the string `"0"`, an unawaited promise, or a contract break the caller must know about.

**Rewrite.**
```ts
if (typeof data.count !== "number") throw new Error("count missing or malformed");
const { count, items } = data;
render(count, items);
```

**See in `/sublime`:** [SKILL.md#hard-bans](../sublime/SKILL.md#hard-bans), [references/data-modeling.md](../sublime/references/data-modeling.md).

---

### Re-validation at every layer / phantom validation

**Tags:** `Quality` · `Review` · `Universal`

**Pattern.** The same input re-validated in controller, service, and repository — often with type declarations but no runtime schema.

**Forbidden example.**
```ts
function controller(input: Payload) {
  if (!input.email) throw new Error("email required");
  return service(input);
}
function service(input: Payload) {
  if (!input.email) throw new Error("email required");
  return repo(input);
}
```

**Why it hurts.** Variant Systems calls this *"phantom validation"* — beautiful type declarations with no real runtime parse, repeated across layers that trust none of each other. Validation belongs once, at the boundary.

**Rewrite.**
```ts
function controller(raw: unknown) {
  const input = Payload.parse(raw); // boundary parse once
  return service(input);
}
function service(input: Payload) {
  return repo(input);
}
```

**See in `/sublime`:** [SKILL.md#data--state](../sublime/SKILL.md#data--state), [references/data-modeling.md](../sublime/references/data-modeling.md).

---

### Swallowed exception

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A `catch` block that logs and continues with no rethrow, no metric, no recovery.

**Forbidden example.**
```ts
try {
  await chargeCard(order);
} catch (e) {
  console.log(e);
}
markOrderPaid(order);
```

**Why it hurts.** Sohail: *"swallowed errors (where an empty catch block just eats the exception silently) every single time."* The order ships unpaid; the log scrolls past; the bug surfaces in accounting.

**Rewrite.**
```ts
await chargeCard(order);
markOrderPaid(order);
```

**See in `/sublime`:** [SKILL.md#hard-bans](../sublime/SKILL.md#hard-bans), [references/errors.md](../sublime/references/errors.md).

---

### Happy-path utopia

**Tags:** `Quality` · `Review` · `Universal`

**Pattern.** Code that defends against impossible in-memory failures yet omits handling at the real boundaries — network, parse, timeout.

**Forbidden example.**
```ts
try {
  const sum = a + b;
} catch (e) { log(e) }

const res = await fetch(url);
const json = await res.json();
process(json);
```

**Why it hurts.** Babenko: *"ChatGPT loves the happy path. Everything works perfectly in its little utopia."* Defense is sprinkled where it's free and omitted where failures actually live.

**Rewrite.**
```ts
const sum = a + b;

const res = await fetch(url);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
const json = Payload.parse(await res.json());
process(json);
```

**See in `/sublime`:** [SKILL.md#errors--failure-modes](../sublime/SKILL.md#errors--failure-modes), [references/errors.md](../sublime/references/errors.md).

---

### Redundant existence checks

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** The same nullish guard repeated across adjacent lines where one check, or a type refinement, would suffice.

**Forbidden example.**
```ts
if (users && users.length > 0) {
  if (users && users.length > 0) {
    users.forEach(u => {
      if (u && u.name) console.log(u.name);
    });
  }
}
```

**Why it hurts.** Sohail: *"It's being careful, but the redundancy is a sign it's not fully confident in the flow."* The reader has to re-derive the invariant at every line instead of reading it once.

**Rewrite.**
```ts
for (const user of users) {
  console.log(user.name);
}
```

**See in `/sublime`:** [SKILL.md#control-flow--structure](../sublime/SKILL.md#control-flow--structure), [references/control-flow.md](../sublime/references/control-flow.md).
