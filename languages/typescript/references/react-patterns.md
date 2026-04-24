# React patterns

React is a rendering model, not a state-management library, not a data-fetching library, and not a place to hide effects — treat it as the rendering layer and your components stay small and honest.

Your natural failure mode in React is to reach for a hook when you needed a value. `useEffect` becomes the place you stuff anything asynchronous. `useMemo` and `useCallback` become reflexive. `"use client"` gets pasted at the top of every file because one of them errored once. Props proliferate as booleans. Components balloon past 500 lines because the prompt said "build the whole page." None of this is React's fault. It is the accumulated silt of tutorial-trained models generating what past React code looked like in 2019, not what React is in 2026.

## Taxonomy

- **Props discipline.**
- **`useEffect` restraint.**
- **The `useMemo` / `useCallback` trap.**
- **`"use client"` discipline in the App Router.**
- **Data fetching: Server Components first.**
- **Typing components without `React.FC`.**
- **Refs and ref forwarding.**
- **Suspense boundaries.**
- **Tailwind and the classname string.**

---

## Props discipline

A component's props are its public API. The same rules from the core interfaces dimension apply: accept the widest reasonable shape, return the narrowest; name the call site; no flag booleans.

```tsx
// bad — three booleans that flip behavior; call sites are unreadable
<Button primary large disabled />

// bad — seven positional-ish props
<Button variant size icon loading pressed full onClick={...} />

// good — one variant, one size, one state; the props model the design
<Button variant="primary" size="lg" onClick={...}>Save</Button>
```

Three rules carry most of the weight:

1. **Prefer a discriminated `variant` union over a pile of booleans.** `variant: "primary" | "secondary" | "danger"` beats `primary | secondary | danger` any day — illegal combinations are unrepresentable.
2. **`children` over render props over function props.** If the slot is a node, take `children`. Render props are for when the parent must pass data *into* the slot.
3. **No `any` in props.** An `any` prop is an untyped prop; the component's contract is fiction.

```tsx
type ButtonProps = {
  variant: "primary" | "secondary" | "danger"
  size?: "sm" | "md" | "lg"
  children: React.ReactNode
  onClick?: () => void
}

export function Button({ variant, size = "md", children, onClick }: ButtonProps) {
  return <button data-variant={variant} data-size={size} onClick={onClick}>{children}</button>
}
```

**DO** model mutually-exclusive states as a discriminated union in props.
**DO** take `children: React.ReactNode` for slot-shaped composition.
**DO** default optional props in the destructure, not inside the body.

**DO NOT** take boolean flag props that flip rendering behavior.
  — The call site becomes an incantation; two booleans means four states, most of them illegal.
**DO NOT** spread `...rest` into a DOM element without narrowing.
  — You have just promised to accept every HTML attribute; the type no longer documents anything.

---

## `useEffect` restraint

The effect you are about to write is probably a derived value or an event handler in disguise. React's own documentation opens its effects page with "You might not need an effect" for a reason.

Three diagnostics before you reach for `useEffect`:

1. **Is this a value computed from props or state?** Compute it inline. If the computation is expensive and proven hot, `useMemo`. But "proven hot" is a measured claim, not a feeling.
2. **Is this a response to a user event?** Put it in the event handler. `onSubmit`, `onClick`, `onChange` run synchronously; they can call async code; they do not need `useEffect`.
3. **Is this actually synchronizing with an external system?** That is when `useEffect` earns its keep — a subscription, a browser API, a non-React widget.

```tsx
// slop — derived value stuffed into useEffect
const [fullName, setFullName] = useState("")
useEffect(() => { setFullName(`${first} ${last}`) }, [first, last])

// correct — derive during render
const fullName = `${first} ${last}`

// slop — event handler disguised as effect
useEffect(() => { if (submitted) sendAnalytics(form) }, [submitted, form])

// correct — call the function in the handler
function handleSubmit() { sendAnalytics(form); setSubmitted(true) }
```

### The Cloudflare dashboard outage

In November 2024, a `useEffect` dependency array contained an object literal:

```tsx
useEffect(() => { refetch() }, [{ userId }])   // new object every render → infinite loop
```

Object identity changes every render, so the effect re-ran every render, which triggered a state update, which re-rendered, which built a new object. The dashboard went down. This is the most famous public example of the pattern and it is structurally identical to what models produce daily — an object or array in a deps array, a function created inline, a closure over unstable values. When you put a reference type in a deps array, you are asserting it is stable. If it is not, you have written an infinite loop.

**DO** derive values during render when they are functions of props and state.
**DO** run user-driven logic in the event handler, not an effect that watches a flag.
**DO** use the `react-hooks/exhaustive-deps` lint rule — on, and take it seriously.

**DO NOT** put an object or array literal in a `useEffect` dependency array.
  — You have asserted reference stability you cannot deliver; the effect re-runs every render.
**DO NOT** reach for `useEffect` to `setState` based on other state.
  — That is a derivation. Derive it. The redundant state is the bug.
**DO NOT** disable `exhaustive-deps` with a comment unless you leave a named reason.
  — "Intentional — only want initial mount" is acceptable; silent disable is slop.

---

## The `useMemo` / `useCallback` trap

Nikita Makarevich's line: *"you can probably remove 90% of all useMemo and useCallbacks in your app right now."* He is correct. These hooks are not free — each one allocates, each one runs equality checks, each one adds reading tax. They pay for themselves in three cases and three only:

1. A child component is wrapped in `React.memo` and you need referential stability to keep it from re-rendering.
2. A value is a dependency of another hook and its identity must be stable to avoid re-runs.
3. The computation itself is genuinely expensive — measured with the React profiler, not guessed.

Outside those three, `useMemo` and `useCallback` are ceremony that makes the code slower and harder to read. The default should be: do not memoize.

```tsx
// slop — the whole function, and everyone's first PR
const doubled = useMemo(() => count * 2, [count])
const handleClick = useCallback(() => setCount(c => c + 1), [])

// correct — no memoization; the value and function are cheap
const doubled = count * 2
function handleClick() { setCount(c => c + 1) }
```

**DO** profile before memoizing. If you cannot point to the expensive render, the memoization is speculative.
**DO** memoize when a value is a dep of another hook and identity is the reason for re-runs.
**DO NOT** wrap every inline function in `useCallback`.
  — You are paying the allocation for the closure *and* the allocation for the memo cell; the child isn't `memo`'d so nothing changes.
**DO NOT** `useMemo` on primitives or cheap computations.
  — The equality check costs more than the computation.

---

## `"use client"` discipline in the App Router

The Server / Client boundary in the Next.js App Router is load-bearing. Server Components render on the server, stream to the client, carry no bundle weight, and can `await` data directly. Client Components hydrate in the browser, carry bundle weight, and get all the familiar hooks. `"use client"` marks the boundary.

The slop pattern is to paste `"use client"` at the top of every file. This produces a React app that happens to be running inside Next — every component hydrates, every module ships, the streaming and server-rendering advantages are forfeit.

The discipline: `"use client"` marks the *root* of an interactive subtree. Children of a Client Component inherit the client boundary without needing their own directive. You want the boundary as deep in the tree as you can push it.

```tsx
// bad — the whole page is a Client Component, for one interactive button
"use client"
export default function Page() {
  return (
    <>
      <Header />
      <Article />
      <LikeButton />   {/* the only thing that actually needs client JS */}
    </>
  )
}

// good — the page is a Server Component; the boundary is on the button
// app/page.tsx
export default async function Page() {
  const article = await fetchArticle()
  return (
    <>
      <Header />
      <Article article={article} />
      <LikeButton id={article.id} />
    </>
  )
}

// app/like-button.tsx
"use client"
export function LikeButton({ id }: { id: string }) {
  const [liked, setLiked] = useState(false)
  return <button onClick={() => setLiked(l => !l)}>{liked ? "Liked" : "Like"}</button>
}
```

**DO** push `"use client"` as deep in the tree as you can.
**DO** keep data-fetching, layout, and static content in Server Components.

**DO NOT** put `"use client"` at the top of `layout.tsx` or `page.tsx` by default.
  — You are forcing the entire subtree into the client bundle and forfeiting streaming.
**DO NOT** mark a file as `"use client"` to silence an error without understanding the error.
  — The error is telling you the file is trying to do something servers do from a client context, or vice versa.

---

## Data fetching: Server Components first

In the App Router, the right place to fetch data is the Server Component that uses it. `async function Page()` can `await` — no hook, no loading state, no waterfall, no `useEffect`.

```tsx
// slop — client-fetched in a Server-capable tree
"use client"
export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([])
  useEffect(() => { fetch("/api/orders").then(r => r.json()).then(setOrders) }, [])
  return <OrderList orders={orders} />
}

// correct — Server Component fetches and renders
export default async function Orders() {
  const orders = await getOrders()
  return <OrderList orders={orders} />
}
```

The `useEffect` version adds a round-trip, requires a loading skeleton, ships the fetch code to the client, and creates a waterfall if `OrderList` itself fetches anything. The Server Component version is shorter, faster, and carries no client JavaScript for the fetch.

When you genuinely need client-side fetching — user-driven refetches, infinite scroll, optimistic updates — use a real client library (TanStack Query, SWR) or a Server Action, not a hand-rolled `useEffect` + `useState` pair. The hand-rolled version reinvents caching, deduplication, retry, and cancellation and gets all of them wrong.

**DO** fetch in Server Components when the data is needed at render time.
**DO** use Server Actions for mutations triggered from Client Components.
**DO NOT** fetch in `useEffect` when a Server Component can do the same work.
  — You are round-tripping the user's browser to do work that could have happened server-side for free.

---

## Typing components without `React.FC`

`React.FC` was idiomatic in 2019. It is not anymore. It implicitly types `children` (whether you want them or not), interacts badly with generic components, and adds no value over a plain function type.

```tsx
// not idiomatic — FC adds noise and implicit children
const Card: React.FC<{ title: string }> = ({ title, children }) => (
  <section><h2>{title}</h2>{children}</section>
)

// idiomatic — function declaration with an inline prop type
export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2>{title}</h2>{children}</section>
}
```

**DO** type props inline or with a named `type` above the function.
**DO** include `children: React.ReactNode` explicitly when the component takes children.
**DO NOT** use `React.FC` or `React.FunctionComponent`.
  — It implicitly adds `children`, breaks in generic components, and the team that maintains React has steered away from it.

---

## Refs and ref forwarding

In React 19+, `ref` is a regular prop. You no longer need `forwardRef` — the function component receives `ref` alongside the others:

```tsx
// React 19+
export function TextInput({ ref, ...props }: { ref?: React.Ref<HTMLInputElement> } & InputProps) {
  return <input ref={ref} {...props} />
}
```

On older React, `forwardRef` is still required. Check the version before picking the shape.

**DO NOT** use `useRef(null)` as a place to stash mutable values that should drive rendering.
  — If the value should cause a re-render, it is state. Refs are for imperative handles and mutable values that do not affect rendering.

---

## Suspense boundaries

A `<Suspense>` boundary is a promise about where the UI can degrade gracefully. Place them at the unit of acceptable loading — the header, the article, the comments. Not every component needs one; no component needing one and having none means the whole page falls back.

```tsx
<Suspense fallback={<ArticleSkeleton />}>
  <Article id={id} />
</Suspense>
<Suspense fallback={<CommentsSkeleton />}>
  <Comments articleId={id} />
</Suspense>
```

Two Suspense boundaries let the article and the comments stream independently. One boundary around both forces them to wait for each other. No boundary forces the whole route to wait. Choose deliberately.

---

## Tailwind and the classname string

A Tailwind `className` that runs 40 classes long is not a style, it is an image rendered inline. The pattern — "I spent an hour fixing Tailwind classes GitHub Copilot created in 10 seconds" (Avery Code) — shows up because models concatenate every class they have ever seen for the kind of element.

The fix is structural, not stylistic:

1. **Extract a component when the classname is a concept.** `<Card>` owns its styling; call sites do not repeat it.
2. **Use `clsx` or `cva` for variants.** A variant is a concept (`intent: "primary" | "danger"`); a forty-class string is the shadow of the missing concept.
3. **Reject copy-pasted classnames.** If two components have overlapping 30-class strings, the overlap is a component.

```tsx
// slop
<div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500 ...">

// better — the concept is "Row"
<Row>
  <RowTitle>{title}</RowTitle>
  <RowActions>{actions}</RowActions>
</Row>
```

---

## React tool comparison

| Tool | Correct use | Slop use | Replacement |
|---|---|---|---|
| `useState` | Local, rendering-relevant mutable value | Storing a derived value | Derive during render |
| `useEffect` | Synchronizing with an external system | Deriving state, responding to user events | Derive inline; use the event handler |
| `useMemo` | Referential stability for a `memo`'d child or hook dep; measured hot computation | Memoizing every object literal | Remove it; let React render |
| `useCallback` | Passing a stable function to a `memo`'d child or hook dep | Wrapping every inline function | Remove it; inline function is fine |
| `useRef` | Imperative handles; mutable values that do not drive rendering | Storing state that should cause renders | `useState` |
| `useContext` | Value read by many components across a deep tree | Value read by one or two components | Prop |
| `"use client"` | Root of an interactive subtree | Top of every file | Remove; push the boundary deeper |
| `useEffect` + `fetch` | Client-only data (user events, optimistic updates) | Initial page data in App Router | Server Component with `await` |
| `React.FC` | Nothing, anymore | Typing any component | Plain function with typed props |
| `forwardRef` | React ≤ 18 | React 19+ | `ref` as a normal prop |

---

## Common AI failure modes

**useEffect-dependency-madness (12-TS)** — an object or inline array in a `useEffect` deps array produces an infinite render loop. This is the Cloudflare dashboard outage: a single `[{ userId }]` in deps took the dashboard down. The model reproduces the shape because the failure is silent in local dev — it only shows up when the component renders enough to notice. Fix: hoist the object out, destructure to primitives in deps, or use `useMemo` if the object is genuinely stable.

**useMemo/useCallback-everywhere (12-TS)** — reflexive memoization on every value and every function. Makarevich's observation stands: 90% of memoization in typical React apps is ceremony that costs more than it saves. The fix is to delete them, measure, and reintroduce only where a profile flags a real regression.

**data-fetch-in-useEffect in Next.js App Router (12-TS)** — the model imports `useState` and `useEffect`, marks the file `"use client"`, and fetches on mount. The Server Component that could have `await`ed the data is now a hydrated client component carrying JavaScript the page never needed. Fix: move the fetch to a Server Component; if the data is user-triggered, use a real client library or a Server Action.

**"use client" everywhere (12-TS)** — `"use client"` pasted at the top of every file because the model hit a "cannot use hooks in Server Components" error once and learned the wrong lesson. Every component hydrates, every module ships, streaming is forfeit. Fix: remove the directive from `layout.tsx`, `page.tsx`, and non-interactive components; push the boundary to the leaf that needs it.

**Giant-Tailwind-classname-string (12-TS)** — forty Tailwind classes concatenated inline on every `<div>`. The missing concept is a component. Fix: extract the repeating pattern into a named component and give the variants a discriminated union.

**God-prompt-component (10.7)** — one 500-line component generated from a single "build the dashboard" prompt. No extracted seams, no shared state boundaries, one file owning every concern. Fix: extract as you generate. A file that scrolls is almost always too long; a component whose JSX block exceeds a screen is almost always two components.

---

### Avoid

- Boolean flag props that change rendering — use a discriminated `variant` union.
- `React.FC` — type props inline or with a named `type`.
- `any` in a prop type.
- `useEffect` that derives state from other state.
- `useEffect` that responds to a user event — put it in the handler.
- Object or array literals in a `useEffect` dependency array.
- Disabling `react-hooks/exhaustive-deps` without a named reason.
- `useMemo` and `useCallback` on values and functions that are neither `memo`'d deps nor measured hot paths.
- `"use client"` at the top of a layout, a page, or a non-interactive component.
- `useEffect` + `fetch` + `useState` where a Server Component can `await` the data.
- Hand-rolled client-side data fetching when a real library or Server Action exists.
- `useRef` used as state that should drive rendering.
- A single `<Suspense>` wrapping the whole route when independent subtrees could stream.
- 30-class Tailwind `className` strings copy-pasted across components.
- 500-line components generated from one prompt — split as you go.

→ See [`../SKILL.md`](../SKILL.md) for TypeScript posture, strictness, and the BANs on `any` and `as unknown as`.
→ See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for interfaces, naming, and control-flow discipline that applies to components.
→ See [`../../../sublime/references/interfaces.md`](../../../sublime/references/interfaces.md) for props-as-interface and the second-caller rule.
→ See [`../../../anti-patterns/architectural-slop.md`](../../../anti-patterns/architectural-slop.md) for the god-component entry.
→ See [`../../../anti-patterns/over-defensive.md`](../../../anti-patterns/over-defensive.md) for optional-chaining paranoia in TSX.
