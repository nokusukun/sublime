# TypeScript & JavaScript anti-patterns

The TypeScript-specific slop catalog. Each entry names a pattern the model reaches for when it's guessing at types, reflexively defending against nulls it invented, or padding a React component with ceremony it doesn't need. Every entry is scoped with `Lang:TS` or `Lang:TSX` and links back into the core or the TypeScript extension. Use these the same way you'd use the universal anti-patterns: as catch-on-sight names, as review checklist items, and as candidates for lint rules where the detection is mechanical enough.

---

### `any` abuse

**Tags:** `AI-slop` · `Lint` · `Lang:TS`

**Pattern.** `any` appearing on an exported signature, a class field, or a public type — disabling the type checker for the value and everything it touches.

**Forbidden example.**
```ts
export function parse(input: any): any {
  return JSON.parse(input);
}
```

**Why it hurts.** `any` is contagious. Every caller of `parse` gets `any` back, their callers get `any`, and in six months you have a TypeScript project that compiles nothing meaningful. The checker exists to find the bugs the writer missed; `any` tells it to stop.

**Rewrite.**
```ts
export function parse<T>(input: string, schema: Schema<T>): T {
  return schema.parse(JSON.parse(input));
}
```

**See in `/sublime`:** [SKILL.md#hard-bans-typescript](SKILL.md#hard-bans-typescript), [references/any-unknown-as.md](references/any-unknown-as.md).

---

### `as unknown as Foo` double-cast

**Tags:** `AI-slop` · `Lint` · `Lang:TS`

**Pattern.** A double-cast that launders a structural mismatch between two types the compiler correctly refuses to unify.

**Forbidden example.**
```ts
const user = apiPayload as unknown as User;
db.save(user);
```

**Why it hurts.** The cast lies to the compiler twice. If `apiPayload` had the shape of `User`, a single `as User` would work; the double-cast is a confession that the shapes don't match. The bug it hides is usually a missing parse at the network boundary.

**Rewrite.**
```ts
const user = User.parse(apiPayload); // Zod / Valibot / hand-written guard
db.save(user);
```

**See in `/sublime`:** [SKILL.md#hard-bans-typescript](SKILL.md#hard-bans-typescript), [references/any-unknown-as.md](references/any-unknown-as.md).

---

### async-without-await

**Tags:** `AI-slop` · `Lint` · `Lang:TS`

**Pattern.** A function declared `async` that contains no `await` and does no promise work — the keyword is ceremony.

**Forbidden example.**
```ts
async function formatName(user: User): Promise<string> {
  return `${user.first} ${user.last}`;
}
```

**Why it hurts.** `async` on a synchronous function forces every caller to `await` it or handle a promise for no reason, and it's a tell that the writer added the keyword without understanding what it does. ESLint's `require-await` catches this.

**Rewrite.**
```ts
function formatName(user: User): string {
  return `${user.first} ${user.last}`;
}
```

**See in `/sublime`:** [../../sublime/SKILL.md#control-flow--structure](../../sublime/SKILL.md#control-flow--structure), [SKILL.md#craft-guidelines](SKILL.md#craft-guidelines).

---

### `Promise<void>` wrapper

**Tags:** `AI-slop` · `Lint` · `Lang:TS`

**Pattern.** Hand-constructing a `new Promise((resolve) => ...)` around work that is already synchronous or already promise-shaped.

**Forbidden example.**
```ts
function run(): Promise<void> {
  return new Promise((resolve) => {
    doThing();
    resolve();
  });
}
```

**Why it hurts.** The manual Promise constructor invites forgotten `reject` branches, swallowed throws inside the executor, and double-resolution bugs. An `async` function returns `Promise<void>` for free and propagates errors correctly.

**Rewrite.**
```ts
async function run(): Promise<void> {
  await doThing();
}
```

**See in `/sublime`:** [SKILL.md#hard-bans-typescript](SKILL.md#hard-bans-typescript), [../../sublime/references/errors.md](../../sublime/references/errors.md).

---

### enum-instead-of-const-assertion

**Tags:** `AI-slop` · `Review` · `Lang:TS`

**Pattern.** A TypeScript `enum` used to represent a small closed set of tag values that would serialize and narrow better as a union of string literals.

**Forbidden example.**
```ts
enum Status { Pending, Done, Error }
function render(s: Status) { /* ... */ }
```

**Why it hurts.** TS enums emit runtime objects, produce surprising numeric values by default, break tree-shaking, serialize to JSON as numbers, and narrow awkwardly in switches. A string-literal union costs nothing at runtime and reads the same at every call site.

**Rewrite.**
```ts
const STATUSES = ["pending", "done", "error"] as const;
type Status = (typeof STATUSES)[number];
function render(s: Status) { /* ... */ }
```

**See in `/sublime`:** [SKILL.md#hard-bans-typescript](SKILL.md#hard-bans-typescript), [references/unions-and-narrowing.md](references/unions-and-narrowing.md).

---

### "use client" everywhere

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `"use client"` pasted at the top of every component in a Next.js App Router project, regardless of whether the component uses state, effects, or event handlers.

**Forbidden example.**
```tsx
"use client";
export function Footer() {
  return <footer>© 2026</footer>;
}
```

**Why it hurts.** A Cursor signature in App Router projects. The directive is a boundary: everything imported from a `"use client"` file becomes a client component. Putting it at the top of the tree turns a server-first framework back into a client-first one, losing streaming, RSC payloads, and bundle savings.

**Rewrite.** Put `"use client"` only at the leaf that needs interactivity; let the parents render on the server.
```tsx
export function Footer() {
  return <footer>© 2026</footer>;
}
```

**See in `/sublime`:** [SKILL.md#react-patterns](SKILL.md#react-patterns), [references/react-patterns.md](references/react-patterns.md).

---

### useEffect-dependency-madness

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** A `useEffect` dependency array containing an object or array literal that is reference-new every render, triggering the effect on every render.

**Forbidden example.**
```tsx
useEffect(() => {
  fetchDashboard({ filters: { status: "active" } });
}, [{ status: "active" }]);
```

**Why it hurts.** The Cloudflare dashboard outage was caused by exactly this pattern — an object in a deps array producing an infinite fetch loop. Reference equality fires the effect on every render; the effect triggers a state change; the state change re-renders; the object is new again.

**Rewrite.**
```tsx
const filters = useMemo(() => ({ status: "active" }), []);
useEffect(() => { fetchDashboard(filters); }, [filters]);
// or better: lift the literal to module scope if it never changes.
```

**See in `/sublime`:** [SKILL.md#react-patterns](SKILL.md#react-patterns), [references/react-patterns.md](references/react-patterns.md).

---

### useMemo/useCallback everywhere

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `useMemo` and `useCallback` wrapped around every primitive comparison, every trivial function, every object literal — regardless of whether a measured render-perf problem exists.

**Forbidden example.**
```tsx
const isReady = useMemo(() => count > 0, [count]);
const onClick = useCallback(() => setCount((c) => c + 1), []);
```

**Why it hurts.** Makarevich: *"you can probably remove 90% of all useMemo and useCallbacks in your app right now."* The memoization adds a closure, a deps array, and a cache lookup to save a comparison that already takes nanoseconds. Net cost is positive.

**Rewrite.**
```tsx
const isReady = count > 0;
const onClick = () => setCount((c) => c + 1);
```

**See in `/sublime`:** [SKILL.md#react-patterns](SKILL.md#react-patterns), [references/react-patterns.md](references/react-patterns.md).

---

### data-fetch-in-useEffect (Next.js App Router)

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Fetching data inside `useEffect` in a Next.js App Router project that has server components, route loaders, and streaming available.

**Forbidden example.**
```tsx
"use client";
export function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => {
    fetch("/api/orders").then(r => r.json()).then(setOrders);
  }, []);
  if (!orders) return <Spinner />;
  return <OrderList orders={orders} />;
}
```

**Why it hurts.** The App Router exists to let you fetch on the server, stream the result, and avoid a client-side loading flash. Fetching in `useEffect` throws all of that away — you ship JS, render a spinner, wait for a round trip, then render the list.

**Rewrite.**
```tsx
export async function Orders() {
  const orders = await getOrders(); // server component, awaits on the server
  return <OrderList orders={orders} />;
}
```

**See in `/sublime`:** [SKILL.md#react-patterns](SKILL.md#react-patterns), [references/react-patterns.md](references/react-patterns.md).

---

### giant-Tailwind-classname-string

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** A single `className` string 150+ characters long, unsorted, with duplicated or contradictory utilities, often with conditional branches inlined as string concatenation.

**Forbidden example.**
```tsx
<button className={"flex items-center justify-center px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-semibold shadow-md hover:shadow-lg transition-all duration-200 ease-in-out " + (disabled ? "opacity-50 cursor-not-allowed " : "") + "border border-blue-700 text-sm sm:text-base md:text-lg"}>
```

**Why it hurts.** Avery Code: *"I Spent an Hour Fixing Tailwind Classes GitHub Copilot Created in 10 Seconds."* The string is unreadable, duplicates collapse silently, conditional logic hides inside concatenation, and the diff churns on every touch.

**Rewrite.**
```tsx
import { cn } from "@/lib/cn";

const base = "flex items-center justify-center rounded-md px-4 py-2 font-semibold text-white";
const tone = "bg-blue-500 hover:bg-blue-600 border border-blue-700";
const size = "text-sm sm:text-base";

<button className={cn(base, tone, size, disabled && "cursor-not-allowed opacity-50")}>
```

**See in `/sublime`:** [SKILL.md#react-patterns](SKILL.md#react-patterns), [../../sublime/SKILL.md#control-flow--structure](../../sublime/SKILL.md#control-flow--structure).
