---
name: react
description: "React-specific extension of the Sublime code-craft skill. Adds React-scoped positions on hook discipline (useEffect/useMemo/useCallback restraint), state management (local/URL/server distinction, Context vs Redux vs TanStack Query), component architecture (god-component avoidance, composition over prop explosion), rendering and keys, the Next.js App Router / React Server Components boundary, forms, styling (Tailwind cn discipline), testing with RTL, and accessibility. Loads on top of Sublime core; recommended alongside the TypeScript extension for TS/TSX projects. Use when writing, reviewing, or refactoring React — including Next.js App Router, Remix, Vite, and create-react-app."
license: MIT. Extension of the Sublime skill. See NOTICE.md for attribution.
user-invocable: true
---

# Sublime — React

React is a rendering library, not a framework. Most React slop comes from treating it as one — reaching for `useEffect` to do everything, duplicating state across client, server, and URL, and wrapping every primitive expression in `useMemo` because it "looks defensive." Dan Abramov spot-checked 128 `useEffect` calls in Meta's codebase and found 59 unnecessary. At LLM scale, that ratio is worse.

---

## MANDATORY PREPARATION

If the project is TypeScript — and most React projects are — **also load `../typescript/SKILL.md`** before writing code. Type-level discipline (discriminated unions, `ReactNode` vs `JSX.Element`, event type correctness, generic inference) is a separate skill set and the React skill does not duplicate it. For a strict TS/TSX project, the two skills compose; for a rare plain-JS codebase, this skill stands alone.

---

## Context Gathering Protocol (React)

React is four different libraries depending on version, compiler state, and framework. What counts as idiomatic in a Next.js 15 App Router + React 19.2 + React Compiler codebase is slop in a Vite + React 18 SPA, and vice versa. Resolve the environment before you write.

**Required context — read from the project, then confirm:**

- **React version.** `package.json` → `react` / `react-dom`. 18 is the server-components-capable baseline. 19 changed `ref` propagation (plain prop, no `forwardRef` needed), introduced `useOptimistic`, `useFormStatus`, `useActionState`, and `use()`. 19.2 added `useEffectEvent`, stabilising the event-separation idiom. RC/canary builds may have further shifts.
- **React Compiler.** Check `babel.config.*` / `next.config.*` for `babel-plugin-react-compiler` or `experimental.reactCompiler`. If it is on, ~95% of `useMemo` / `useCallback` / `React.memo` is obsolete and should not be written by hand. If it is off, memoization decisions are manual.
- **Framework.** Next.js (App Router vs Pages Router — check for `app/` vs `pages/`), Remix, Vite (SPA), TanStack Start, Expo Router, CRA (deprecated — propose migration off), Bolt / Lovable / v0 output (one-shot generators with distinctive slop signatures).
- **State library.** None, Context-only, Redux Toolkit, Zustand, Jotai, Valtio, TanStack Query, SWR, RTK Query, Apollo. Each has its own slop profile — Redux-for-toggle, Zustand boilerplate, Context-provider-for-one-value, server-state-in-client-store. Pick the one the project already uses; do not smuggle in a second.
- **Styling.** Tailwind (v3 vs v4 — the config shape differs and LLMs mix them), CSS Modules, styled-components, emotion, vanilla-extract, PandaCSS. Mixing systems is the loudest tell.
- **Testing.** React Testing Library, Playwright, Cypress, Jest, Vitest, Storybook. RTL query priority (`getByRole` > `getByLabelText` > … > `getByTestId`) is enforced regardless of runner.
- **TypeScript posture.** Is `strict` on? `strictNullChecks`? `noUncheckedIndexedAccess`? TypeScript-optional React is a different project from strict-TS React.
- **Router.** App Router (RSC-first), Pages Router, React Router (v6 vs v7), Remix, TanStack Router, Expo Router. URL is state; URL-state location depends on router shape.

**Gathering order:**
1. If loaded instructions contain a **Code Context** section, proceed.
2. Otherwise read `.sublime.md` at the project root.
3. If neither exists and the work is non-trivial, run `sublime teach` first. For one-liners, infer and state assumptions up top.

**CRITICAL:** Do not add a state management library the project does not already use. Do not flip the Next.js router between App and Pages. Do not introduce a second styling system alongside the existing one. Do not bump React major versions mid-PR.

---

## React Direction

Before writing non-trivial React, commit to a posture:

- **React version and idiom set.** React 19 + Compiler: no manual memoization, `ref` is a plain prop, `use()` for resource reads. React 18 without Compiler: `useMemo` / `useCallback` only at measured bottlenecks that pass to memoized children. Know which version you are in and write for that version.
- **Server-first or client-first.** Next.js App Router is server-first; `"use client"` is a deliberate boundary, not a default. Vite / CRA / Pages Router is client-first; there is no RSC. Writing an RSC file with `useState` in it is a build error; writing a `fetch`-in-`useEffect` in an RSC-capable project is a waste of the server.
- **State location discipline.** URL state (filters, tabs, pagination, search) goes in the URL. Server state (fetched API data) goes in TanStack Query / SWR / RTK Query / RSC. Client state (form inputs, local toggles) goes in `useState` / `useReducer`. No duplication; no `useEffect` bridging the three.
- **Styling system.** Pick one and commit. `cn()` / `clsx` / `tailwind-merge` for conditional classes. No inline `style={{...}}` pervasively, no `styled-components` in a Tailwind project.

Match the intensity of craft to the posture. A marketing page does not need Redux. A dashboard with filters, sort, pagination, and URL-shareable state needs the URL, not thirty `useState` calls.

---

## Craft Guidelines

### Hooks and effects

→ *Consult [hooks reference](references/hooks.md) for the full effect-avoidance ladder, Rules of Hooks, `useEffectEvent`, and `useRef`-vs-state discipline.*

`useEffect` is an escape hatch for synchronising with systems outside React. Derived state is not outside React. Event responses are not outside React. Data fetching is not outside React on the server and has better tools on the client. Most effects that LLMs write are wrong.

<sublime_react_hooks_principles>
**Always apply these — no reference needed:**

- If it can be computed during render from props and state, compute it during render. No `useState` + `useEffect` to mirror it.
- If it runs in response to a specific user action, it belongs in the event handler, not an effect watching a flag.
- If it fetches data, use RSC, a query library (TanStack Query / SWR / RTK Query), or `use()` — not `useEffect(() => fetch(...).then(setData), [url])`.
- `useRef` is for values that do not trigger renders. Anything read during render is state.
- Rules of Hooks are absolute. No hooks inside conditions, loops, or after an early return.
</sublime_react_hooks_principles>

<sublime_react_hooks_rules>
**DO** derive values in render: `const fullName = first + " " + last`, not an effect that sets `fullName` state.
**DO** reach for `useEffectEvent` (React 19.2) when an effect needs a value that should not trigger re-subscription.
**DO** return cleanup from every subscription, listener, timer, socket. StrictMode double-invokes effects to surface missing cleanup.
**DO** include every reactive value the effect reads in the dependency array. If the list is inconvenient, the effect is in the wrong place.

**DO NOT** write `useEffect(() => setDerived(a + b), [a, b])`. Compute `derived` in render.
**DO NOT** write `useEffect(() => setLocal(prop), [prop])`. The parent is the source of truth; derive in render or lift.
**DO NOT** wrap primitive expressions in `useMemo`: `useMemo(() => a + b, [a, b])` costs more than `a + b`.
**DO NOT** use `useCallback` on a function that is not passed to a memoized child or hook dep. It is overhead with no callers.
**DO NOT** name something `useFormattedPrice(n)` if it has no hook calls inside. It is a function; name it `formatPrice`.
</sublime_react_hooks_rules>

---

### State management

→ *Consult [state management reference](references/state-management.md) for the URL / server / client trichotomy, Context-vs-Redux-vs-Query choice, and provider-hell unwinds.*

There are three kinds of state and they live in three different places. URL state (filters, pagination, tabs) belongs in the URL. Server state (fetched data) belongs in a query library or RSC. Client state (ephemeral UI) belongs in `useState` / `useReducer`. Every piece of LLM slop in this dimension comes from putting one kind in the wrong place.

<sublime_react_state_management_principles>
**Always apply these — no reference needed:**

- Filters, tabs, pagination, search terms, sort order, selected item IDs — these belong in the URL. `useSearchParams`, `nuqs`, router-native state.
- Fetched data belongs in TanStack Query / SWR / RTK Query, or in RSC. Not in Redux with hand-rolled `loading` / `error` / `stale` flags.
- Context is for stable values that rarely change (theme, current user, locale). It is not a state manager — it re-renders every consumer on every change.
- Redux Toolkit / Zustand / Jotai earns its keep for complex client-side interactions across unrelated components. A toggle does not earn it.
- Colocate state. Keep it as close to where it is used as possible; lift only when a common ancestor genuinely needs it.
</sublime_react_state_management_principles>

<sublime_react_state_management_rules>
**DO** put filter / tab / pagination state in the URL via `useSearchParams` or `nuqs`. Shareable links and refresh-resilience come free.
**DO** use TanStack Query / SWR for any client-side fetch. You get cache, dedup, retries, and revalidation without writing them.
**DO** compose via `children` to eliminate prop drilling: let the parent render the grandchild and pass state directly.
**DO** split Context by update cadence — fast-changing value in one provider, stable value in another — or use a store (Zustand, Jotai) with selector subscriptions.

**DO NOT** wire up `Context + Provider + useContext` for a single value read by a single component. Just pass it as a prop.
**DO NOT** stack 5+ `<Provider>` at the app root. That is a store problem, not a provider problem.
**DO NOT** put fetched data in Redux / Zustand with manual `loading`, `error`, `stale` flags. That is reimplementing a query library badly.
**DO NOT** drill a prop through four intermediary components that do not read it. Use composition or a store.
**DO NOT** hoist state to the app root when only one subtree uses it.
</sublime_react_state_management_rules>

---

### Component architecture

→ *Consult [component architecture reference](references/component-architecture.md) for god-component decomposition, discriminated-union variants, composition-over-props, and the forwardRef retirement in React 19.*

Components split by responsibility, not by file-count aesthetic. A 500-line component with 10 `useState` and 5 `useEffect` is not "just one screen" — it is four screens stapled together. Conversely, extracting every JSX fragment into its own file before a second call site exists is premature abstraction.

<sublime_react_component_architecture_principles>
**Always apply these — no reference needed:**

- A component that mixes data fetching, form state, modal orchestration, and rendering is four components. Split by concern, not by line count.
- Extract on the second duplication, not the first. A fragment used once is a fragment; used twice, it is a component.
- Variants are discriminated unions, not parallel booleans. `<Alert variant="error" />` beats `<Alert isError isWarning isInfo />`.
- Prefer composition (`children`, slots, render-as-children) over prop explosion.
- In React 19, `ref` is a plain prop. `forwardRef` is legacy.
</sublime_react_component_architecture_principles>

<sublime_react_component_architecture_rules>
**DO** use `children` / slot props to eliminate prop drilling and prop explosion.
**DO** model mutually exclusive variants as a discriminated union: `type Props = { variant: "error" | "warning" | "info"; ... }`.
**DO** extract custom hooks for stateful logic shared across components — `useUser`, `useFilter`. Name them `useX` only if they call hooks.
**DO** delete `forwardRef` wrappers on React 19+ projects; `ref` is a regular prop.

**DO NOT** declare 10+ `useState` in one component. Either use `useReducer` or split the component.
**DO NOT** split a component into five tiny files because "clean architecture." You are moving imports around, not reducing complexity.
**DO NOT** create `<Container><Wrapper><Box>` chains that add no behaviour. DevTools trees 15 levels deep for a button are a tell.
**DO NOT** reach for HOCs (`withAuth`, `withTheme`) when a hook does the job without wrapper indirection.
</sublime_react_component_architecture_rules>

---

### Rendering and performance

→ *Consult [rendering and performance reference](references/rendering-and-performance.md) for keys, memoization tradeoffs, `startTransition`, and `Suspense` boundary placement.*

React's render model is cheap by default. Performance problems in LLM code almost never come from React being slow; they come from breaking React's equality model (new object every render), choosing the wrong key, or memoizing things whose dependencies change every render anyway. React Compiler, when on, obsoletes most of the hand-tuning.

<sublime_react_rendering_performance_principles>
**Always apply these — no reference needed:**

- `key` must be a stable identity of the item — a database ID, a slug, a UUID fixed at creation. Not the index, not a random value.
- With React Compiler on, do not write `useMemo` / `useCallback` / `React.memo` by hand. Let the compiler do it.
- Without the compiler, memoization only pays off when the child is `memo`-wrapped and the new prop identity would otherwise change every render.
- Inline `{...}` and `() => ...` as props defeat `React.memo` on children. Extract or `useCallback` at the boundary that needs stable identity.
- `Suspense` boundaries go around the unit of async work, not the whole app and not a single leaf.
</sublime_react_rendering_performance_principles>

<sublime_react_rendering_performance_rules>
**DO** use a stable ID for `key`. `key={item.id}`. For append-only lists where order is fixed, `key={i}` is defensible — document why.
**DO** wrap heavy client-side filter / search work in `useTransition` / `startTransition` to keep typing responsive.
**DO** co-locate `memo` with the actual memoized boundary and measure before adding it.

**DO NOT** use `key={index}` in a list that can reorder, insert, or remove. State leaks across items; form inputs keep old values.
**DO NOT** use `key={Math.random()}` or `key={crypto.randomUUID()}` inside `.map()`. Every render remounts every item.
**DO NOT** pass `style={{color: "red"}}` or `onClick={() => x()}` to a memoized child — new identity every render defeats the memo.
**DO NOT** wrap every component in `React.memo` "for performance." Without stable props it is pure overhead.
</sublime_react_rendering_performance_rules>

---

### Next.js App Router and RSC

→ *Consult [Next.js and RSC reference](references/nextjs-and-rsc.md) for the server-first default, `"use client"` discipline, serialization boundary, Server Actions, and the CVE-era hardening checklist.*

The App Router flipped React's default: components are Server Components unless explicitly marked client. LLMs trained on Pages Router emit `"use client"` at the top of every file, missing the whole point. The serialization boundary between Server and Client Components is load-bearing — `Date`, `Map`, `Set`, functions, and class instances do not cross it.

<sublime_react_nextjs_rsc_principles>
**Always apply these — no reference needed:**

- Server Components are the default. `"use client"` is a boundary you add when you genuinely need state, effects, event handlers, or browser-only APIs.
- Fetch data in Server Components with `fetch` / your ORM directly. No `useEffect`-fetch in an RSC-capable codebase.
- The RSC boundary serializes props. Only JSON-safe values cross. No `Date`, `Map`, `Set`, class instances, or functions (except Server Actions marked `"use server"`).
- Secrets stay server-side. `NEXT_PUBLIC_` ships to the browser bundle — it is not a secret.
- Each route segment owns its `loading.tsx` and `error.tsx`. UX regresses silently without them.
</sublime_react_nextjs_rsc_principles>

<sublime_react_nextjs_rsc_rules>
**DO** keep `"use client"` as close to the leaf as possible — the interactive widget, not the layout that contains it.
**DO** use Server Actions (`"use server"`) for mutations. They compose with `<form action={...}>` natively.
**DO** pass plain serializable data from Server to Client Components. Format `Date` to ISO string, convert `Map` / `Set` to arrays at the boundary.
**DO** add `loading.tsx` and `error.tsx` per route segment.

**DO NOT** put `"use client"` at the top of every file. It is a performance and serialization contract, not a default.
**DO NOT** call `useState` / `useEffect` in a file without `"use client"`. Build error; move the file or the directive.
**DO NOT** prefix secrets with `NEXT_PUBLIC_`. Stripe keys, DB URLs, API secrets — server-only.
**DO NOT** fetch the same data server-side in RSC and re-fetch it client-side on mount. That is the double-fetch waterfall.
**DO NOT** branch on `typeof window !== "undefined"` or render `Date.now()` / `Math.random()` directly in JSX. Hydration mismatch.
</sublime_react_nextjs_rsc_rules>

---

### Forms

→ *Consult [forms reference](references/forms.md) for controlled/uncontrolled discipline, `useActionState`, `useFormStatus`, and library choices.*

A form is not ten `useState` calls and ten `onChange` handlers. React 19 has `useActionState`, `useFormStatus`, and `useOptimistic` for exactly the form-with-submission shape that dominates web apps. Server Actions in the App Router make `<form action={...}>` a first-class pattern again.

<sublime_react_forms_principles>
**Always apply these — no reference needed:**

- `<input value={x} onChange={...} />` or `<input defaultValue={x} />`. Never `value` without `onChange` — React will warn and silently change semantics.
- One state source per form: a single object (or `useReducer`), react-hook-form, or uncontrolled + `FormData`. Not ten parallel `useState`.
- In Next.js App Router, `<form action={serverAction}>` is the idiom. `onSubmit` + `fetch` is Pages-Router muscle memory.
- Labels are not optional. Every input has a `<label htmlFor>` or `aria-label` / `aria-labelledby`.
</sublime_react_forms_principles>

<sublime_react_forms_rules>
**DO** use `useActionState` (React 19) for form submission with pending + error state in one hook.
**DO** use `useFormStatus` inside a submit button to disable it while pending — it reads from the enclosing form without prop drilling.
**DO** reach for react-hook-form + Zod for complex, validated forms. Uncontrolled + schema parsing is fast and readable.
**DO** associate every input with a `<label>`. `htmlFor={id}` + `id={id}` or wrap the input inside the label.

**DO NOT** write `<input value={x} />` with no `onChange`. React flips it to uncontrolled and logs a warning.
**DO NOT** lift a single form's state into Context. Every keystroke re-renders the whole tree.
**DO NOT** re-validate on every keystroke in every field. Validate on blur or on submit for most fields.
**DO NOT** write ten `useState` + ten `onChange` for ten fields. One object with a `name`-keyed handler, or `useReducer`, or a form library.
</sublime_react_forms_rules>

---

### Styling

→ *Consult [styling reference](references/styling.md) for Tailwind `cn()` discipline, arbitrary-value restraint, and CSS-system consistency.*

Pick one styling system and commit. Tailwind's `className` strings go feral without a `cn()` helper, a component-extraction reflex, and variant libraries (`cva`, `tailwind-variants`). The tell for LLM Tailwind is a 300-character class string repeated across four files with one value differing.

<sublime_react_styling_principles>
**Always apply these — no reference needed:**

- Use the project's styling system. Do not smuggle in a second.
- `cn()` / `clsx` / `tailwind-merge` for conditional classes. String interpolation produces duplicate and conflicting utilities.
- Extract repeated long class strings to a component or a variant (`cva`, `tailwind-variants`), not copy-paste across files.
- Tailwind's JIT only sees static class names. Dynamic strings like `` `bg-${color}-500` `` silently fail.
- Arbitrary values (`w-[427px]`, `text-[13.5px]`) are a last resort. They bypass the design system.
</sublime_react_styling_principles>

<sublime_react_styling_rules>
**DO** use `cn(...)` for every conditional class. `cn("base", isActive && "active", className)`.
**DO** use `tailwind-variants` / `cva` for component variant APIs. `variant="primary"` → class map, not a ternary chain.
**DO** extract components when the same 15-utility string appears in more than two places.
**DO** honor the Tailwind version. v4 moved to CSS-first config; v3 patterns in v4 projects break silently.

**DO NOT** write a `className` string over 200 characters with no `cn()` and no extraction.
**DO NOT** sprinkle `w-[427px]`, `bg-[#3b82f6]`, `text-[13.5px]` across the codebase. Use the theme scale.
**DO NOT** use dynamic class names like `` `bg-${color}-500` ``. JIT compiler cannot see them. Map to static strings.
**DO NOT** mix `styled-components` or `emotion` into a Tailwind project. Pick one.
</sublime_react_styling_rules>

---

### Testing and accessibility

→ *Consult [testing and a11y reference](references/testing-and-a11y.md) for RTL query priority, `userEvent` discipline, `findBy` vs `getBy`, ARIA correctness, and keyboard semantics.*

React Testing Library has a priority order, and `getByTestId` is at the bottom. Kent C. Dodds: *test how the user uses the component*. `userEvent` models real keystrokes and focus; `fireEvent` is a synthetic shortcut. Accessibility is the same discipline as testing — both come from using the right semantic element, not inventing one.

<sublime_react_testing_a11y_principles>
**Always apply these — no reference needed:**

- RTL priority: `getByRole` > `getByLabelText` > `getByPlaceholderText` > `getByText` > `getByDisplayValue` > `getByAltText` > `getByTitle` > `getByTestId`. `getByTestId` is a last resort.
- `userEvent` is the default interaction API. `fireEvent` is a synthetic shortcut that misses focus, blur, and IME.
- Async UI uses `findBy` / `waitFor`. `getBy` for elements that appear asynchronously is a race.
- Use the right HTML element. `<button>` is a button; `<div onClick>` is a click target masquerading as one.
- Every interactive element is reachable by keyboard. Focus ring, `tabIndex`, `onKeyDown` for Enter/Space if it is not a native button/link.
</sublime_react_testing_a11y_principles>

<sublime_react_testing_a11y_rules>
**DO** query by role with the accessible name: `getByRole("button", { name: /submit/i })`. That is how screen readers see the app.
**DO** use `await userEvent.type(input, "hello")`, not `fireEvent.change(input, { target: { value: "hello" } })`.
**DO** use `findBy*` / `await waitFor(...)` for elements that appear after async work.
**DO** give icon-only buttons `aria-label`. Give every `<img>` an `alt` (empty string is valid for decorative).
**DO** fix `act(...)` warnings by awaiting the actual state change, not suppressing the warning.

**DO NOT** reach for `getByTestId` when `getByRole` would find it. Tests drift from user experience.
**DO NOT** use `fireEvent.click` when the user really types, focuses, and tabs. Use `userEvent`.
**DO NOT** wrap a div with `onClick` and skip `role`, `tabIndex`, and `onKeyDown`. Use `<button>`.
**DO NOT** snapshot entire component trees. Unreadable snapshots are lint noise, not assertions.
**DO NOT** ship an `<input>` without an associated `<label>` or `aria-label`.
</sublime_react_testing_a11y_rules>

---

## Hard BANs (React)

<absolute_bans>

**BAN 1: `useEffect` for data fetching**
- PATTERN: `useEffect(() => { fetch(url).then(r => r.json()).then(setData) }, [url])` with no cancellation, dedup, cache, or race protection
- FORBIDDEN: any `useEffect` whose body fetches remote data and stores it in state
- WHY: the single most-produced React slop. Waterfalls, race conditions, StrictMode double-invocation bugs, no cache, no dedup. Vercel's react-best-practices skill exists specifically to stop this.
- REWRITE: use RSC (`async function Page() { const data = await fetch(...) }`), or TanStack Query / SWR on the client.

**BAN 2: `useEffect` syncing a prop into local state**
- PATTERN: `const [x, setX] = useState(prop); useEffect(() => setX(prop), [prop])`
- FORBIDDEN: any effect whose job is to copy an incoming prop into local state
- WHY: the parent is the source of truth. The effect causes a second render with a stale intermediate value and creates two places to change the same data. React docs call this out directly.
- REWRITE: use the prop in render. If you need to "reset" on prop change, use `key={prop}` to remount, or derive in render with `useMemo` on a complex transform.

**BAN 3: `key={index}` in a list that reorders, inserts, or removes**
- PATTERN: `{items.map((item, i) => <Row key={i} item={item} />)}` where items can change order, be inserted, or be removed
- FORBIDDEN: array index as key for any non-static list
- WHY: React matches children by key. Indices shift on reorder/insert/remove; state (form inputs, focus, uncontrolled selections) leaks across items. Josh Comeau's breakdown is canonical. `react/no-array-index-key`.
- REWRITE: `key={item.id}` or any stable identity fixed at item creation.

**BAN 4: `key={Math.random()}` or `key={crypto.randomUUID()}` inside `.map()`**
- PATTERN: `{items.map(item => <Row key={Math.random()} item={item} />)}`
- FORBIDDEN: any non-deterministic key computed during render inside a list map
- WHY: every render produces new keys, so every item is unmounted and remounted every render. State loss, layout thrash, lost focus, DOM flash.
- REWRITE: use a stable ID on the item. If the item has no natural ID, assign one at creation (`crypto.randomUUID()` when pushing into the list, not when rendering).

**BAN 5: `NEXT_PUBLIC_` prefix on a secret**
- PATTERN: `NEXT_PUBLIC_API_KEY=sk_live_...` in `.env` or hardcoded in a client component
- FORBIDDEN: any secret value (API key, DB URL, auth secret, private token) exposed via `NEXT_PUBLIC_` or imported into a `"use client"` file
- WHY: `NEXT_PUBLIC_` inlines the value into the browser bundle. It is public by definition. Google-API-key leaks have produced five-figure bills; Cyble found thousands of live sites leaking LLM keys the same way.
- REWRITE: keep the secret server-only (no `NEXT_PUBLIC_` prefix), call it from a Server Component, Server Action, or Route Handler, and return only the derived data.

**BAN 6: Conditional hook calls**
- PATTERN: `if (cond) { const [x, setX] = useState(0); }` or `useState` after an early `return`, or inside a loop
- FORBIDDEN: any hook call inside `if`, `for`, `while`, `switch`, a ternary, or after any conditional `return`
- WHY: React identifies hooks by call order. Conditional calls shift the order; state and effects bind to the wrong hook on the next render. Crashes on toggle. `react-hooks/rules-of-hooks`.
- REWRITE: call the hook unconditionally at the top, branch on its result. Extract into a child component if the branch is large.

**BAN 7: `"use client"` at the top of every file**
- PATTERN: `"use client"` as a reflex at the top of every file in a Next.js App Router project
- FORBIDDEN: `"use client"` on files that do not use state, effects, event handlers, or browser-only APIs
- WHY: App Router is server-first. `"use client"` is a performance and serialization contract — everything below it ships to the browser and cannot import server-only modules. Vercel's create-next-app ships an `AGENTS.md` precisely because LLMs default to client.
- REWRITE: leave the file as a Server Component. Push `"use client"` down to the smallest interactive leaf.

**BAN 8: `<div onClick={...}>` without keyboard handler, role, and focusable attr**
- PATTERN: `<div onClick={handleClick}>Click me</div>` without `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space
- FORBIDDEN: non-interactive elements (`div`, `span`) with `onClick` but no keyboard, role, or focus semantics
- WHY: keyboard users cannot activate it. Screen readers announce it as a div. `jsx-a11y/no-static-element-interactions`, `jsx-a11y/click-events-have-key-events`.
- REWRITE: `<button type="button" onClick={handleClick}>Click me</button>`. Style it to not look like a button if needed; semantics are not a visual concern.

**BAN 9: Passing `Date` / `Map` / `Set` / class instances / functions from Server to Client Component**
- PATTERN: Server Component renders `<ClientChild date={new Date()} />` or `<ClientChild onAction={() => ...} />`
- FORBIDDEN: any non-serializable value crossing the RSC boundary as a prop
- WHY: Next.js serializes RSC props to Flight. Only JSON-safe values cross. Functions error explicitly: *"Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with 'use server'."*
- REWRITE: format at the boundary — `date={date.toISOString()}`, `entries={Array.from(map.entries())}`. For callbacks, use a Server Action marked `"use server"`.

**BAN 10: Tailwind class string over 200 characters with no extraction and no `cn()`**
- PATTERN: `className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 ..."` repeated across four files
- FORBIDDEN: inline class strings over ~200 chars duplicated across components without `cn()`, `cva`, or extraction
- WHY: dev.to/avery_code on Copilot Tailwind: *"it inlines everything. Every time. The same combination of fifteen utilities scattered across four different places."* Unmaintainable; drift accumulates across copies.
- REWRITE: extract to a `Button` / `Card` component, or use `tailwind-variants` / `cva` for variant APIs. Compose with `cn()`.

</absolute_bans>

---

## AI Slop Test (React)

If an experienced React reviewer read this diff and said "an AI wrote this," would they be right on sight? These are the tells:

<sublime_react_slop_tells>

- `useEffect(() => { fetch(url).then(r => r.json()).then(setData) }, [url])` with no cancellation and no library.
- `useEffect(() => setLocal(prop), [prop])` — prop-to-state mirror.
- `useEffect(() => setDerived(a + b), [a, b])` — derived state via effect.
- `useMemo` wrapping a primitive expression: `useMemo(() => a + b, [a, b])`.
- `useCallback` on a function never passed to a memoized child or hook dep.
- `key={index}` or `key={i}` in a `.map()` over a list that can reorder.
- 5+ nested `<XProvider>` at the app root.
- A 500-line component with 10+ `useState` calls and 5+ `useEffect`.
- `<Alert isError isWarning isInfo isSuccess />` — mutually exclusive booleans.
- `React.FC<Props>` annotations, especially with no children actually needed.
- `"use client"` at the top of every file in a Next.js App Router project.
- `forwardRef` wrapping a component that never receives a `ref` (or in React 19 at all).
- `className="px-4 py-2 bg-blue-500 hover:bg-blue-600 ..."` strings over 200 characters.
- `getByTestId(...)` where `getByRole(...)` would work.
- `fireEvent.change(...)` where `userEvent.type(...)` would model the real keystroke.
- Data fetched in an RSC server-side and refetched client-side on mount.
- `useState(items.reduce(...))` — derived value duplicated as local state.
- `Context + Provider + useContext` wired up for a single value read by one component.
- `NEXT_PUBLIC_API_KEY`, `NEXT_PUBLIC_STRIPE_SECRET`, `NEXT_PUBLIC_DATABASE_URL`.
- `Math.random()` / `Date.now()` / `new Date().toLocaleTimeString()` rendered directly in JSX.
- `<input value={x} />` with no `onChange`.

</sublime_react_slop_tells>

Good React looks boring. Slop React looks busy — the busyness is the tell.

---

## Implementation Principles (React)

Compute derived values in render; do not mirror them in state and sync with effects. Put URL state in the URL, server state in a query library or RSC, client state in `useState`. Use stable IDs for keys. Do not memoize by reflex — React Compiler handles most of it; without the compiler, memoize only at measured boundaries that pass to memoized children. In the App Router, stay server-first; push `"use client"` to the leaf. Only serializable data crosses the RSC boundary. `"use server"` marks Server Actions; `<form action={...}>` wires them in. Use the right HTML element — `<button>` not `<div onClick>`, `<label htmlFor>` not a floating placeholder. Query by role in tests; type with `userEvent`. Style with one system; use `cn()` for conditional classes; extract at the second duplication. Hooks obey their rules; effects subscribe and clean up; custom hooks are functions that call hooks. Remember: {{model}} is capable of writing React that Dan Abramov would recognize as React. Don't hold back — but don't write a useEffect either.

---

## Deeper reference

- [references/hooks.md](references/hooks.md) — effect-avoidance ladder, Rules of Hooks, `useEffectEvent`, `useRef`-vs-state.
- [references/state-management.md](references/state-management.md) — URL / server / client trichotomy, Context vs Redux vs TanStack Query, provider-hell unwinds.
- [references/component-architecture.md](references/component-architecture.md) — god-component decomposition, discriminated-union variants, composition, `forwardRef` retirement.
- [references/rendering-and-performance.md](references/rendering-and-performance.md) — keys, memo tradeoffs, `startTransition`, `Suspense` boundaries.
- [references/nextjs-and-rsc.md](references/nextjs-and-rsc.md) — server-first default, `"use client"` discipline, serialization boundary, Server Actions.
- [references/forms.md](references/forms.md) — controlled/uncontrolled, `useActionState`, `useFormStatus`, react-hook-form.
- [references/styling.md](references/styling.md) — Tailwind `cn()` discipline, arbitrary-value restraint, variant libraries.
- [references/testing-and-a11y.md](references/testing-and-a11y.md) — RTL priority, `userEvent`, `findBy` vs `getBy`, ARIA, keyboard semantics.

React-specific anti-patterns: [anti-patterns.md](anti-patterns.md)

Core foundation: [../../sublime/SKILL.md](../../sublime/SKILL.md)

Recommended companion: [../typescript/SKILL.md](../typescript/SKILL.md) for TS/TSX projects.
