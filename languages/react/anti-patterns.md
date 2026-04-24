# React anti-patterns

React's LLM slop has one dominant centre of gravity: **`useEffect` abuse**. Dan Abramov's informal audit — *"I spot-checked random 128 useEffect calls in the Meta codebase, classified them into several groups, and 59 out of 128 were unnecessary"* — applies at an even higher ratio to LLM output. Every pattern at [react.dev/learn/you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect) shows up multiple times in any fresh Claude/Copilot/Cursor project: derived state through effects, prop-to-state mirrors, event responses behind flags, chains of effects reacting to each other. The second axis is the **memo cargo cult** — Nadia Makarevich: *"You can probably remove 90% of all useMemo and useCallbacks in your app right now"* — primitive expressions wrapped in `useMemo`, `useCallback` on functions never passed to memoized children, `React.memo` where the parent re-creates every prop every render. The third axis is **component architecture slop** from one-shot generators: 500-line god components, provider hell (5+ nested context providers), prop explosion with mutually-exclusive boolean variants, wrapper-component disease from shadcn copy-paste. The **Next.js App Router / React Server Components** era added its own failure mode: `"use client"` reflexively on every file because training data skews Pages Router, plus serialization-boundary errors (`Date`, `Map`, class instances, functions passed server-to-client). Underneath these sit classic surface sins — `key={index}`, `NEXT_PUBLIC_` secret leaks, Tailwind class vomit, `getByTestId` over `getByRole`, `<div onClick>` where `<button>` belongs.

---

### `useeffect-for-derived-state`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `useState` + `useEffect` to mirror a value that can be computed from props and existing state during render.

**Forbidden example.**
```tsx
function Greeting({ first, last }: { first: string; last: string }) {
  const [fullName, setFullName] = useState("");
  useEffect(() => {
    setFullName(`${first} ${last}`);
  }, [first, last]);
  return <h1>{fullName}</h1>;
}
```

**Why it hurts.** Abramov: *"If you can calculate [something] during rendering, you don't need an Effect."* Causes a second render with a stale intermediate (`""`), duplicates the source of truth, and ships the component as "usable but briefly wrong." `eslint-plugin-react-you-might-not-need-an-effect` (`YMNNAE`) catches it.

**Rewrite.**
```tsx
function Greeting({ first, last }: { first: string; last: string }) {
  const fullName = `${first} ${last}`;
  return <h1>{fullName}</h1>;
}
```

**See in `/sublime`:** [SKILL.md#hooks-and-effects](SKILL.md#hooks-and-effects), [references/hooks.md](references/hooks.md).

---

### `useeffect-for-event-response`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** An effect body runs logic that should have fired from a user interaction — POST on a `submitted` boolean flipping, navigation after a button click flag.

**Forbidden example.**
```tsx
const [submitted, setSubmitted] = useState(false);
useEffect(() => {
  if (submitted) {
    fetch("/api/orders", { method: "POST", body: JSON.stringify(order) });
  }
}, [submitted]);
return <button onClick={() => setSubmitted(true)}>Buy</button>;
```

**Why it hurts.** Abramov: *"If this logic is caused by a particular interaction, keep it in the event handler."* StrictMode will fire it twice; remount will replay it; the flag lives forever as a fake-state trigger. `YMNNAE/no-event-handler`.

**Rewrite.**
```tsx
function handleBuy() {
  fetch("/api/orders", { method: "POST", body: JSON.stringify(order) });
}
return <button onClick={handleBuy}>Buy</button>;
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `stale-closure-deps`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** An effect reads a reactive value not in its dependency array — or an empty `[]` is used as "componentDidMount" while the body references props/state.

**Forbidden example.**
```tsx
useEffect(() => {
  const id = setInterval(() => console.log(count), 1000);
  return () => clearInterval(id);
}, []); // count is stale forever
```

**Why it hurts.** The canonical bug class that motivated `useEffectEvent` (React 19.2). The effect captures the first `count`, never updates. `react-hooks/exhaustive-deps` flags and autofixes.

**Rewrite.**
```tsx
// React 19.2+:
const onTick = useEffectEvent(() => console.log(count));
useEffect(() => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}, []);
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `memo-cargo-cult`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `useMemo` / `useCallback` on primitive expressions, on functions never passed to a memoized child, or with already-stable deps.

**Forbidden example.**
```tsx
const total = useMemo(() => price + tax, [price, tax]);
const onClick = useCallback(() => console.log("hi"), []);
return <Row onClick={onClick} />;
```

**Why it hurts.** Makarevich: *"You can probably remove 90% of all useMemo and useCallbacks in your app right now."* The memo itself allocates a deps array; the saved work is a single `+`. Claude's strongest React tic. React Compiler v1.0 obsoletes ~95% of these — when enabled.

**Rewrite.**
```tsx
const total = price + tax;
function onClick() { console.log("hi"); }
return <Row onClick={onClick} />;
```

**See in `/sublime`:** [SKILL.md#rendering-and-performance](SKILL.md#rendering-and-performance), [references/rendering-and-performance.md](references/rendering-and-performance.md).

---

### `usestate-for-derived-value`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `useState` initialised from a derivation, then never updated independently — a second source of truth for something that is already state somewhere.

**Forbidden example.**
```tsx
function Cart({ items }: { items: Item[] }) {
  const [total, setTotal] = useState(items.reduce((a, i) => a + i.price, 0));
  // total is stale the moment items changes
  return <p>{total}</p>;
}
```

**Why it hurts.** `items` is the source of truth; `total` is a function of it. The `useState` initialiser runs once on mount — on every subsequent `items` change, `total` is wrong. Usually paired with `useeffect-for-derived-state` as the "fix."

**Rewrite.**
```tsx
function Cart({ items }: { items: Item[] }) {
  const total = items.reduce((a, i) => a + i.price, 0);
  return <p>{total}</p>;
}
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `custom-hook-that-should-be-function`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** A function named `useX` that calls no hooks internally — it is a function, not a custom hook.

**Forbidden example.**
```tsx
function useFormattedPrice(n: number) {
  return n.toFixed(2);
}
```

**Why it hurts.** Pays the `useX` convention tax (callers assume React lifecycle involvement; lint tooling treats it as a hook), misleads readers about side effects, and will be linted if any consumer calls it conditionally. LLMs name everything `useX`.

**Rewrite.**
```tsx
function formatPrice(n: number) {
  return n.toFixed(2);
}
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `conditional-hook-call`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `useState` / `useEffect` inside an `if`, loop, or after an early `return`.

**Forbidden example.**
```tsx
function Row({ open }: { open: boolean }) {
  if (!open) return null;
  const [hover, setHover] = useState(false); // hook after early return
  return <div onMouseEnter={() => setHover(true)}>...</div>;
}
```

**Why it hurts.** React identifies hooks by call order. Toggling `open` shifts the order; state and effects bind to the wrong hook on the next render; the component crashes or misbehaves. `react-hooks/rules-of-hooks`.

**Rewrite.**
```tsx
function Row({ open }: { open: boolean }) {
  const [hover, setHover] = useState(false);
  if (!open) return null;
  return <div onMouseEnter={() => setHover(true)}>...</div>;
}
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `redux-for-toggle`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Global Redux store + slice + action creators + reducer for `isModalOpen` or a single tab's selected index.

**Forbidden example.**
```tsx
// modalSlice.ts: createSlice({ name: "modal", initialState: { open: false },
//   reducers: { open(s) { s.open = true }, close(s) { s.open = false } } })
const open = useSelector((s: RootState) => s.modal.open);
const dispatch = useDispatch();
return <Button onClick={() => dispatch(openModal())}>Open</Button>;
```

**Why it hurts.** Mark Erikson's ["When (and when not) to reach for Redux"](https://blog.isquaredsoftware.com/) is the canonical critique. Redux is for global interactions across unrelated modules; a toggle that one component reads and one writes is `useState`.

**Rewrite.**
```tsx
const [open, setOpen] = useState(false);
return <Button onClick={() => setOpen(true)}>Open</Button>;
```

**See in `/sublime`:** [SKILL.md#state-management](SKILL.md#state-management).

---

### `context-provider-for-one-value`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Context + Provider + custom hook for a single value consumed one or two levels down.

**Forbidden example.**
```tsx
const TitleContext = createContext<string>("");
export function TitleProvider({ title, children }) {
  return <TitleContext.Provider value={title}>{children}</TitleContext.Provider>;
}
export const useTitle = () => useContext(TitleContext);
// used once, one level down
```

**Why it hurts.** Mark Erikson: [*"Why React Context is Not a 'State Management' Tool."*](https://blog.isquaredsoftware.com/2021/01/context-redux-differences/) Context re-renders every consumer on every change and is ceremonial here — a prop passes the value with zero overhead.

**Rewrite.**
```tsx
<Child title={title} />
```

**See in `/sublime`:** [references/state-management.md](references/state-management.md).

---

### `provider-hell`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** 5+ nested `<XProvider>` components at the app root.

**Forbidden example.**
```tsx
<ThemeProvider>
  <AuthProvider>
    <NotificationProvider>
      <ModalProvider>
        <ToastProvider>
          <FeatureFlagProvider>
            <App />
          </FeatureFlagProvider>
        </ToastProvider>
      </ModalProvider>
    </NotificationProvider>
  </AuthProvider>
</ThemeProvider>
```

**Why it hurts.** Each layer adds a subscription boundary and re-renders every consumer when its value changes. Typical of Bolt/Lovable full-stack scaffolds. The symptom of mistaking Context for a state manager.

**Rewrite.** Collapse stable slow-moving values into one `AppProvider`. Move fast-moving state into a store (Zustand, Jotai) with selector subscriptions. If a provider wraps a single feature, move it down near the feature's subtree.

**See in `/sublime`:** [references/state-management.md](references/state-management.md).

---

### `prop-drilling-epic`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** A prop passed through 4+ intermediary components that do not read it.

**Forbidden example.**
```tsx
<Page user={user}>
  <Layout user={user}>
    <Sidebar user={user}>
      <Menu user={user}>
        <Profile user={user} />
```

**Why it hurts.** Makarevich: *"Wrapping state down and wrapping state around children are the most important tools in your fight against unnecessary re-renders."* Composition via `children` eliminates the drill without Context.

**Rewrite.**
```tsx
<Page>
  <Layout>
    <Sidebar>
      <Menu>
        <Profile user={user} />
      </Menu>
    </Sidebar>
  </Layout>
</Page>
```

**See in `/sublime`:** [references/component-architecture.md](references/component-architecture.md).

---

### `url-state-in-local-state`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Filter, tab, pagination, search, or sort state in `useState` instead of the URL.

**Forbidden example.**
```tsx
const [page, setPage] = useState(1);
const [query, setQuery] = useState("");
const [sort, setSort] = useState<"asc" | "desc">("asc");
// refresh loses all of it; shareable links do not exist
```

**Why it hurts.** Ryan Florence / Remix team: *"URL is the original state manager."* `useState` makes refresh destroy state, makes shareable links impossible, makes back/forward nonsensical. LLMs default to `useState` for everything.

**Rewrite.**
```tsx
const [params, setParams] = useSearchParams();
const page = Number(params.get("page") ?? 1);
const query = params.get("q") ?? "";
// or nuqs: const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
```

**See in `/sublime`:** [SKILL.md#state-management](SKILL.md#state-management).

---

### `server-state-in-client-store`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Fetched API data kept in Redux / Zustand / Context with hand-rolled `loading`, `error`, `stale` flags — reimplementing a query library badly.

**Forbidden example.**
```tsx
const [data, setData] = useState<User[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<Error | null>(null);
useEffect(() => {
  setLoading(true);
  fetch("/api/users")
    .then(r => r.json()).then(setData)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);
```

**Why it hurts.** Vercel's react-best-practices: *"Use TanStack Query to fetch and mutate data asynchronously instead of useEffect and useCallback."* Caching, dedup, retries, revalidation, race protection — all of it has to be rebuilt by hand when you skip the library.

**Rewrite.**
```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ["users"],
  queryFn: () => fetch("/api/users").then(r => r.json()),
});
```

**See in `/sublime`:** [SKILL.md#state-management](SKILL.md#state-management).

---

### `god-component`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** A single file, 500+ lines, 10+ `useState`, 5+ `useEffect`, mixed concerns (data fetch + form + modal + table + nav).

**Forbidden example.**
```tsx
export default function Dashboard() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<User | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // ... 480 more lines ...
}
```

**Why it hurts.** Bolt's worst failure mode — *"the entire app in one component."* Nothing is isolable, nothing is testable, every change re-renders the entire screen.

**Rewrite.** Split by concern: `<UserTable>`, `<UserFilter>`, `<EditUserDialog>`, `<Toaster>`. Move data fetching into a query hook. Keep the top-level component as composition only.

**See in `/sublime`:** [SKILL.md#component-architecture](SKILL.md#component-architecture).

---

### `premature-extraction`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Splitting a 30-line component into 5 tiny files before any reuse case — "clean architecture" aesthetic.

**Forbidden example.**
```
components/user-card/
  UserCardRoot.tsx       (12 lines)
  UserCardAvatar.tsx     (8 lines)
  UserCardName.tsx       (6 lines)
  UserCardActions.tsx    (10 lines)
  index.ts               (re-exports)
```

**Why it hurts.** Abramov, ["The WET Codebase"](https://overreacted.io/): *abstraction before duplication is worse than duplication.* The premature extraction locks in an API that does not match the second use case, which does not exist yet.

**Rewrite.** Keep it in one file until there is a real second call site. Extract on duplication, not anticipation.

**See in `/sublime`:** [references/component-architecture.md](references/component-architecture.md).

---

### `prop-explosion`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** A component with 10–30 props, many optional.

**Forbidden example.**
```tsx
<Card
  title={...} subtitle={...} image={...} imageAlt={...}
  footer={...} footerAlign="right" borderless compact
  onClick={...} onHover={...} onClose={...} closable
  loading error errorMessage retryLabel onRetry
  theme="dark" variant="outlined" density="comfortable"
/>
```

**Why it hurts.** Signals missing composition. Each new requirement adds a prop instead of a slot; internal conditionals fan out; invalid prop combinations become possible.

**Rewrite.**
```tsx
<Card>
  <Card.Header image={...}>
    <Card.Title>{...}</Card.Title>
    <Card.Close onClick={onClose} />
  </Card.Header>
  <Card.Footer align="right">{...}</Card.Footer>
</Card>
```

**See in `/sublime`:** [references/component-architecture.md](references/component-architecture.md).

---

### `boolean-flag-variants`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `<Alert isError isWarning isInfo isSuccess />` — mutually-exclusive boolean props.

**Forbidden example.**
```tsx
<Alert isError isWarning>Something went wrong</Alert>
// and nothing stops you
```

**Why it hurts.** Martin Fowler's flag-argument anti-pattern. Enables invalid combinations (`isError && isWarning`), duplicates variants across the API surface, and hides the actual cardinality.

**Rewrite.**
```tsx
<Alert variant="error">Something went wrong</Alert>
// type Props = { variant: "error" | "warning" | "info" | "success"; ... }
```

**See in `/sublime`:** [SKILL.md#component-architecture](SKILL.md#component-architecture).

---

### `hoc-where-hook-works`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `withAuth(Component)`, `withTheme(Component)`, `connect(mapState)(Component)` where a hook (`useAuth`, `useTheme`) does the same job.

**Forbidden example.**
```tsx
export default withAuth(withTheme(withAnalytics(Dashboard)));
```

**Why it hurts.** Mark Erikson's ["Hooks, HOCs, and Tradeoffs"](https://blog.isquaredsoftware.com/) critique. HOCs wrap the component tree with invisible indirection, collide on prop names, and are harder to type than hooks.

**Rewrite.**
```tsx
function Dashboard() {
  const user = useAuth();
  const theme = useTheme();
  useAnalytics();
  // ...
}
```

**See in `/sublime`:** [references/component-architecture.md](references/component-architecture.md).

---

### `wrapper-component-disease`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `<StyledContainer>` wrapping `<Container>` wrapping `<Box>` wrapping `<div>` for no behavioural reason.

**Forbidden example.**
```tsx
<StyledPageWrapper>
  <PageContainer>
    <ContentContainer>
      <Box>
        <div>Hello</div>
      </Box>
    </ContentContainer>
  </PageContainer>
</StyledPageWrapper>
```

**Why it hurts.** DevTools trees 15 levels deep for a button. High in Lovable / Bolt shadcn output where copy-paste accumulates wrappers that each styled one thing and never got collapsed.

**Rewrite.** Collapse. Keep wrappers that change behaviour or semantics; delete the rest.

**See in `/sublime`:** [references/component-architecture.md](references/component-architecture.md).

---

### `forwardref-cargo-cult`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** Wrapping a component in `forwardRef` when it never receives a ref — or doing it at all in React 19, where `ref` is a plain prop.

**Forbidden example.**
```tsx
// React 19 project
export const Button = forwardRef<HTMLButtonElement, Props>((props, ref) => (
  <button ref={ref} {...props} />
));
```

**Why it hurts.** [Mudssrali: *"Stop using forwardRef() in your custom components in React."*](https://mudssrali.com/blog/stop-using-forward-ref-in-your-custom-components-in-react) Training data predates React 19, so Claude/Copilot emit `forwardRef` reflexively. Extra boilerplate, unhelpful generics, displayName confusion.

**Rewrite.**
```tsx
// React 19+
export function Button({ ref, ...props }: Props & { ref?: Ref<HTMLButtonElement> }) {
  return <button ref={ref} {...props} />;
}
```

**See in `/sublime`:** [SKILL.md#component-architecture](SKILL.md#component-architecture).

---

### `key-is-index`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `{items.map((item, i) => <Row key={i} item={item} />)}` on a list that can reorder, insert, or remove.

**Forbidden example.**
```tsx
{todos.map((todo, i) => (
  <TodoRow key={i} todo={todo} />
))}
```

**Why it hurts.** Comeau: *"React will actually delete the DOM nodes associated with the last item… and will then have to do a bunch of work on all the other DOM nodes."* Form inputs keep old values across reorders; focus jumps; transitions break. `react/no-array-index-key`.

**Rewrite.**
```tsx
{todos.map(todo => (
  <TodoRow key={todo.id} todo={todo} />
))}
```

**See in `/sublime`:** [SKILL.md#rendering-and-performance](SKILL.md#rendering-and-performance).

---

### `key-is-random`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `key={Math.random()}` or `key={crypto.randomUUID()}` inside `.map()`.

**Forbidden example.**
```tsx
{items.map(item => (
  <Card key={crypto.randomUUID()} item={item} />
))}
```

**Why it hurts.** Every render produces new keys, so every item unmounts and remounts every render — state loss, focus loss, layout thrash. Often added to silence the "unique key" warning.

**Rewrite.** Use a stable identity on the item. If the item has no natural ID, assign one at creation, not during render:
```tsx
const newItem = { id: crypto.randomUUID(), ...payload };
setItems(prev => [...prev, newItem]);
// then: items.map(item => <Card key={item.id} ... />)
```

**See in `/sublime`:** [references/rendering-and-performance.md](references/rendering-and-performance.md).

---

### `inline-object-function-props`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `<MemoizedChild style={{color: "red"}} onClick={() => x()} />` — new object / function identity every render defeats `React.memo`.

**Forbidden example.**
```tsx
const MemoRow = memo(Row);
{items.map(item => (
  <MemoRow
    key={item.id}
    item={item}
    style={{ padding: 8 }}
    onClick={() => handleClick(item.id)}
  />
))}
```

**Why it hurts.** `React.memo` compares props by reference. Inline object and function literals get new references every parent render, so the memo always re-renders. The wrapper is cosmetic. `react-perf/jsx-no-new-object-as-prop`, `react-perf/jsx-no-new-function-as-prop`.

**Rewrite.**
```tsx
const rowStyle = { padding: 8 } as const;
const onRowClick = useCallback((id: string) => handleClick(id), [handleClick]);
{items.map(item => (
  <MemoRow key={item.id} item={item} style={rowStyle} onClick={onRowClick} />
))}
// Better: on React 19 + Compiler, no memoization needed; use stable handlers naturally.
```

**See in `/sublime`:** [references/rendering-and-performance.md](references/rendering-and-performance.md).

---

### `memo-useless`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `React.memo(Component)` where every parent render still changes props (inline objects, inline callbacks, spread from a changing object).

**Forbidden example.**
```tsx
const Row = memo(function Row({ item, onClick }: RowProps) { ... });
// parent:
{items.map(item => <Row item={item} onClick={() => go(item.id)} />)}
```

**Why it hurts.** Makarevich: *"If you're not using useMemo and useCallbacks the correct way … they become useless."* The memo adds a shallow-compare cost per render and never skips.

**Rewrite.** Remove the `memo` wrapper unless you have measured a bottleneck AND the caller passes stable references. React Compiler is the correct answer for everything else.

**See in `/sublime`:** [SKILL.md#rendering-and-performance](SKILL.md#rendering-and-performance).

---

### `missing-keys-on-lists`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `.map()` producing elements with no `key`.

**Forbidden example.**
```tsx
{items.map(item => <li>{item.name}</li>)}
```

**Why it hurts.** React logs a dev warning and falls back to index matching — exactly the `key-is-index` failure mode. `react/jsx-key`.

**Rewrite.**
```tsx
{items.map(item => <li key={item.id}>{item.name}</li>)}
```

**See in `/sublime`:** [references/rendering-and-performance.md](references/rendering-and-performance.md).

---

### `useeffect-data-fetching`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `useEffect(() => { fetch(url).then(r => r.json()).then(setData); }, [url])` with no cancellation, cache, dedup, or race protection.

**Forbidden example.**
```tsx
useEffect(() => {
  fetch(`/api/user/${id}`)
    .then(r => r.json())
    .then(setUser);
}, [id]);
```

**Why it hurts.** Probably the single most-produced React slop by LLMs — Vercel wrote their react-best-practices Agent Skill specifically to stop this. Race conditions on fast `id` changes; StrictMode double-fires and causes duplicate requests; no cache, no dedup, no retry; *"a spinning spinner on top of a spinning spinner."*

**Rewrite.**
```tsx
// RSC-capable: fetch in a Server Component.
// Client: TanStack Query or SWR.
const { data: user } = useQuery({
  queryKey: ["user", id],
  queryFn: () => fetch(`/api/user/${id}`).then(r => r.json()),
});
```

**See in `/sublime`:** [SKILL.md#hooks-and-effects](SKILL.md#hooks-and-effects).

---

### `useeffect-syncs-props-to-state`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `useEffect(() => setLocal(propValue), [propValue])` copying a parent prop into local state.

**Forbidden example.**
```tsx
function EditForm({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  useEffect(() => { setName(user.name); }, [user.name]);
  return <input value={name} onChange={e => setName(e.target.value)} />;
}
```

**Why it hurts.** [Legacy React blog: *"You Probably Don't Need Derived State."*](https://legacy.reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html) Two sources of truth; stale intermediate render; the "reset on user change" intent is the wrong tool. `YMNNAE/no-adjust-state-on-prop-change`.

**Rewrite.**
```tsx
// If you want the local edit state to reset when user changes: remount via key.
<EditForm key={user.id} user={user} />
// Inside EditForm: const [name, setName] = useState(user.name); — no effect.
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `useeffect-chains`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** Effect A sets state X, effect B depends on X and sets Y, effect C on Y — cascading commit phases.

**Forbidden example.**
```tsx
useEffect(() => setFiltered(items.filter(pred)), [items]);
useEffect(() => setSorted(filtered.sort(cmp)), [filtered]);
useEffect(() => setPage(sorted.slice(0, 10)), [sorted]);
```

**Why it hurts.** Abramov: *"Sometimes you might feel tempted to chain Effects that each adjust a piece of state based on other state. … Resolve it all in a single pass during rendering."* Four renders to reach steady state; intermediate states flicker. `YMNNAE/no-chain-state-updates`.

**Rewrite.**
```tsx
const page = useMemo(() => items.filter(pred).sort(cmp).slice(0, 10), [items]);
// Or just: const page = items.filter(pred).sort(cmp).slice(0, 10);
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `missing-cleanup`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `useEffect` subscribing to a listener / socket / interval / timeout without returning cleanup.

**Forbidden example.**
```tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  // no return
}, []);
```

**Why it hurts.** Memory leaks accumulate across mounts; StrictMode double-invocation surfaces the bug in dev. Every subscription needs a matching unsubscribe.

**Rewrite.**
```tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, []);
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `race-without-abort`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Async fetch in an effect with no `AbortController` or ignore-flag — rapid dep changes produce out-of-order `setData` calls.

**Forbidden example.**
```tsx
useEffect(() => {
  fetch(`/search?q=${query}`).then(r => r.json()).then(setResults);
}, [query]);
```

**Why it hurts.** Fast typing fires request A (slow) and request B (fast); B resolves first, then A overwrites it with stale results. Classic race. The query libraries solve this; hand-rolled fetches don't.

**Rewrite.**
```tsx
useEffect(() => {
  const ac = new AbortController();
  fetch(`/search?q=${query}`, { signal: ac.signal })
    .then(r => r.json()).then(setResults)
    .catch(e => { if (e.name !== "AbortError") throw e; });
  return () => ac.abort();
}, [query]);
// Better: TanStack Query handles this natively with query keys.
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `infinite-loop-object-deps`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** Object or array literal in a dependency array — new reference every render triggers the effect, which triggers a render, which ...

**Forbidden example.**
```tsx
useEffect(() => {
  fetch("/api", { headers: { Authorization: token } });
}, [{ token }]); // new object every render → infinite loop
```

**Why it hurts.** `react-hooks/exhaustive-deps` will flag if configured, but LLMs frequently pass object literals to silence the warning, producing the infinite loop the warning was protecting against.

**Rewrite.**
```tsx
useEffect(() => {
  fetch("/api", { headers: { Authorization: token } });
}, [token]); // primitive dep
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `componentdidmount-mimicry`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `useEffect(fn, [])` treated as "run once on mount" while the body references props/state that do change.

**Forbidden example.**
```tsx
function Page({ userId }: { userId: string }) {
  useEffect(() => {
    fetch(`/api/user/${userId}`).then(r => r.json()).then(setUser);
  }, []); // userId ignored
}
```

**Why it hurts.** Abramov: *"In general, your components should be resilient to being remounted."* StrictMode double-fires effects in dev — any `[]` effect referencing props surfaces as a bug. LLMs ship it anyway.

**Rewrite.** Either include the deps (`[userId]`) or move the fetch out (query library / RSC).

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `use-client-everywhere`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `"use client"` reflexively at the top of every file in a Next.js App Router project.

**Forbidden example.**
```tsx
// app/layout.tsx
"use client";
export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>;
}
```

**Why it hurts.** Vercel discussion [#81291](https://github.com/vercel/next.js/discussions/81291) notes LLMs *"often provide code that is outdated or suboptimal … using the Pages Router instead of App Router, misusing useEffect for data fetching in Server Components."* `create-next-app` now ships `AGENTS.md` for exactly this. Every client boundary bloats the bundle and breaks server-only imports.

**Rewrite.** Keep `"use client"` as close to the interactive leaf as possible. Layouts, page shells, and data-reading components stay server.

**See in `/sublime`:** [SKILL.md#nextjs-app-router-and-rsc](SKILL.md#nextjs-app-router-and-rsc).

---

### `server-in-client-contamination`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** A Client Component imports a server-only module (DB client, secret-reading helper, `server-only`-tagged package).

**Forbidden example.**
```tsx
"use client";
import { db } from "@/lib/db"; // Prisma client — server only
export function UserList() { /* ... */ }
```

**Why it hurts.** Next.js will sometimes error and sometimes silently ship server code or a shim. The intent — use server data in a client component — is wrong; you want to fetch in a Server Component and pass data down.

**Rewrite.**
```tsx
// Server Component
import { db } from "@/lib/db";
export default async function Page() {
  const users = await db.user.findMany();
  return <UserList users={users} />;
}
// UserList stays client-only and receives serializable props.
```

**See in `/sublime`:** [references/nextjs-and-rsc.md](references/nextjs-and-rsc.md).

---

### `function-as-prop-rsc-error`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** Passing a non-`"use server"` function as a prop from a Server Component to a Client Component.

**Forbidden example.**
```tsx
// Server Component
export default function Page() {
  return <ClientButton onClick={() => console.log("hi")} />;
}
```

**Why it hurts.** Next.js error: *"Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with 'use server'."* LLMs emit this reflexively because the mental model of "pass a callback" is identical to non-RSC React.

**Rewrite.**
```tsx
// app/actions.ts
"use server";
export async function sayHi() { console.log("hi"); }

// Server Component
import { sayHi } from "./actions";
<ClientButton onClick={sayHi} />;
```

**See in `/sublime`:** [references/nextjs-and-rsc.md](references/nextjs-and-rsc.md).

---

### `date-map-serialization-error`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** Passing `Date`, `Map`, `Set`, or a class instance from a Server Component to a Client Component.

**Forbidden example.**
```tsx
<ClientTimeline createdAt={new Date()} tags={new Set(["a", "b"])} />
```

**Why it hurts.** The RSC Flight wire format serializes a JSON-like subset. `Date` survives in some toolchains and not others; `Map`, `Set`, and class instances do not. The prop arrives mangled or the build errors.

**Rewrite.**
```tsx
<ClientTimeline
  createdAtIso={date.toISOString()}
  tags={["a", "b"]}
/>
// inside ClientTimeline: new Date(createdAtIso), new Set(tags)
```

**See in `/sublime`:** [references/nextjs-and-rsc.md](references/nextjs-and-rsc.md).

---

### `missing-loading-error-tsx`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Next.js App Router route segments without `loading.tsx` or `error.tsx`.

**Forbidden example.**
```
app/dashboard/
  page.tsx        # async fetch; no loading.tsx, no error.tsx
```

**Why it hurts.** UX regresses silently — slow page loads show nothing, errors crash the whole segment. The App Router hands you these primitives for free.

**Rewrite.**
```
app/dashboard/
  page.tsx
  loading.tsx
  error.tsx       # "use client"; export default function Error({ error, reset }) { ... }
```

**See in `/sublime`:** [references/nextjs-and-rsc.md](references/nextjs-and-rsc.md).

---

### `controlled-uncontrolled-confusion`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `<input value={x} />` without `onChange`, triggering *"changing an uncontrolled input to be controlled"*.

**Forbidden example.**
```tsx
<input value={user.name} /> // read-only controlled; React warns
```

**Why it hurts.** React flips behaviour silently when `value` becomes `undefined`, then back when it returns. Warnings spam dev; users see inputs that appear to ignore keystrokes.

**Rewrite.**
```tsx
<input value={user.name} onChange={e => setUser({ ...user, name: e.target.value })} />
// or: <input defaultValue={user.name} />  (uncontrolled)
// or: <input value={user.name} readOnly />  (explicit)
```

**See in `/sublime`:** [references/forms.md](references/forms.md).

---

### `onchange-per-field-boilerplate`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Ten fields, ten `useState`s, ten `onChange` handlers — copy-paste scaling.

**Forbidden example.**
```tsx
const [first, setFirst] = useState("");
const [last, setLast] = useState("");
const [email, setEmail] = useState("");
const [phone, setPhone] = useState("");
// ... six more ...
<input value={first} onChange={e => setFirst(e.target.value)} />
<input value={last}  onChange={e => setLast(e.target.value)} />
// ...
```

**Why it hurts.** O(n) state, O(n) handlers, O(n) chances for drift. React 19's `useActionState` + uncontrolled form handles it in one hook.

**Rewrite.**
```tsx
// react-hook-form
const { register, handleSubmit } = useForm<FormValues>();
<input {...register("first")} />
<input {...register("last")} />
// or native form + FormData
<form action={async (data) => save(Object.fromEntries(data))}>
  <input name="first" /> <input name="last" /> ...
</form>
```

**See in `/sublime`:** [SKILL.md#forms](SKILL.md#forms).

---

### `missing-form-action`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Next.js 14+/15 App Router project still wiring forms via `onSubmit` + `fetch` instead of `action={serverAction}`.

**Forbidden example.**
```tsx
"use client";
<form onSubmit={async (e) => {
  e.preventDefault();
  const res = await fetch("/api/signup", { method: "POST", body: JSON.stringify(data) });
}}>
```

**Why it hurts.** Server Actions exist. `<form action>` works without `"use client"`, submits without JS, and composes with `useFormStatus` + `useActionState`. The `onSubmit` + `fetch` pattern is Pages-Router muscle memory.

**Rewrite.**
```tsx
// app/actions.ts
"use server";
export async function signup(formData: FormData) { /* ... */ }

// Server Component
import { signup } from "./actions";
<form action={signup}>
  <input name="email" /> <button type="submit">Sign up</button>
</form>
```

**See in `/sublime`:** [references/forms.md](references/forms.md).

---

### `fc-zombie`

**Tags:** `AI-slop` · `Lint` · `Lang:TS`

**Pattern.** `React.FC<Props>` annotations (with the historical implicit-`children` baggage) in React 18+/19 code.

**Forbidden example.**
```tsx
const Card: React.FC<{ title: string }> = ({ title }) => <h1>{title}</h1>;
```

**Why it hurts.** Matt Pocock (Total TypeScript) notes `FC` is "now fine" as of TS 5.1 but still recommends annotating props directly — it is simpler, clearer, and does not confuse readers about implicit `children`. LLMs trained pre-2022 emit `FC` as a reflex.

**Rewrite.**
```tsx
function Card({ title }: { title: string }) {
  return <h1>{title}</h1>;
}
```

**See in `/sublime`:** [../typescript/SKILL.md](../typescript/SKILL.md).

---

### `as-react-reactnode-cast`

**Tags:** `AI-slop` · `Lint` · `Lang:TS`

**Pattern.** `as React.ReactNode` / `as any` sprinkled to silence type errors that signal a real shape mismatch.

**Forbidden example.**
```tsx
return <div>{value as React.ReactNode}</div>;
```

**Why it hurts.** Papers over the actual type gap. The cast lies to the compiler and turns into a runtime crash the first time `value` is a `Symbol` or `{}`. `@typescript-eslint/no-explicit-any`, `@typescript-eslint/consistent-type-assertions`.

**Rewrite.** Narrow the type. If `value` is `unknown`, discriminate (`typeof value === "string"`). If it is a union including non-renderable branches, handle each branch explicitly.

**See in `/sublime`:** [../typescript/SKILL.md](../typescript/SKILL.md).

---

### `redundant-generic-hooks`

**Tags:** `AI-slop` · `Review` · `Lang:TS`

**Pattern.** `useState<string>("")`, `useRef<number>(0)` — explicit type parameter where TypeScript would infer the same.

**Forbidden example.**
```tsx
const [name, setName] = useState<string>("");
const count = useRef<number>(0);
```

**Why it hurts.** Noise. The initializer already determines the type. Save the generic for cases that genuinely need it: `useState<User | null>(null)`, `useRef<HTMLDivElement>(null)`.

**Rewrite.**
```tsx
const [name, setName] = useState("");
const count = useRef(0);
```

**See in `/sublime`:** [references/hooks.md](references/hooks.md).

---

### `tailwind-class-vomit`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** `className` strings of 200+ characters with 15+ utilities repeated verbatim across multiple files.

**Forbidden example.**
```tsx
<button className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
```

**Why it hurts.** dev.to/avery_code on Copilot: *"it inlines everything. Every time. The same combination of fifteen utilities scattered across four different places."* Duplication drifts; hover/focus/disabled states diverge across copies.

**Rewrite.** Extract to a `Button` component with `cva` or `tailwind-variants`:
```tsx
const button = cva("inline-flex items-center ... rounded-md", {
  variants: { variant: { primary: "bg-blue-600 text-white hover:bg-blue-700" } },
});
<button className={button({ variant: "primary" })}>Save</button>
```

**See in `/sublime`:** [SKILL.md#styling](SKILL.md#styling).

---

### `arbitrary-values-everywhere`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Pervasive `w-[427px]`, `text-[13.5px]`, `bg-[#3b82f6]` — and worse, dynamic arbitrary values Tailwind cannot see.

**Forbidden example.**
```tsx
<div className={`w-[${width}px] bg-[${color}]`} />
```

**Why it hurts.** Tailwind's JIT compiler only sees static class names. Dynamic interpolation silently produces no styles. Pervasive hard-coded arbitrary values bypass the design scale (spacing, typography, color).

**Rewrite.** Extend the theme in `tailwind.config.js` / CSS `@theme`. Map dynamic values to a static whitelist:
```tsx
const widthClass = { sm: "w-32", md: "w-64", lg: "w-96" }[size];
<div className={widthClass} />
```

**See in `/sublime`:** [references/styling.md](references/styling.md).

---

### `missing-cn-clsx-helper`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** String-interpolation for conditional classes, producing duplicate or conflicting utilities.

**Forbidden example.**
```tsx
<div className={`p-4 ${isActive ? "bg-blue-500 p-6" : "bg-gray-200"} ${className}`} />
// p-4 and p-6 both applied — last-wins at the CSS level, but both are emitted
```

**Why it hurts.** Order-dependent, duplicates accumulate, external `className` can collide with internal classes. `cn()` / `clsx` + `tailwind-merge` de-dupes and resolves conflicts.

**Rewrite.**
```tsx
import { cn } from "@/lib/utils"; // wraps clsx + tailwind-merge
<div className={cn("p-4", isActive && "bg-blue-500 p-6", !isActive && "bg-gray-200", className)} />
```

**See in `/sublime`:** [SKILL.md#styling](SKILL.md#styling).

---

### `getbytestid-over-getbyrole`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** Default reach for `getByTestId` when `getByRole` / `getByLabelText` would work.

**Forbidden example.**
```tsx
const btn = screen.getByTestId("submit-button");
await userEvent.click(btn);
```

**Why it hurts.** Kent C. Dodds's [RTL priority](https://testing-library.com/docs/queries/about/#priority): `getByRole > getByLabelText > getByPlaceholderText > getByText > getByDisplayValue > getByAltText > getByTitle > getByTestId` (last resort). `testid` queries drift from how users and screen readers see the app.

**Rewrite.**
```tsx
const btn = screen.getByRole("button", { name: /submit/i });
await userEvent.click(btn);
```

**See in `/sublime`:** [SKILL.md#testing-and-accessibility](SKILL.md#testing-and-accessibility).

---

### `fireevent-over-userevent`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `fireEvent.change` / `fireEvent.click` when the test needs realistic interaction (focus + keydown + input + change).

**Forbidden example.**
```tsx
fireEvent.change(input, { target: { value: "hello" } });
```

**Why it hurts.** Kent C. Dodds: *`userEvent` is the default.* `fireEvent` skips focus, blur, IME, and keyboard events; tests pass on broken components that never fire the correct event sequence in production. `testing-library/prefer-user-event`.

**Rewrite.**
```tsx
await userEvent.type(input, "hello");
```

**See in `/sublime`:** [references/testing-and-a11y.md](references/testing-and-a11y.md).

---

### `snapshot-bloat`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Massive, unreadable snapshots of entire component trees checked in as the primary assertion.

**Forbidden example.**
```tsx
expect(container).toMatchSnapshot(); // 1,400-line snapshot file
```

**Why it hurts.** No reviewer reads 1,400 lines of snapshot diff. They press "update" and ship regressions. Snapshots should be small and targeted (single element, specific text).

**Rewrite.** Assert intent explicitly:
```tsx
expect(screen.getByRole("heading", { name: /welcome/i })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
```

**See in `/sublime`:** [references/testing-and-a11y.md](references/testing-and-a11y.md).

---

### `act-warning-ignored`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** *"Warning: An update to X inside a test was not wrapped in act(...)"* suppressed or ignored rather than fixed with `waitFor` / `findBy`.

**Forbidden example.**
```tsx
// console.error overridden to silence act warnings
jest.spyOn(console, "error").mockImplementation(() => {});
```

**Why it hurts.** The warning is telling you the test is observing an intermediate render state, not the final one. Silencing it hides real async ordering bugs.

**Rewrite.**
```tsx
await screen.findByText("Loaded"); // waits for the state update
// or:
await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/done/i));
```

**See in `/sublime`:** [references/testing-and-a11y.md](references/testing-and-a11y.md).

---

### `findby-vs-getby-race`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `getBy*` for elements that appear asynchronously — flaky tests.

**Forbidden example.**
```tsx
render(<Profile id="1" />);
expect(screen.getByText(/jane/i)).toBeInTheDocument(); // fetch hasn't resolved
```

**Why it hurts.** `getBy*` throws immediately if not found. Async data is not there on the first tick. Tests pass locally, fail in CI, or pass unreliably. `testing-library/prefer-find-by`.

**Rewrite.**
```tsx
render(<Profile id="1" />);
expect(await screen.findByText(/jane/i)).toBeInTheDocument();
```

**See in `/sublime`:** [references/testing-and-a11y.md](references/testing-and-a11y.md).

---

### `div-as-button`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `<div onClick={...}>` without `role="button"`, `tabIndex={0}`, and `onKeyDown` for Enter/Space.

**Forbidden example.**
```tsx
<div onClick={handleClick} className="...styled-to-look-like-a-button">Save</div>
```

**Why it hurts.** Not focusable, no keyboard activation, no screen-reader announcement. `jsx-a11y/no-static-element-interactions`, `jsx-a11y/click-events-have-key-events`.

**Rewrite.**
```tsx
<button type="button" onClick={handleClick} className="...">Save</button>
```

**See in `/sublime`:** [SKILL.md#testing-and-accessibility](SKILL.md#testing-and-accessibility).

---

### `missing-aria-label-icon-button`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** Icon-only button with no `aria-label`.

**Forbidden example.**
```tsx
<button onClick={close}><XIcon /></button>
```

**Why it hurts.** Screen readers announce "button" with no name. Keyboard users have no idea what it does. `jsx-a11y/control-has-associated-label`.

**Rewrite.**
```tsx
<button onClick={close} aria-label="Close"><XIcon aria-hidden /></button>
```

**See in `/sublime`:** [references/testing-and-a11y.md](references/testing-and-a11y.md).

---

### `img-without-alt`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `<img src={...} />` with no `alt`.

**Forbidden example.**
```tsx
<img src="/avatar.png" />
```

**Why it hurts.** Screen readers either read the filename or skip it. `alt` is required. `alt=""` is valid for purely decorative images. `jsx-a11y/alt-text`.

**Rewrite.**
```tsx
<img src="/avatar.png" alt={`${user.name}'s avatar`} />
// decorative:
<img src="/divider.png" alt="" />
```

**See in `/sublime`:** [references/testing-and-a11y.md](references/testing-and-a11y.md).

---

### `form-without-labels`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `<input type="text" placeholder="Name" />` with no `<label>` / `aria-label` / `aria-labelledby`.

**Forbidden example.**
```tsx
<input type="email" placeholder="Email" />
```

**Why it hurts.** Placeholder is not a label — it disappears on focus, fails contrast requirements, and is not announced by some screen readers. `jsx-a11y/label-has-associated-control`.

**Rewrite.**
```tsx
<label htmlFor="email">Email</label>
<input id="email" type="email" placeholder="name@example.com" />
// or:
<label>Email<input type="email" /></label>
```

**See in `/sublime`:** [SKILL.md#forms](SKILL.md#forms).

---

### `next-public-leak`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** API keys, secrets, or private URLs prefixed `NEXT_PUBLIC_` and thereby shipped to the browser bundle.

**Forbidden example.**
```
# .env
NEXT_PUBLIC_STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_DATABASE_URL=postgres://...
NEXT_PUBLIC_OPENAI_API_KEY=sk-...
```

**Why it hurts.** `NEXT_PUBLIC_` inlines the value into every page. Cyble found 5,000+ GitHub repos and 3,000+ live sites leaking ChatGPT API keys this way. Google has charged developers five-figure bills after a leaked browser-side Maps key enabled Generative Language API.

**Rewrite.**
```
# .env.local
STRIPE_SECRET_KEY=sk_live_...
DATABASE_URL=postgres://...
OPENAI_API_KEY=sk-...
```
Call from a Server Component, Server Action, or Route Handler. Return only the derived result.

**See in `/sublime`:** [SKILL.md#nextjs-app-router-and-rsc](SKILL.md#nextjs-app-router-and-rsc).

---

### `hydration-mismatch`

**Tags:** `AI-slop` · `Lint` · `Lang:TSX`

**Pattern.** `Math.random()`, `Date.now()`, `new Date().toLocaleTimeString()`, `navigator.userAgent`, or `typeof window !== "undefined"` rendered directly in JSX.

**Forbidden example.**
```tsx
<p>Generated at {new Date().toLocaleTimeString()}</p>
<p>ID: {Math.random()}</p>
{typeof window !== "undefined" && <ClientOnlyThing />}
```

**Why it hurts.** Server render and client hydration produce different HTML; React throws a hydration-mismatch error and rehydrates the whole tree from scratch, visibly flashing.

**Rewrite.**
```tsx
// client-only values: render inside useEffect after mount
const [now, setNow] = useState<string>("");
useEffect(() => setNow(new Date().toLocaleTimeString()), []);
return <p>Generated at {now}</p>;

// or dynamic import with ssr: false
const ClientOnlyThing = dynamic(() => import("./ClientOnlyThing"), { ssr: false });
```

**See in `/sublime`:** [references/nextjs-and-rsc.md](references/nextjs-and-rsc.md).

---

### `double-fetch`

**Tags:** `AI-slop` · `Review` · `Lang:TSX`

**Pattern.** Data fetched server-side in an RSC, then refetched client-side on mount.

**Forbidden example.**
```tsx
// Server Component
export default async function Page() {
  const user = await db.user.findUnique({ where: { id } });
  return <ClientProfile user={user} />;
}

// ClientProfile.tsx
"use client";
export function ClientProfile({ user }) {
  const { data } = useQuery({ queryKey: ["user"], queryFn: () => fetch(`/api/user/${user.id}`).then(r => r.json()) });
  // refetches immediately on mount
}
```

**Why it hurts.** Two round trips, waterfall on first paint, wasted server work. The LLM wrote each side in isolation without looking at the other.

**Rewrite.** Pick one. Either fetch in the RSC and pass the data down without refetching; or hydrate TanStack Query with the server-fetched data using `dehydrate` / `HydrationBoundary`.

**See in `/sublime`:** [references/nextjs-and-rsc.md](references/nextjs-and-rsc.md).

---

**Cross-reference targets:** [`../../sublime/SKILL.md`](../../sublime/SKILL.md) for the core skill and universal BANs. [`../../anti-patterns/`](../../anti-patterns/) for universal catalog entries shared across languages. [`../typescript/SKILL.md`](../typescript/SKILL.md) for the companion type-level discipline. In-extension: [`SKILL.md`](SKILL.md) and the eight `references/` files.
