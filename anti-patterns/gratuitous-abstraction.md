# Gratuitous abstraction

Gratuitous abstraction is the shape-tell of LLM architecture: factories for one producer, interfaces for one implementation, builders for two fields, wrappers that only forward arguments. The root cause is a model trained on enterprise Java blog posts generating what *looks* like senior-engineer architecture for problems that need a function. Every unused abstraction is pure reading tax. Watch for single-implementation interfaces, speculative generics, and ceremony where a plain value would do.

### Factory/Strategy/Provider spam

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Cascades of factories, strategies, and providers for a feature with exactly one producer and one consumer.

**Forbidden example.**
```ts
class AuthProviderFactory {
  static create(): AbstractAuthProvider { return new EmailOTPStrategy(new TokenService()); }
}
abstract class AbstractAuthProvider { abstract send(to: string): Promise<void>; }
class EmailOTPStrategy extends AbstractAuthProvider { /* ... */ }
class TokenService { /* ... */ }
// ...12 more files
```

**Why it hurts.** Onn's Claude Code example generated 15 files for what should be ~120 lines in 3. *"Stop planning spacecraft. Start shipping features."* Every layer is a reading tax with no corresponding payoff.

**Rewrite.**
```ts
async function sendOTP(email: string): Promise<void> {
  const code = randomCode();
  await store.set(email, code, { ttl: 300 });
  await mail.send(email, `Your code: ${code}`);
}
```

**See in `/sublime`:** [SKILL.md#hard-bans](../sublime/SKILL.md#hard-bans), [references/interfaces.md](../sublime/references/interfaces.md).

---

### Single-use interface

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** An interface declared for exactly one implementation, "in case we need another later."

**Forbidden example.**
```ts
interface IUserRepository {
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
class UserRepository implements IUserRepository { /* only impl */ }
```

**Why it hurts.** Rachev: *"excessive use of prematurely derived interfaces."* Lindamood: *"the interfaces tend to explode in method count, which makes the whole point of an interface even more difficult to accomplish."* Add the interface when the second implementation appears.

**Rewrite.**
```ts
class UserRepository {
  findById(id: string): Promise<User | null> { /* ... */ }
  save(user: User): Promise<void> { /* ... */ }
}
```

**See in `/sublime`:** [SKILL.md#hard-bans](../sublime/SKILL.md#hard-bans), [references/interfaces.md](../sublime/references/interfaces.md).

---

### Wrapper-that-forwards-args

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A function whose entire body is a call to another function with the same arguments.

**Forbidden example.**
```ts
function runJob(input: JobInput): Promise<JobResult> {
  return runRemoteJob(input);
}
```

**Why it hurts.** hackmysql.com: *"Wrapper functions… are only necessary when they perform common/shared logic for callers (plural)."* The indirection buys nothing and forces readers to chase one more hop to reach the real logic.

**Rewrite.**
```ts
// delete runJob; call runRemoteJob directly.
import { runRemoteJob } from "./remote";
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [references/interfaces.md](../sublime/references/interfaces.md).

---

### Premature generics

**Tags:** `AI-slop` · `Review` · `Lang:TS`

**Pattern.** A generic function or class with exactly one caller, where all type parameters resolve to concrete types at that call site.

**Forbidden example.**
```ts
function pick<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const name = pick<User, "name">(user, "name"); // only call site
```

**Why it hurts.** Generics earn their keep when two or more concrete callers need the same shape. A single-caller generic adds reading tax and lies about reuse that does not exist.

**Rewrite.**
```ts
const name = user.name;
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [references/interfaces.md](../sublime/references/interfaces.md).

---

### Builder for two fields

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** A fluent builder for an object that has two or three fields and no construction invariants.

**Forbidden example.**
```ts
const user = new UserBuilder()
  .withName("Ada")
  .withEmail("ada@example.com")
  .build();
```

**Why it hurts.** Builders pay off when construction is staged, optional, or has invariants to enforce. For a plain record, the object literal is shorter, more honest, and better-typed.

**Rewrite.**
```ts
const user = { name: "Ada", email: "ada@example.com" };
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [references/interfaces.md](../sublime/references/interfaces.md).

---

### Provider/Context-for-one-value

**Tags:** `AI-slop` · `Lint` · `Lang:TS`

**Pattern.** A React Context created, wired, and provided for a value read by exactly one component.

**Forbidden example.**
```tsx
const ThemeContext = createContext<Theme>("light");
function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Header />
    </ThemeContext.Provider>
  );
}
function Header() {
  const theme = useContext(ThemeContext);
  return <h1 className={theme}>Hi</h1>;
}
```

**Why it hurts.** Context is a tool for avoiding prop-drilling across many consumers. One consumer is a prop. The provider machinery costs reading time and makes the data flow invisible to searches.

**Rewrite.**
```tsx
function App() { return <Header theme="dark" />; }
function Header({ theme }: { theme: Theme }) { return <h1 className={theme}>Hi</h1>; }
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [references/interfaces.md](../sublime/references/interfaces.md).

---

### Over-destructure-with-defaults

**Tags:** `AI-slop` · `Review` · `Lang:TS`

**Pattern.** Deeply nested destructuring with default objects at every level, defending against shapes the type system already guarantees.

**Forbidden example.**
```ts
const {
  user: {
    profile: {
      settings: { theme = "light" } = {},
    } = {},
  } = {},
} = props;
```

**Why it hurts.** A Cursor signature in React. The cascade of `= {}` defaults is paranoia about a typed value — every fallback lies about what the type already promises, and small refactors become error-prone.

**Rewrite.**
```ts
const theme = props.user.profile.settings.theme;
```

**See in `/sublime`:** [SKILL.md#data--state](../sublime/SKILL.md#data--state), [references/data-modeling.md](../sublime/references/data-modeling.md).
