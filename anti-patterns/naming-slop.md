# Naming slop

Names are the API of code to a reader. Naming slop is what happens when each prompt session reinvents a name for a concept the codebase already has: `Manager` suffixes spread, `UserData`/`UserInfo`/`UserDetails` coexist, local variables decay to `data`/`item`/`result`, and casing drifts mid-function. The root cause is that LLMs stitch patterns from different training examples without checking what the surrounding code already calls things. Watch for generic suffixes, divergent types for one concept, tutorial-scale identifiers, and casing that shifts as you scroll.

### Manager/Helper/Service/Handler/Util suffix proliferation

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Every module grows a `*Manager`, `*Helper`, `*Service`, `*Handler`, or `*Util` when the concept underneath has a real name.

**Forbidden example.**
```ts
class UserManager { /* ... */ }
class AuthHelper { /* ... */ }
class DataService { /* ... */ }
class EventHandler { /* ... */ }
class StringUtil { /* ... */ }
```

**Why it hurts.** These suffixes fit three unrelated things, so they mean nothing. If `Manager` is the only word that fits, the concept has not been named yet — a missing abstraction hides behind the suffix.

**Rewrite.**
```ts
class UserDirectory { /* ... */ }
class SessionTokens { /* ... */ }
class OrderRepository { /* ... */ }
function onCheckout(event: CheckoutEvent) { /* ... */ }
function slugify(input: string): string { /* ... */ }
```

**See in `/sublime`:** [SKILL.md#naming](../sublime/SKILL.md#naming), [references/naming.md](../sublime/references/naming.md).

---

### UserData / UserInfo / UserDetails divergence

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Multiple subtly-different types for the same concept, coexisting because each was generated in isolation.

**Forbidden example.**
```ts
type UserData    = { id: string; name: string; email: string };
type UserInfo    = { userId: string; fullName: string; mail: string };
type UserDetails = { id: string; displayName: string; email: string; createdAt: Date };
```

**Why it hurts.** Variant Systems: *"each prompt session generates code in isolation."* Three names for one concept guarantees bugs at the seams where they're converted back and forth.

**Rewrite.**
```ts
type User = { id: string; name: string; email: string; createdAt: Date };
// every function that needs a user takes User.
```

**See in `/sublime`:** [SKILL.md#naming](../sublime/SKILL.md#naming), [references/naming.md](../sublime/references/naming.md).

---

### Generic-name-where-specific-needed

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** `data`, `item`, `result`, `value`, `obj`, `temp` as the final identifier for a value that has a domain meaning.

**Forbidden example.**
```ts
async function checkout(cart: Cart) {
  const data = await pay(cart);
  const result = data.items;
  const temp = result.map(obj => obj.price);
  return temp.reduce((a, b) => a + b, 0);
}
```

**Why it hurts.** Generic names force the reader to reconstruct context at every line. The writer knew what `data` was; the reader has to infer it from three lines away.

**Rewrite.**
```ts
async function checkout(cart: Cart) {
  const receipt = await pay(cart);
  return receipt.lineItems.reduce((sum, item) => sum + item.price, 0);
}
```

**See in `/sublime`:** [SKILL.md#naming](../sublime/SKILL.md#naming), [references/naming.md](../sublime/references/naming.md).

---

### Tutorial-scale descriptive names

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Local variable names so long they narrate themselves, in scripts small enough that short names would be clearer.

**Forbidden example.**
```ts
const userProfileDataResponseObject = await fetchUser(id);
const totalUserInputCharacterCount = input.length;
const isFeatureToggleEnabledForBetaUsers = flags.beta;
```

**Why it hurts.** dev.to: *"Congratulations. You've probably met an LLM."* Tutorial-trained models pad names for pedagogy; in real code, the call site becomes harder to read, not easier.

**Rewrite.**
```ts
const user = await fetchUser(id);
const length = input.length;
const betaEnabled = flags.beta;
```

**See in `/sublime`:** [SKILL.md#naming](../sublime/SKILL.md#naming), [references/naming.md](../sublime/references/naming.md).

---

### Inconsistent casing shifts mid-function

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A value's name changes casing style within a single function — `userData` becomes `user_data` becomes `data`.

**Forbidden example.**
```ts
function summarize(userData: User) {
  const user_data = normalize(userData);
  const data = user_data;
  return `${data.name}`;
}
```

**Why it hurts.** Sohail: *"The model was stitching patterns from different training examples."* Casing drift is one of the clearest visible tells that generated code was never read end-to-end.

**Rewrite.**
```ts
function summarize(user: User) {
  const normalized = normalize(user);
  return normalized.name;
}
```

**See in `/sublime`:** [SKILL.md#naming](../sublime/SKILL.md#naming), [references/naming.md](../sublime/references/naming.md).

---

### Hungarian resurgence

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Type prefixes baked into identifier names in languages with real type systems: `strName`, `intAge`, `arrUsers`, `bIsReady`.

**Forbidden example.**
```ts
const strName: string = "Ada";
const intAge: number = 36;
const arrUsers: User[] = [];
const bIsReady: boolean = true;
```

**Why it hurts.** The type system already tells readers what these are. Hungarian noise makes refactors worse (renaming `str` to `int` if the type changes) and signals training on old tutorials.

**Rewrite.**
```ts
const name = "Ada";
const age = 36;
const users: User[] = [];
const isReady = true;
```

**See in `/sublime`:** [SKILL.md#naming](../sublime/SKILL.md#naming), [references/naming.md](../sublime/references/naming.md).
