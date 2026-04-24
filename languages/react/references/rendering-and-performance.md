# Rendering and performance

React re-renders are cheap; what costs is bad keys, new references passed to memoized children, and the wrong Suspense boundary — and as of the React Compiler v1.0 (October 2025) almost all hand-rolled `useMemo`/`useCallback` is obsolete.

The LLM performance instinct is the opposite of the one you want. Given a slow list it reaches for `React.memo`, `useMemo` around the mapped array, `useCallback` on every handler, and a `key` that is the index or `Math.random()`. None of this helps. `React.memo` is cosmetic when props are inline objects; `useMemo` on a primitive expression is pure overhead; `key={index}` leaks state across items; `key={Math.random()}` remounts every row every render. The real work: stabilize references across memoized boundaries, give list items identity keys, place Suspense at the async unit, wrap non-urgent heavy updates in `startTransition`. In a React Compiler–enabled project, stop hand-memoizing.

## Taxonomy

- **Keys are identity, not uniqueness.**
- **`key={index}` and state leaks.**
- **`key={Math.random()}` and forced remounts.**
- **Inline object/function props defeat `React.memo`.**
- **`React.memo` with unstable props is cosmetic.**
- **Suspense boundaries match async units.**
- **`startTransition` / `useTransition` for non-urgent heavy work.**
- **React Compiler — what it fixes, what it doesn't.**
- **Never silence missing-key warnings.**

---

## Keys are identity

Josh Comeau's [explanation](https://www.joshwcomeau.com/react/common-beginner-mistakes/) is the clearest: *"React keys are used to identify which items have changed, been added, or been removed."* A key is not a uniqueness token; it is the name by which React remembers the item's state, DOM node, and effect subscriptions across renders. If the name changes, React treats it as a new item. If two items share a name, React gets confused about which state belongs where.

The key must be stable across renders (same logical item → same key) *and* unique within siblings. A database ID satisfies both. The array index satisfies only uniqueness. A fresh random value satisfies neither.

---

## `key={index}` when the list can change

When list order is fixed — a hardcoded nav menu, non-reorderable tabs, a render-once list — `key={index}` is fine. The moment the list can reorder, insert, or delete, `key={index}` silently corrupts state.

```tsx
// slop — row state leaks when the list reorders
{todos.map((todo, i) => (
  <TodoRow key={i} todo={todo} />
))}

// fix — identity-bearing key
{todos.map((todo) => (
  <TodoRow key={todo.id} todo={todo} />
))}
```

Failure mode: user types "milk" into the third row's input, then the list resorts alphabetically. Row 3 is now `"eggs"` but `key={2}` still points to the DOM node with `"milk"` in it. `react/no-array-index-key` catches these; enable it.

---

## `key={Math.random()}`

`key={Math.random()}` — or `key={crypto.randomUUID()}`, or `key={Date.now()}` — inside `.map()` generates a fresh key every render. Every item mounts fresh: inputs lose focus, effects re-run, transitions replay, scroll resets, children lose all state. It is the worst performance pattern in React and the most damaging "fix" an LLM applies to silence the missing-key warning.

```tsx
// catastrophic — remounts every item on every render
{items.map((item) => (
  <Row key={Math.random()} item={item} />
))}
```

If the warning fires, find a stable identifier in the data. If none exists, the list items are anonymous upstream; fix it there (have the backend return IDs, use a stable content hash), not at the render call.

---

## Inline object/function props defeat `React.memo`

`React.memo` memoizes the render output based on shallow prop equality. If you pass `{ color: "red" }` as a prop, every parent render creates a new object, shallow-equality returns `false`, and the memo is bypassed. Same for inline arrow functions: `onClick={() => doThing()}` is a fresh function every render.

```tsx
// slop — memo is cosmetic; new object + new function every parent render
const Row = memo(function Row(props: { style: CSSProperties; onClick: () => void }) {
  return <div style={props.style} onClick={props.onClick} />;
});

function List() {
  return items.map((i) => (
    <Row key={i.id} style={{ color: "red" }} onClick={() => handle(i)} />
  ));
}

// fix — stable references; memo now has a chance to skip
const rowStyle: CSSProperties = { color: "red" };

function List() {
  const handleRow = useCallback((i: Item) => handle(i), []);
  return items.map((i) => (
    <Row key={i.id} style={rowStyle} onClick={() => handleRow(i)} />
    // — or, with React Compiler on, just write the inline version
  ));
}
```

`react-perf/jsx-no-new-object-as-prop` and `react-perf/jsx-no-new-function-as-prop` catch these at lint time. Without the Compiler, stabilize manually. With it, ignore — see below.

---

## `React.memo` with unstable props

`React.memo(Component)` where parents always pass inline objects or fresh functions is cosmetic — the check runs, returns `false`, the component re-renders anyway. You pay the shallow-compare cost for nothing. Makarevich: *"If you're not using useMemo and useCallbacks the correct way … they become useless."*

Before wrapping anything in `React.memo`, verify: (1) it is actually a render cost (profile it), (2) the parent re-renders often for unrelated reasons, and (3) every prop is stable. If all three do not hold, remove the memo.

---

## Suspense boundaries

A `<Suspense>` boundary is the unit React treats atomically for async unwinding. Place it at the smallest subtree whose fallback makes sense — the list, not the page; the avatar, not the sidebar. One giant boundary means one slow fetch blanks the screen; per-leaf boundaries mean no meaningful loading state is ever visible.

```tsx
// slop — single giant boundary, everything waits for the slowest fetch
<Suspense fallback={<FullPageSpinner />}>
  <Header />
  <Sidebar />
  <MainContent />  {/* the slow one */}
  <Footer />
</Suspense>

// fix — each async unit has its own boundary
<Header />
<Sidebar />
<Suspense fallback={<MainSkeleton />}>
  <MainContent />
</Suspense>
<Footer />
```

With RSC and streaming, placement matters more — the server flushes up to each boundary. Get it wrong and you serialize what could parallelize.

---

## `startTransition` / `useTransition`

Urgent updates (input values, click handlers, hover states) must land immediately. Non-urgent updates (filtering a 10,000-item list, rendering a heavy chart) can be deferred without the user noticing. `useTransition` and `startTransition` mark updates as non-urgent; React can interrupt them when a more urgent update arrives.

```tsx
function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [isPending, startTransition] = useTransition();

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);                    // urgent — input reflects keystroke
    startTransition(() => {
      setResults(runExpensiveFilter(e.target.value));  // non-urgent — deferrable
    });
  };

  return (
    <>
      <input value={query} onChange={onChange} />
      {isPending ? <Spinner /> : <ResultsList results={results} />}
    </>
  );
}
```

Without this, every keystroke blocks on the filter computation; the field lags above a few thousand items.

---

## React Compiler

The React Compiler (v1.0, October 2025) rewrites component code at build time to memoize values, props, and children automatically. It covers ~95% of the cases where a human would reach for `useMemo` or `useCallback`. In a Compiler-enabled project:

- Stop writing `useMemo` for primitive-returning expressions.
- Stop writing `useCallback` around handlers passed to memoized children.
- Stop wrapping components in `React.memo` speculatively.

The Compiler does not fix what it cannot see: bad keys are still bad keys; the wrong Suspense boundary is still wrong; `startTransition` is still your responsibility. It does not fix shape — a god component stays a god component.

Verify the Compiler with `react-compiler-healthcheck` or the build output. If on, strip hand-rolled memoization as you pass through files. If off, the reference-stability rules above still apply.

---

## Missing-key warnings

The missing-key warning is correctness, not style. It means React cannot reliably reconcile the list. Valid fixes: (1) provide a stable identifier from the data, (2) generate one upstream (backend, content hash, client-side id at creation), or (3) — only when the list is truly static — use the index with a comment explaining why. Never silence it with `key={Math.random()}`.

---

## Rendering primitive comparison

| Primitive | When to use | Common misuse |
|---|---|---|
| `key={item.id}` | Every `.map()` producing elements | Not present, replaced by `Math.random()` |
| `key={index}` | Truly static lists that never reorder | Lists that sort, filter, insert, delete |
| `React.memo(C)` | Expensive `C`, stable props, parent re-renders often | Wrapped around everything; props inline |
| `useMemo(fn, deps)` | Expensive computation, stable deps | Primitive-returning expression; Compiler-on project |
| `useCallback(fn, deps)` | Function passed to memoized child | Handler never passed anywhere; Compiler-on project |
| `<Suspense>` | Matches the async unit boundary | Root-level; every leaf |
| `startTransition` | Non-urgent heavy state update | Every `setState` call; urgent updates |
| React Compiler | Build-time auto-memoization (v1.0, Oct 2025) | Off, with hand-rolled `useMemo` everywhere |

---

## Common AI failure modes

**`key-is-index`** — `{items.map((item, i) => <Row key={i} item={item} />)}` in a list that can reorder, filter, or splice. State, refs, and effects bound to row *n* stick with row *n* when the item moves. The canonical LLM output and the canonical input-keeps-old-value bug. `react/no-array-index-key` flags every instance.

**`key-is-random`** — `key={Math.random()}`, `key={crypto.randomUUID()}`, `key={Date.now() + i}` inside `.map()`. Fresh keys every render; every row remounts, every input loses focus, every effect re-runs. Usually added to silence the missing-keys warning. Find a stable identifier instead.

**`inline-object-function-props`** — `<Memoized style={{ color: "red" }} onClick={() => x()} />` inside a hot parent. Fresh object and function every render; the memo's shallow compare returns `false`; child re-renders anyway. Hoist the object, stabilize the handler (or let the Compiler handle it).

**`memo-useless`** — `React.memo(Component)` around a leaf whose props are always inline objects or fresh functions. Shallow compare finds every prop unequal; re-renders anyway. Cost without benefit.

**`suspense-misplaced`** — one `<Suspense fallback={<FullPageSpinner />}>` at app root, so any slow fetch blanks the screen; or one per leaf, so loading states never appear. Place boundaries at the async unit.

**`starttransition-forgotten`** — expensive filter/search on every keystroke, no `useTransition`. Input lags at a few thousand items. Wrap the heavy `setState` in `startTransition`; keep input-value `setState` urgent.

**`missing-keys-on-lists`** — `.map()` producing elements with no `key`. React warns in dev and falls back to index keys, producing `key-is-index`-class bugs. `react/jsx-key` catches these.

---

### Avoid

- `key={index}` on any list that can reorder, filter, insert, or delete.
  — State and DOM identity follow the key; a mutable list plus index keys equals state leaks across items.
- `key={Math.random()}`, `key={crypto.randomUUID()}`, `key={Date.now()}` inside `.map()`.
  — Remounts every item every render; inputs lose focus, effects re-run, scroll jumps.
- Silencing the missing-key warning instead of fixing the identifier.
  — The warning is correctness, not style; the warning-silencing fix is worse than the warning.
- Inline object and function props passed to `React.memo`-wrapped children.
  — Defeats the memo; the shallow compare sees a fresh reference on every parent render.
- `React.memo` wrapped speculatively around components whose props are never stable.
  — Pure overhead; profile first, memoize only when the three conditions hold.
- Hand-rolled `useMemo` and `useCallback` in a React Compiler–enabled project.
  — The Compiler handles this; hand memoization is dead code and a migration debt line item.
- A single app-root `<Suspense>` for all async work.
  — One slow fetch blanks the whole screen; place boundaries at the async unit.
- Expensive filter/search state updates without `startTransition`.
  — The input blocks on the computation; users feel every keystroke.
- `useMemo` around primitive-returning expressions (`useMemo(() => x + y, [x, y])`).
  — The memo check costs more than the addition; this is pure overhead.

See [`../SKILL.md`](../SKILL.md) for the React posture, hard bans, and React Compiler status.
See [`../anti-patterns.md`](../anti-patterns.md) for the named in-extension catalog of render-cost patterns.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core code-craft foundation.
See [`../../../sublime/references/performance.md`](../../../sublime/references/performance.md) for cross-language performance discipline.
See [`../../../anti-patterns/architectural-slop.md`](../../../anti-patterns/architectural-slop.md) for structural patterns that mask as performance problems.
See [`component-architecture.md`](component-architecture.md) for the composition shape that determines what re-renders.
See [`styling.md`](styling.md) for the styling-system companion to rendering cost.
See [`../../typescript/SKILL.md`](../../typescript/SKILL.md) for the type-level companion to stable-reference discipline.
