# State management

State lives in one of four places — URL, server, local component, or a client store — and most LLM slop miscategorizes: filters in `useState` instead of the URL, fetched data in Redux instead of TanStack Query, app-wide state in Context instead of a proper store, and a Context-plus-Provider ceremony around a single value.

The architectural mistake compounds. An LLM that puts the current filter in `useState` will then lift it up so siblings can read it, then worry about prop drilling, then wrap it in a Context, then add a provider, then extract a custom hook, then — because the data also needs to survive a refresh — reach for `localStorage`, and six files later you have reinvented a URL parameter. Pick the right location first and most of the structure falls away.

## The four locations

- **URL.** Anything shareable, bookmarkable, or refresh-survivable — filters, tabs, pagination, sort order, open dialogs, selected detail pane, search terms. If the user would reasonably expect to copy the address bar and send it to a colleague, the state belongs here.
- **Server.** Fetched data, mutation state, optimistic updates, cache invalidation. Owned by a query library (TanStack Query, SWR, RTK Query) or RSC — never `useState` + `useEffect`.
- **Local component.** Ephemeral UI state that has no meaning outside the component — a dropdown's open/closed, a modal's current step, a hover state, input draft values that a form library does not already own. `useState` / `useReducer`.
- **Global client.** Cross-cutting client-only state that many unrelated components read — theme, current user identity, feature flags fetched once, toast queue. Zustand / Jotai / Redux / Valtio. Small surface area; reach for it last, not first.

Most applications need all four and most LLM-generated code uses one or two.

## URL is the original state manager

Ryan Florence's framing: the URL is the oldest, most interoperable state manager on the platform. It is sharable, bookmarkable, restorable on refresh, compressible by the browser's history, and directly addressable. Every hour spent wiring filter state through Context is an hour spent reimplementing a worse query string.

```tsx
// Slop — filters in useState. Refresh loses them; cannot share the view.
function ProductList() {
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<"price" | "name">("price");
  const { data } = useQuery({ queryKey: ["products", category, sort], queryFn: fetchProducts });
  return (/* UI that reads category/sort */);
}

// Fix — URL owns the filter. Refresh, share, back-button all work.
function ProductList() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "all";
  const sort = (params.get("sort") as "price" | "name") ?? "price";
  const { data } = useQuery({ queryKey: ["products", category, sort], queryFn: fetchProducts });
  return (/* UI reads params, setParams on change */);
}
```

Use `useSearchParams` (React Router, Next.js), `nuqs` for typed parameters, or `useQueryState`. The heuristic: if a full page refresh should return the user to the same view, the state is URL-shaped.

## Server state is not client state

TanStack Query's original thesis and the reason it exists. Server state has properties client state does not — it can become stale, it belongs to someone else, it needs revalidation, it needs deduplication across components, it needs retry on failure, it needs optimistic updates that can roll back. A Redux slice with `loading`, `error`, `data`, and a thunk is a hand-rolled, worse TanStack Query that forgets half the cases.

```tsx
// Slop — manual cache in a client store.
const useUserStore = create<{ user: User | null; loading: boolean; error: Error | null; fetch: (id: string) => void }>((set) => ({
  user: null, loading: false, error: null,
  fetch: async (id) => {
    set({ loading: true });
    try { set({ user: await api.getUser(id), loading: false }); }
    catch (e) { set({ error: e as Error, loading: false }); }
  },
}));

// Fix — a query library owns server state.
function useUser(id: string) {
  return useQuery({
    queryKey: ["user", id],
    queryFn: () => api.getUser(id),
    staleTime: 60_000,
  });
}
```

The slop version has no cache key, no dedup across components that request the same user, no background revalidation, no automatic cancellation on unmount, and no shared error handling. The fix gets all of that from the query library's default behavior.

In Next.js App Router, prefer RSC: `async function Page() { const user = await getUser(id); return <Profile user={user} />; }`. The component *is* the fetch; there is no client-side loading state to manage. See Vercel's [react-best-practices](https://vercel.com/blog/introducing-react-best-practices) skill for the prescriptive version.

## Context is not a state-management tool

Mark Erikson's [canonical post](https://blog.isquaredsoftware.com/2021/01/context-redux-differences/): Context is a dependency-injection mechanism that re-renders every consumer whenever the value changes. That is fine for values that change rarely — theme, current user, locale. It is disastrous for values that change frequently or for a "global app state" object that several unrelated concerns read different parts of.

Two failure modes:

- **Re-render storm.** A Context holding `{ user, cart, theme, notifications, flags }` re-renders every consumer of every field whenever any field changes. Typing into the cart subtree re-renders the theme consumer.
- **One-value provider.** A Context, Provider, custom hook, and type — ceremonial wiring — for a value consumed once or twice. Delete the Context and pass the prop. Two is not "prop drilling."

```tsx
// Slop — Context for a value used in two places.
const SidebarOpenContext = createContext<{ open: boolean; setOpen: (v: boolean) => void } | null>(null);
function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <SidebarOpenContext.Provider value={{ open, setOpen }}>{children}</SidebarOpenContext.Provider>;
}
function useSidebar() {
  const ctx = useContext(SidebarOpenContext);
  if (!ctx) throw new Error("SidebarProvider missing");
  return ctx;
}

// Fix — pass the prop, or colocate state with the two consumers' common parent.
function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TopBar onToggle={() => setOpen(o => !o)} />
      <Sidebar open={open} />
    </>
  );
}
```

Reach for a real store (Zustand, Jotai, Redux) when you have a large cross-cutting surface area with selectors. Reach for Context when you have a stable DI value. Do not reach for Context in between.

## Provider hell

Five-plus nested `<XProvider>` components at the root of the tree — `<ThemeProvider><QueryProvider><AuthProvider><FeatureFlagsProvider><ToastProvider><ModalProvider><I18nProvider>{children}</I18nProvider>...</ThemeProvider>`. Each adds a subscription boundary, a re-render scope, and a mount-order dependency the next developer must reason about. Bolt, Lovable, and full-stack scaffold generators emit this by default.

Consolidate. A single `<AppProviders>` is at worst the same thing wrapped once, but it is a real signal that several of those providers are server-only (i18n resources, flags), stable across the app lifetime (theme), or should be a store with direct subscriptions (auth identity).

```tsx
// Slop — nested ceremony, half these are static values.
<ThemeProvider value={theme}>
  <FeatureFlagsProvider value={flags}>
    <I18nProvider value={messages}>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </I18nProvider>
  </FeatureFlagsProvider>
</ThemeProvider>

// Fix — server-static values read from a module; toast + auth in a store.
// Only the query client and one auth provider survive.
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>
```

## State collocation

Kent C. Dodds's rule: [put state as close to where it is used as possible](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster). State lifted to the root re-renders the root on every change. State colocated in the component that owns it re-renders only that subtree.

The natural LLM failure mode is the opposite: a `useState` pushed up four levels "in case a sibling needs it later." Push it back down until it sits with the component that reads and writes it. If a real sibling starts reading it, then lift — once, not preemptively.

## Prop-drilling vs composition

Makarevich's [component composition posts](https://www.developerway.com/): two tools defuse most prop-drilling — *passing JSX through as children* and *slot props*. A component does not need the data if it only hands it to its children; pass the pre-constructed children through instead.

```tsx
// Slop — theme drilled through layers that don't use it.
<Page theme={theme}>
  <Header theme={theme}>
    <Logo theme={theme} />
    <UserMenu theme={theme} />
  </Header>
</Page>

// Fix — composition. Intermediate layers don't see theme.
<Page>
  <Header>
    <Logo />
    <UserMenu />
  </Header>
</Page>
// Logo and UserMenu read theme from a stable Context at the leaves.
```

For values that genuinely need to traverse many levels and change often, a store with selectors (Zustand, Jotai) beats both drilling and Context-re-render-storm.

## Redux / Zustand for a toggle

Global stores exist to coordinate cross-cutting client state. Using one for a single component's `isModalOpen` is the enterprise-scaffold slop signature — slice, action, reducer, selector, dispatch, all to flip a boolean that `useState` would handle in one line. Mark Erikson's ["When (and when not) to reach for Redux"](https://blog.isquaredsoftware.com/) is the canonical critique.

Rule: if exactly one component reads and writes the state, it is `useState`. If two or three components in the same subtree share it, lift to their common parent. If many unrelated components across the tree coordinate on it, a store earns its keep.

## State-shape table

| Kind of state | Where it lives | Library / primitive | Slop signature |
|---|---|---|---|
| Filters, tabs, pagination, search | URL | `useSearchParams`, `nuqs`, router | `useState` lost on refresh; cannot share link |
| Fetched server data | Server / query cache | TanStack Query, SWR, RTK Query, RSC | `useEffect` + `fetch` + `setState`; Redux slice with `loading/error/data` |
| Ephemeral UI (open, hover, draft) | Local component | `useState` / `useReducer` | Lifted to Context or a store |
| Auth / theme / flags (stable, cross-cutting) | Context or store | `useContext` for DI; Zustand/Jotai for selectable slices | Re-rendering entire tree on frequent changes |
| One form's fields | Local component or RHF | `useState` + form library | State in Context, re-renders whole tree on keystroke |
| Form submission result | Server / query mutation | `useMutation`, `useActionState` | Redux action + thunk |

## Common AI failure modes

- **`redux-for-toggle`** — full Redux slice (or Zustand store) plus actions, reducers, and selectors for a single component's `isModalOpen`. Enterprise-scaffold slop. `useState` in the component that opens the modal.
- **`context-provider-for-one-value`** — Context + Provider + custom hook for a value consumed one or two levels down. Delete the ceremony; pass the prop or colocate. Context re-renders every consumer on change.
- **`provider-hell`** — 5+ nested providers at the root. Consolidate the static ones into a module export, turn the dynamic ones into a store, and keep only what genuinely carries dynamic tree-wide state.
- **`prop-drilling-epic`** — a prop passed through four intermediary components that do not use it. Use composition (`children`, slots) or a store with selectors. Drilling is only a problem when the middle components are handling a value they have no reason to know about.
- **`lifted-too-high`** — state at the app root that only one subtree reads. Push it down until it lives with its consumers. Reverse the LLM's default instinct to hoist preemptively.
- **`url-state-in-local-state`** — filters, tabs, pagination, search, sort, or selected-item id in `useState` instead of URL params. Page refresh loses the view; links are not shareable; the back button does nothing useful.
- **`server-state-in-client-store`** — fetched API data in Redux, Zustand, or Context with manual `loading`/`error`/`stale` flags instead of TanStack Query / SWR / RTK Query. The client store reinvents a worse cache, and every component that reads the data must remember to check the flags.
- **`useselector-new-object`** — `useSelector(s => ({ a: s.a, b: s.b }))`. Returns a fresh object every render, bypasses `===`, re-renders always. Use two `useSelector`s, `shallowEqual`, or `createSelector`.
- **`zustand-jotai-boilerplate`** — Zustand store for a single component's transient state, or Redux-style action/reducer ceremony inside Zustand. Zustand's appeal is the absence of that ceremony; re-importing it is slop.

### Avoid

- `useState` for values that should survive a refresh or be shareable via URL.
  — You are reimplementing query strings with a worse API; URL state composes with the back button and with external links for free.
- `useEffect` + `fetch` + `setState` to manage fetched data in a component.
  — No cache, no dedup, no cancellation, no revalidation; every consumer of the same endpoint refetches independently.
- A global store holding server-fetched data under manual `loading`/`error`/`data` fields.
  — Reinvents a query cache and loses every ergonomic a query library ships with.
- Context for a value that changes frequently and is consumed by many components.
  — Every consumer re-renders on every change; use a store with selectors so consumers subscribe to slices.
- A Context + Provider + custom hook for a value used in one or two places.
  — The ceremony costs more than the prop does; pass the prop or colocate state with the common parent.
- Five or more nested providers at the root.
  — Each is a subscription boundary and a mount-order dependency; consolidate static ones into modules, dynamic ones into a store.
- State lifted to the app root when only one subtree consumes it.
  — The entire tree re-renders on every change; colocate the state with its consumers.
- A prop threaded through four intermediaries that do not read it.
  — Composition (`children`, slots) removes the middle hop entirely; stores with selectors handle the rest.
- Redux slice or Zustand store for a single local toggle.
  — `useState` handles it in one line; the global store is there for genuinely cross-cutting state.
- `useSelector` returning a fresh object literal.
  — Defeats identity-based bail-out; every action re-renders every consumer.

→ Parent skill: [../SKILL.md](../SKILL.md). Core foundation on state-shape discipline: [../../../sublime/references/data-modeling.md](../../../sublime/references/data-modeling.md). Core foundation: [../../../sublime/SKILL.md](../../../sublime/SKILL.md). Sibling hooks reference for the render-vs-effect rules this file depends on: [hooks.md](hooks.md). Sibling forms reference for one-form state scope: [forms.md](forms.md). TypeScript cousin for typing store selectors and query hooks: [../../typescript/SKILL.md](../../typescript/SKILL.md), [../../typescript/references/generics.md](../../typescript/references/generics.md). Shared catalog for the URL-as-state and cache-as-source-of-truth themes: [../../../anti-patterns/security-and-correctness.md](../../../anti-patterns/security-and-correctness.md). In-extension React anti-patterns: [../anti-patterns.md](../anti-patterns.md).
