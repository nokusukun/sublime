# Hooks

Most React slop is a hook reaching for something the hook should not be doing — `useEffect` in particular is a synchronization primitive for side effects that must live outside React's pure rendering, not a generic "code that runs" wrapper.

If a value can be computed from props and state during render, render it. If a handler fires from a user interaction, handle it in the event. If you need data from a server, a query library or RSC owns that. `useEffect` stays for its narrow purpose: synchronizing a React component with an external system — a subscription, an animation frame, a non-React widget, an imperative DOM handle reconciled after commit. Dan Abramov's audit of 128 random Meta `useEffect` calls found 59 unnecessary; in LLM output the rate is higher, because the model's instinct is that anything runtime-shaped belongs in an effect. Most of this file is a campaign against that instinct.

## `useEffect` is a synchronization primitive

Read [react.dev/learn/you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect) until the framing sticks: effects synchronize with systems outside React. A WebSocket, a `MutationObserver`, a canvas, a map library, an analytics SDK — those are external systems. Derived numbers, filtered arrays, formatted strings, and responses to button clicks are not.

Operational test: ask "what external thing am I keeping in sync here?" If the answer is "nothing, I just want to run code," you do not want an effect. You want render, a handler, a memo, or a query hook.

```tsx
// Slop — effect synchronizes nothing external.
function Total({ items }: { items: LineItem[] }) {
  const [total, setTotal] = useState(0);
  useEffect(() => {
    setTotal(items.reduce((s, i) => s + i.price, 0));
  }, [items]);
  return <span>{total}</span>;
}

// Fix — derive during render.
function Total({ items }: { items: LineItem[] }) {
  const total = items.reduce((s, i) => s + i.price, 0);
  return <span>{total}</span>;
}
```

The slop version renders once with `0`, commits, runs the effect, calls `setTotal`, re-renders, and finally shows the right number. The fix renders once with the right number.

## Derived state in render

Anything computable from existing props and state should be a plain expression in the render body. No `useState`, no `useEffect`, no `useMemo` unless profiling demands it.

```tsx
// Slop — second source of truth, always stale for one render.
function FullName({ first, last }: { first: string; last: string }) {
  const [full, setFull] = useState(`${first} ${last}`);
  useEffect(() => { setFull(`${first} ${last}`); }, [first, last]);
  return <>{full}</>;
}

// Fix.
function FullName({ first, last }: { first: string; last: string }) {
  return <>{`${first} ${last}`}</>;
}
```

The same rule kills `useEffect` bodies that filter, sort, group, or format data. If the input changes, render will run again; the derived value comes along for free. See [../../../sublime/references/data-modeling.md](../../../sublime/references/data-modeling.md) on cached-fact-with-no-name for the shape-level version of the same lesson.

## Event handlers, not effects, for user interactions

When a logic path exists because a user did something — clicked submit, flipped a toggle, dragged a slider — that logic belongs in the event handler. Effects that fire "because a state flag went true" are a handler wearing an effect costume.

```tsx
// Slop — POSTs from an effect triggered by a flag.
function CheckoutForm() {
  const [submitted, setSubmitted] = useState(false);
  const [cart, setCart] = useState<Cart>(emptyCart);
  useEffect(() => {
    if (submitted) fetch("/api/checkout", { method: "POST", body: JSON.stringify(cart) });
  }, [submitted, cart]);
  return <button onClick={() => setSubmitted(true)}>Pay</button>;
}

// Fix — POST is the click.
function CheckoutForm() {
  const [cart, setCart] = useState<Cart>(emptyCart);
  const submit = () => { void fetch("/api/checkout", { method: "POST", body: JSON.stringify(cart) }); };
  return <button onClick={submit}>Pay</button>;
}
```

The slop version fires twice under StrictMode, and again on any unrelated re-render that flips the flag.

## Data fetching belongs in a query library

Do not fetch from `useEffect`. TanStack Query, SWR, or RTK Query handle cancellation, dedup, caching, retry, revalidation, and race protection; `useEffect` + `fetch` handles none of them, and every attempt to add them reinvents half of TanStack Query badly. In Next.js App Router, an RSC that `await`s the fetch at render time is the correct primitive.

```tsx
// Slop — race, no cancel, no cache, no dedup.
function UserCard({ id }: { id: string }) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch(`/api/users/${id}`).then(r => r.json()).then(setUser);
  }, [id]);
  if (!user) return <Spinner />;
  return <h1>{user.name}</h1>;
}

// Fix — query library.
function UserCard({ id }: { id: string }) {
  const { data: user, isPending } = useQuery({
    queryKey: ["user", id],
    queryFn: () => fetch(`/api/users/${id}`).then(r => r.json() as Promise<User>),
  });
  if (isPending) return <Spinner />;
  return <h1>{user!.name}</h1>;
}
```

Vercel's [react-best-practices](https://vercel.com/blog/introducing-react-best-practices) skill exists specifically to stop the slop variant. See [state-management.md](state-management.md) for where fetched data belongs.

## `useMemo` / `useCallback` restraint

Nadia Makarevich: *"You can probably remove 90% of all useMemo and useCallbacks in your app right now."* The memoization hooks are for a narrow case — stabilizing a reference passed to a memoized child, or skipping a genuinely expensive computation. Wrapping primitive-returning expressions, string concatenations, or arithmetic in `useMemo` pays bookkeeping for nothing.

`useCallback` on a handler consumed by an un-memoized child is cosmetic. React Compiler (v1.0, October 2025) auto-memoizes correct components and obsoletes ~95% of hand-rolled memoization. If the compiler is on, delete the wrappers; if off, keep them only where a profile shows they matter.

```tsx
// Slop — every hook here is cosmetic.
function Price({ cents }: { cents: number }) {
  const formatted = useMemo(() => (cents / 100).toFixed(2), [cents]);
  const onClick = useCallback(() => alert(formatted), [formatted]);
  return <button onClick={onClick}>{formatted}</button>;
}

// Fix.
function Price({ cents }: { cents: number }) {
  const formatted = (cents / 100).toFixed(2);
  return <button onClick={() => alert(formatted)}>{formatted}</button>;
}
```

## Ref vs state — the reactivity boundary

`useState` values trigger re-renders. `useRef` values do not. A ref is right for a mutable value that persists across renders but does not cause one — an interval ID, a previous-value snapshot, a DOM node handle, a flag the next effect will read. A ref is wrong when the UI depends on the value; reading `ref.current` in render returns whatever was last written, with no guarantee the component will render again.

```tsx
// Slop — UI depends on ref.current, which does not trigger renders.
function Counter() {
  const count = useRef(0);
  return <button onClick={() => { count.current++; }}>{count.current}</button>;
}

// Fix — reactive value is state.
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

If you reach for `useRef` to silence an `exhaustive-deps` warning, stop — the warning is usually correct and the fix is almost never a ref.

## The Rules of Hooks

Hooks must be called in the same order on every render. That is how React matches each hook call to its slot in the fiber's hook list. Call hooks unconditionally at the top level of a function component or another hook; never inside `if`, `for`, `while`, `switch`, `try`, or after an early `return`.

```tsx
// Slop — crashes the first time `user` is null.
function Profile({ user }: { user: User | null }) {
  if (!user) return null;
  const [edit, setEdit] = useState(false); // conditional — wrong slot
  return <button onClick={() => setEdit(e => !e)}>{edit ? "Save" : "Edit"}</button>;
}

// Fix — hook at top, branch on the value.
function Profile({ user }: { user: User | null }) {
  const [edit, setEdit] = useState(false);
  if (!user) return null;
  return <button onClick={() => setEdit(e => !e)}>{edit ? "Save" : "Edit"}</button>;
}
```

`react-hooks/rules-of-hooks` is non-negotiable. Turn it on with the error level, not warn.

## `useEffectEvent` — the stale-closure escape hatch

React 19.2 stabilized `useEffectEvent`. It wraps a function so the effect can call it and see the latest props/state without subscribing. Use it when an effect needs the freshest value of something but should not re-run when that value changes.

```tsx
// Before — the effect re-subscribes every time `onMessage` identity changes,
// or misses updates if `[]` is used.
useEffect(() => {
  socket.on("msg", m => onMessage(m, roomId));
  return () => socket.off("msg");
}, [onMessage, roomId]); // churn; or [] with stale closure

// After — `onEvent` always sees the latest closure; effect re-runs only for roomId.
const onEvent = useEffectEvent((m: Msg) => onMessage(m, roomId));
useEffect(() => {
  socket.on("msg", onEvent);
  return () => socket.off("msg");
}, [socket]);
```

Do not use `useEffectEvent` to paper over a missing dependency — that is `exhaustive-deps` suppression wearing a new hat.

## Cleanup functions

Any effect that starts something external returns a function that stops it — subscriptions, intervals, timeouts, observers, abort controllers, non-React widgets. StrictMode double-invokes effects in development to expose missing cleanup.

```tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id); // required
}, []);

useEffect(() => {
  const ac = new AbortController();
  fetch(url, { signal: ac.signal }).then(r => r.json()).then(setData);
  return () => ac.abort();
}, [url]);
```

An effect that only synchronizes a value needs no cleanup, which usually means it should not be an effect.

## `useLayoutEffect` vs `useEffect`

`useEffect` runs after paint. `useLayoutEffect` runs synchronously after DOM mutation, before the browser paints. Use `useLayoutEffect` only for DOM measurement plus state/style writes that must apply before the user sees a frame — tooltip positioning, auto-grow textareas, synchronous scroll restoration. Everything else belongs in `useEffect`; `useLayoutEffect` blocks paint and causes jank, and it warns under SSR because there is no server layout phase.

## Hook reference table

| Hook | Use for | Misuse | Replacement |
|---|---|---|---|
| `useState` | Local reactive value | Storing derived value | Compute in render |
| `useEffect` | Sync with external system | Derived state, event response, fetching | Render / handler / query lib |
| `useLayoutEffect` | Sync DOM measurement before paint | Data fetch, analytics | `useEffect` |
| `useRef` | Non-reactive mutable value, DOM handle | UI-visible value | `useState` |
| `useMemo` | Expensive computation or stable reference for memoized child | Primitives, cheap work | Plain expression; Compiler |
| `useCallback` | Stable reference for memoized child or effect dep | Any handler not passed to `memo` | Plain function; Compiler |
| `useReducer` | Multi-step state with related transitions | Single toggle | `useState` |
| `useContext` | DI of stable value across tree | State management for a single form | Local state / store |
| `useEffectEvent` (19.2) | Latest closure value without subscribing | Suppressing genuine deps | Fix the deps |
| `useTransition` | Marking non-urgent updates | Every `setState` | Leave updates urgent by default |
| `useId` | Stable SSR-safe id for labels | Keys on lists | `key` with stable item id |

## Common AI failure modes

- **`useeffect-for-derived-state`** — `useEffect(() => setFull(first + " " + last), [first, last])`. Stale intermediate value on first render, twice the commits. Calculate during render. Caught by YMNNAE.
- **`useeffect-for-event-response`** — effect body POSTs or navigates because a flag went true. Move the logic into the handler that flipped the flag.
- **`stale-closure-deps`** — effect reads a reactive value not in deps, or uses `[]` while the body references props/state. Fix deps, or use `useEffectEvent` when the value must be current without triggering re-runs. `react-hooks/exhaustive-deps` autofixes most.
- **`memo-cargo-cult`** — `useMemo` around `a + b`, `useCallback` around handlers consumed by un-memoized children. Makarevich's "90% can go." React Compiler deletes most.
- **`usestate-for-derived-value`** — `useState(items.reduce(...))` for a value that never updates independently of `items`. Two sources of truth, one always behind. Compute in render.
- **`useeffect-data-fetching`** — `useEffect(() => fetch(url).then(r=>r.json()).then(setData), [url])`. No cancel, no dedup, no cache. Single most-produced React slop pattern. Replace with TanStack Query, SWR, or RSC.
- **`useeffect-syncs-props-to-state`** — `useEffect(() => setLocal(propValue), [propValue])`. Local copy always one render stale. Read the prop directly, or `key` the component on the prop for a reset.
- **`useeffect-chains`** — Effect A sets X, B depends on X and sets Y, C depends on Y. Cascading commits. Compute the final value in one function and call one setter.
- **`missing-cleanup`** — subscription, socket, interval, or observer with no cleanup return. Leaks; StrictMode double-fire exposes it.
- **`race-without-abort`** — async fetch in effect with no `AbortController` or ignore-flag; rapid dep changes shuffle `setData` order. Use a query library.
- **`infinite-loop-object-deps`** — `useEffect(fn, [{a: 1}])`. New reference every render, effect re-runs, `setState` loops. Move literals out; depend on primitive fields.
- **`componentdidmount-mimicry`** — `useEffect(fn, [])` as "run once" while the body references props/state. StrictMode double-invocation surfaces the bug.
- **`custom-hook-that-should-be-function`** — `useFormattedPrice(n)` that returns `n.toFixed(2)` with no hooks inside. Pays hook overhead, lies about side effects. Make it a function.
- **`conditional-hook-call`** — `useState` inside `if`, loop, or after early `return`. Crashes on the first branch change. `react-hooks/rules-of-hooks` catches as error.

### Avoid

- `useEffect` whose body only derives a value from props/state and calls `setState`.
  — Renders twice, shows a stale value in between, and guarantees the derived copy drifts from its source.
- `useEffect` that runs because a flag flipped, doing work a click handler should own.
  — Handlers run exactly when the user acts; effects run on every dependency change, including ones the user did not trigger.
- `useEffect` + `fetch` + `setData` in application code.
  — No cancellation, no dedup, no cache, no race protection; every attempt to add them reinvents a query library.
- `useMemo` / `useCallback` wrapping primitive work or handlers not consumed by memoized children.
  — Pays bookkeeping cost for zero benefit; React Compiler obsoletes most of these automatically.
- `useRef` storing a value that the UI renders.
  — Ref writes do not trigger renders, so the UI will show whatever was there last, inconsistently.
- `useEffect` with no cleanup for a subscription, interval, observer, or socket.
  — Leaks grow per mount; StrictMode double-fire turns a silent leak into a visible bug.
- `useEffect(..., [])` when the body references props or state.
  — Stale closures; the values are frozen at first mount and StrictMode will double-commit to prove it.
- An object or array literal in a dep array.
  — New reference every render → effect runs every render → often an infinite loop if it calls `setState`.
- A function named `useX` that calls no hooks inside.
  — Pays hook call overhead, misleads readers, and imposes the Rules of Hooks on callers for no reason.
- Hooks called inside `if`, loop, `switch`, or after an early `return`.
  — Breaks React's hook-slot matching and crashes the first time the branch changes; `rules-of-hooks` must be error, not warn.
- `useLayoutEffect` for anything that is not DOM measurement.
  — Blocks paint, causes jank in SSR, and fails the isomorphic boundary.

→ Parent skill: [../SKILL.md](../SKILL.md). Core foundation: [../../../sublime/SKILL.md](../../../sublime/SKILL.md). Core data-shape discipline that kills most derived-state slop: [../../../sublime/references/data-modeling.md](../../../sublime/references/data-modeling.md). Sibling state-architecture reference: [state-management.md](state-management.md). Sibling forms discipline: [forms.md](forms.md). TypeScript cousin for typing hook returns: [../../typescript/SKILL.md](../../typescript/SKILL.md), [../../typescript/references/generics.md](../../typescript/references/generics.md). Shared catalog on unbounded-concurrency patterns that `race-without-abort` shares with Python/Go: [../../../anti-patterns/security-and-correctness.md](../../../anti-patterns/security-and-correctness.md). In-extension React anti-patterns: [../anti-patterns.md](../anti-patterns.md).
