# Next.js App Router and React Server Components

The App Router is server-first; `"use client"` is a serialization contract, not a default, and every file that declares it without needing interactivity is a bug that ships to the browser.

React Server Components invert the training-corpus default. Pages Router and every pre-2023 tutorial assumed the tree runs in the browser with occasional `getServerSideProps` detours. App Router assumes the opposite: components render on the server and only cross into the client bundle when a leaf needs state, effects, or browser APIs. LLMs trained on the older corpus sprinkle `"use client"` across files that do no interactive work — endemic enough that `create-next-app` ships `AGENTS.md` to correct it. Assumes Next.js 14+/15 and React 19.

## The server-first default

Every file under `app/` is a Server Component unless it declares `"use client"`. Server Components render once on the server, stream an RSC payload to the browser, and never ship their code to the client. They `await` directly, hit the database, and touch secrets.

Client Components are the leaves — subtrees that hold state, run effects, attach event handlers, or use browser APIs. The boundary is bottom-up. Start with a Server Component and split off the smallest leaf that genuinely needs interactivity.

```tsx
// app/products/page.tsx — Server Component, no directive
import { db } from "@/server/db";
import { AddToCart } from "./add-to-cart";

export default async function ProductsPage() {
  const products = await db.product.findMany();
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>
          {p.name}
          <AddToCart productId={p.id} />
        </li>
      ))}
    </ul>
  );
}

// app/products/add-to-cart.tsx — Client Component, only where needed
"use client";
import { useState } from "react";

export function AddToCart({ productId }: { productId: string }) {
  const [pending, setPending] = useState(false);
  return <button disabled={pending} onClick={() => setPending(true)}>Add</button>;
}
```

The directive belongs on `add-to-cart.tsx`, not `page.tsx`. Move it up and the DB query and its secrets compile into the client bundle or fail the build.

## `"use client"` as a boundary

`"use client"` marks a module as an entry into the client bundle. Every import reachable from that module is bundled and shipped to the browser. The directive is a one-way contract: everything rendered inside a Client Component is client too, unless you pass Server Components through as `children` or named slots.

Props crossing the boundary must be serializable: plain JSON (`string`, `number`, `boolean`, `null`, plain objects, arrays), `Promise`, React elements, and Server Actions marked `"use server"`. It does not include functions, `Date`, `Map`, `Set`, class instances, `BigInt`, `Symbol`, or typed arrays. Passing any of those throws at render. Serialize on the server — `date.toISOString()`, `Array.from(map)` — and rehydrate on the client if needed.

## Passing a function as a prop

You cannot pass an ordinary function from a Server Component to a Client Component. The closure lives on the server. The error is explicit: *"Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with `'use server'`."*

```tsx
// Wrong — throws at runtime
export default async function Page() {
  const handleSave = async (data: FormData) => { /* ... */ };
  return <ClientForm onSave={handleSave} />;
}

// Right — Server Action, serialized as a reference the client can invoke
// app/actions.ts
"use server";
export async function saveUser(data: FormData) { /* runs on the server */ }

// app/page.tsx
import { saveUser } from "./actions";
export default function Page() {
  return <ClientForm onSave={saveUser} />;
}
```

Server Actions are the only function-shaped thing that crosses the boundary. The action runs on the server; the client holds a reference that invokes it over the wire.

## Server-only imports in Client Components

The boundary runs through the import graph. Any module reached from a `"use client"` file is bundled for the browser. Importing a DB client or a secret reader from a Client Component is a build error — or worse, succeeds and ships your secrets.

```tsx
// Wrong — ships the DB client and its driver into the browser bundle
"use client";
import { db } from "@/server/db";

export function UserList() {
  const users = db.user.findMany(); // also: runs at module load on the client
  return <ul>{/* ... */}</ul>;
}
```

Mark server-only modules with `import "server-only"` at the top so a stray client import fails loudly. The inverse, `import "client-only"`, protects modules that depend on browser globals.

## `NEXT_PUBLIC_` — the client-bundle contract

Environment variables prefixed `NEXT_PUBLIC_` are inlined into the client bundle at build time. The prefix is not a security label; it is a ship-to-client opt-in. Any secret prefixed this way is a secret no longer.

```tsx
// Wrong — leaks to every browser
const stripeSecret = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;

// Right — server-only; never crosses the boundary
const stripeSecret = process.env.STRIPE_SECRET_KEY; // only readable in Server Components / Route Handlers / Server Actions
```

Rule: the prefix is only for values safe to publish on the homepage. Secrets live unprefixed.

## `cookies()` and `headers()` — server-only scope

`cookies()` and `headers()` from `next/headers` work only in Server Components, Route Handlers, and Server Actions. They throw outside that scope. A Client Component that needs the cookie value reads it from props passed down by a Server Component parent, or hits a Route Handler.

```tsx
// Wrong — throws
"use client";
import { cookies } from "next/headers";
export function Nav() { const s = cookies().get("session"); /* throws */ }

// Right — server reads, client receives the value
import { cookies } from "next/headers";
export async function Nav() {
  const session = cookies().get("session")?.value ?? null;
  return <NavClient session={session} />;
}
```

## Data fetching — RSC first, then Route Handlers, then client query libs

Three layers, and one wrong-default habit from older training.

- **Server Components** `await fetch()` or the ORM directly. The default. No loading state, no race, no `useEffect`. Next.js deduplicates identical `fetch` calls within a render.
- **Route Handlers** (`app/api/.../route.ts`) exist for callers you do not control — webhooks, OAuth, mobile apps. Prefer Server Actions for same-origin mutations.
- **Client query libraries** — TanStack Query, SWR — handle interactive updates, optimistic mutations, and polling. Seed them with RSC data; do not use them in place of the initial server render.

`useEffect(() => { fetch(url).then(setData) }, [url])` in an App Router codebase is almost always wrong.

```tsx
// Wrong — client fetch for data the server already has
"use client";
export function Orders() {
  const [orders, setOrders] = useState(null);
  useEffect(() => { fetch("/api/orders").then(r => r.json()).then(setOrders); }, []);
  return orders ? <OrderList orders={orders} /> : <Spinner />;
}

// Right — fetch on the server
export default async function OrdersPage() {
  const orders = await db.order.findMany();
  return <OrderList orders={orders} />;
}
```

## `loading.tsx` and `error.tsx`

Every route segment supports `loading.tsx` (Suspense fallback) and `error.tsx` (error boundary). File-system primitives: add the file, get the behavior. Segments without them surface blank pages during streaming and white screens on thrown errors.

```tsx
// app/products/loading.tsx
export default function Loading() { return <ProductSkeleton />; }

// app/products/error.tsx — must be a Client Component
"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <div>Something broke. <button onClick={reset}>Retry</button></div>;
}
```

The App Router expects both. Skipping them is the user-visible cost of async rendering.

## Hydration mismatches

Hydration fails when server-rendered HTML does not match the client's first render. React's error enumerates the top causes: `Math.random()`, `Date.now()`, `new Date().toLocaleTimeString()`, `navigator.userAgent`, and `typeof window !== "undefined"` branches inside JSX.

```tsx
// Wrong — server and client render different values
export function Stamp() {
  return <span>{new Date().toLocaleTimeString()}</span>;
}

// Right — generate on the server, pass down
export default async function Page() {
  return <Stamp renderedAt={new Date().toISOString()} />;
}

// Right — defer browser reads to post-mount effect in a Client Component
"use client";
export function Width() {
  const [w, setW] = useState<number | null>(null);
  useEffect(() => { setW(window.innerWidth); }, []);
  return <span>{w ?? "—"}</span>;
}
```

Values depending on wall-clock time, randomness, or browser state must come from props or post-mount effects — never from JSX evaluated on both sides.

## Double-fetch and RSC waterfalls

Two failure modes. First: Server Component fetches, Client Component inside it refetches on mount — user sees a spinner after the HTML arrived. Second: independent fetches sequenced with `await` when they could run in parallel.

```tsx
// Wrong — serial, even though the calls are independent
const user = await fetchUser(id);
const orders = await fetchOrders(id);

// Right — parallel
const [user, orders] = await Promise.all([fetchUser(id), fetchOrders(id)]);
```

If a Client Component needs the server's data, thread it through props. Do not give the client a URL to hit on mount when the server already has the answer.

## `api` routes vs RSC direct fetch

Route Handlers are right when an external caller needs a URL — webhooks, OAuth, mobile. They are wrong when your own Server Component could hit the database directly. Self-HTTP adds serialization, a network hop, and loses request-scoped deduplication.

```tsx
// Wrong — your own page calling your own API
export default async function Page() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/users`);
  const users = await res.json();
  return <List users={users} />;
}

// Right — direct access
export default async function Page() {
  const users = await db.user.findMany();
  return <List users={users} />;
}
```

Route Handlers exist to serve clients you do not control. RSCs serve the tree.

## Boundary-violation table

| Violation | Runtime behavior | Right shape |
|---|---|---|
| `"use client"` on a component with no state or effects | Ships JS for no interactivity | Drop the directive; render as RSC |
| DB client imported into `"use client"` file | Build error or secrets in browser | Mark `server-only`; pass data as props |
| Function prop from RSC to Client Component | *"Functions cannot be passed directly..."* | Server Action marked `"use server"` |
| `Date`/`Map`/`Set`/class instance across boundary | Serialization error at render | Serialize on server, rehydrate if needed |
| `NEXT_PUBLIC_STRIPE_SECRET_KEY` | Inlined into every browser bundle | Drop the prefix; read server-side only |
| `cookies()`/`headers()` in Client Component | Throws: called outside server context | Read on server, pass value as prop |
| `useEffect` fetching this route's data | Client waterfall, races, extra spinner | `await` in the Server Component |
| RSC fetch plus Client Component refetch | Double-fetch waterfall | Thread RSC data down via props |
| `new Date().toLocaleTimeString()` in JSX | Hydration mismatch | Pass timestamp prop; defer to effect |
| `fetch("/api/users")` from same-app RSC | Self-HTTP round trip | Hit the data source directly |
| Route segment without `loading.tsx`/`error.tsx` | Blank page during streaming; white screen on throw | Add both files per segment |
| `"use server"` on non-exported helper | Runtime error or silent no-op | Export from `"use server"` module |

## Common AI failure modes

- **`use-client-everywhere`** — `"use client"` prepended to every file in `app/`. Defeats server rendering: secrets ship to the browser, bundle size balloons, streaming benefits evaporate. Default is no directive; add it only to the smallest leaf that needs state or effects.
- **`server-in-client-contamination`** — importing `@/server/db`, Prisma, filesystem modules, or secret readers from a `"use client"` file. Build fails on modern Next.js, but the LLM "fix" is often a dynamic-import shim that hides the real problem. Mark server modules `server-only`; pass results as props.
- **`client-in-server-hooks`** — `useState`, `useEffect`, `useRef` in a file without `"use client"`. Build error. Add the directive to that file; do not lift it onto the parent.
- **`function-as-prop-rsc-error`** — passing a plain function prop from an RSC to a Client Component. Throws with *"Functions cannot be passed directly to Client Components"*. Make it a Server Action in a `"use server"` module or move the work into the client leaf.
- **`date-map-serialization-error`** — passing `Date`, `Map`, `Set`, or class instances across the boundary. Render throws. Serialize on the server (`toISOString`, `Array.from`) and reconstruct if needed.
- **`fetch-waterfall-in-rsc`** — sequential `await` of independent fetches. Pays serial latency. Use `Promise.all` and Suspense boundaries.
- **`missing-loading-error-tsx`** — segments with no `loading.tsx` or `error.tsx`. Blank pages during streaming, white screens on throw. Add both per segment.
- **`cookies-headers-wrong-scope`** — `cookies()` or `headers()` called from a Client Component or a library reached by a client import. Throws. Read on the server, pass values down.
- **`server-action-misuse`** — `"use server"` on a non-exported function, a closure captured in an RSC, or a mixed-helper module. The action does not register or the closure is unreachable. Put actions in dedicated `"use server"` modules and export them.
- **`next-public-leak`** — secrets prefixed `NEXT_PUBLIC_` under the assumption the prefix is a security boundary. It is the opposite. Drop the prefix for secrets; reserve it for publishable values.
- **`hydration-mismatch`** — `Math.random()`, `Date.now()`, `toLocaleTimeString()`, `navigator.userAgent`, or `typeof window` branches in JSX during first render. Server and client disagree; hydration fails. Generate server-side and pass down, or defer to a post-mount `useEffect`.
- **`double-fetch`** — RSC fetches on the server, Client Component refetches on mount. Waterfall and wasted round trip. Thread RSC data down as props.
- **`api-route-when-rsc-would-do`** — `app/api/*` existing only so a same-app RSC can `fetch` it. Drop the route; query the data source directly.

### Avoid

- `"use client"` on every file.
  — Ships JavaScript and secrets for components that do no interactive work.
- Server-only imports (DB clients, secret readers) from a `"use client"` module.
  — Fails the build or ships the import graph to the browser; mark with `server-only`.
- Plain function props from a Server Component to a Client Component.
  — Functions do not cross the serialization boundary; use a `"use server"` Server Action.
- `Date`, `Map`, `Set`, or class instances across the boundary.
  — RSC serializer throws; serialize on the server and rehydrate if needed.
- `NEXT_PUBLIC_` prefixes on secrets.
  — The prefix ships the value into every browser bundle at build time.
- `cookies()` or `headers()` in a Client Component.
  — Server-only; read on the server and pass values down.
- `useEffect` fetching data owned by the current route.
  — Client waterfall, races, and a spinner after the HTML arrived; fetch in the Server Component.
- Sequential `await` of independent data sources in an RSC.
  — Pays serial latency; fan out with `Promise.all` or Suspense.
- Route segments without `loading.tsx` and `error.tsx`.
  — Blank pages during streaming, white screens on throw.
- `new Date().toLocaleTimeString()`, `Math.random()`, or `typeof window` in JSX.
  — Hydration mismatches React's error message explicitly enumerates.
- RSC fetches plus Client Component refetch of the same data.
  — Double round trip; pass server data down as a prop.
- `app/api/*` routes used only by same-app RSCs.
  — Self-HTTP round trip; query the data source directly.

See [`../SKILL.md`](../SKILL.md) for React posture and hard bans.
See [`testing-and-a11y.md`](testing-and-a11y.md) for the sibling testing and a11y discipline.
See [`../anti-patterns.md`](../anti-patterns.md) for named React slop catalog entries.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core foundation.
See [`../../../sublime/references/errors.md`](../../../sublime/references/errors.md) for error-handling posture that Server Actions depend on.
See [`../../../anti-patterns/security-and-correctness.md`](../../../anti-patterns/security-and-correctness.md) for secret-leakage and boundary-violation entries.
See [`../../typescript/SKILL.md`](../../typescript/SKILL.md) and [`../../typescript/references/types.md`](../../typescript/references/types.md) for the TypeScript discipline Server Actions rely on.
