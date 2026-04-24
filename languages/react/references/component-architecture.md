# Component architecture

A component is a named unit of UI, not a file; each component does one thing and composes.

The LLM instinct on component architecture runs to two opposite failures from the same prompt. The one-shot generator (Bolt, Lovable, first-draft Claude) emits a 500-line component with twelve `useState` calls, five effects, a data layer, a form, a modal, and the markup — the god component. The "best practices" prompt pre-shards that same feature into five files — `UserListContainer`, `UserListPresenter`, `UserListItem`, `UserListEmpty`, `UserListProvider` — before a line is reused. Neither is right. Each component owns one rendering decision, composes children by slot, and its prop surface reflects the product vocabulary, not the state machine underneath.

## Taxonomy

- **God components — file-length and hook-count signals.**
- **Premature extraction — abstraction before duplication.**
- **Composition via `children` and slots.**
- **Prop explosion as a composition smell.**
- **Boolean flag props vs discriminated `variant`.**
- **HOCs vs hooks.**
- **Render props vs children.**
- **`forwardRef` in React 19.**
- **Wrapper-component disease.**

---

## God components

A component is god-shaped when any of three signals fires: the file is over ~250 lines, the function body declares more than four `useState` or three `useEffect` calls, or the JSX interleaves three unrelated concerns (data loading, form state, modal UI) in one return. Each is a lint-able threshold; together they are the Bolt/Lovable default.

```tsx
// slop — one file, 12 hooks, 4 concerns, 600 lines
export function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [formValues, setFormValues] = useState({ name: "", email: "" });
  // ...8 more useStates, 5 useEffects, 400 more lines of JSX
}
```

The fix is not "split into five files" — it is to identify the independent units. Data loading is a hook (`useUser`). Form state is a hook or a library. The modal is its own component. The dashboard composes those, rather than containing them.

```tsx
export function Dashboard() {
  const { data: user, isLoading, error } = useUser();
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBanner error={error} />;
  return (
    <DashboardLayout>
      <UserSummary user={user} />
      <EditUserButton user={user} />
    </DashboardLayout>
  );
}
```

---

## Premature extraction

Dan Abramov's ["The WET Codebase"](https://overreacted.io/the-wet-codebase/) is the reference: *"Duplication is cheaper than the wrong abstraction."* The LLM failure mode is splitting a 40-line component into a `Container`, a `Presenter`, and a `useData` hook before a second call site exists — "clean architecture" aesthetic with zero reuse.

Wait for the third instance before extracting. Two similar blocks can stay duplicated; they are not yet a concept. Three is a pattern worth naming. Extract on the shape you have seen three times, not the one you imagine you will see. A premature `UserCardPresenter` taking eighteen props to stay "purely presentational" is worse than two duplicated copies — the duplicates are easy to delete; the abstraction is a commitment.

---

## Composition via `children` and slots

Nadia Makarevich's phrasing — *"wrap state down, wrap state around children"* — is the single most useful instinct in React architecture. When a parent holds state a deep child needs, the reflex is to drill the prop through every intermediary. The fix is to pass those intermediaries *as children*, so parent and consumer are directly adjacent.

```tsx
// slop — prop drilled through three uninterested layers
<Page user={user}>
  <Sidebar user={user}>
    <Profile user={user} />
  </Sidebar>
</Page>

// fix — parent composes the consumer directly; intermediaries take children
<Page>
  <Sidebar>
    <Profile user={user} />
  </Sidebar>
</Page>
```

Named slots generalize this for components with multiple openings. A `<Modal>` takes `header`, `body`, `footer` `ReactNode` props; a `<DataTable>` takes `columns`, `emptyState`, `pagination`. Each slot is a rendering decision owned by the caller, not a configuration flag.

---

## Prop explosion

Ten or more props is a review flag. Two causes dominate. First: missing composition — `headerTitle`, `headerIcon`, `headerAction`, `footerText`, `footerCta` should be a `header` slot and a `footer` slot. Second: missing discriminated union — `size`, `variant`, `isDisabled`, `isLoading`, `hasError`, `isSuccess`, `showIcon` describe overlapping states that should collapse to one `state: "idle" | "loading" | "error" | "success"` union and a single `variant` enum.

| Prop count | Shape | Read as |
|---|---|---|
| 1–5 | Vocabulary | A component doing one thing |
| 6–10 | Configuration | Review for composition opportunity |
| 10+ | State machine leaking | Extract discriminated union, use slots |

---

## Boolean flag props

Martin Fowler's [flag-argument anti-pattern](https://martinfowler.com/bliki/FlagArgument.html) applies directly: a function with a boolean argument is two functions jammed together. In React the shape is `<Alert isError isWarning isInfo isSuccess />` — four mutually exclusive booleans representing one dimension.

```tsx
// slop — four booleans, invalid states representable
<Alert isError isWarning />        // both true?
<Alert />                           // no variant?
<Alert isLoading isError />         // loading error?

// fix — one discriminated prop, invalid states unrepresentable
type AlertProps = {
  variant: "error" | "warning" | "info" | "success";
  children: ReactNode;
};
<Alert variant="error">Payment failed</Alert>
```

The fix collapses sixteen boolean combinations to four legal variants. The component body narrows on `variant` with a `switch` or lookup table; the type checker guarantees exhaustiveness.

---

## HOCs vs hooks

Mark Erikson's ["Hooks, HOCs, and Tradeoffs"](https://blog.isquaredsoftware.com/2019/07/blogged-answers-thoughts-on-hooks/) is the reference. HOCs — `withAuth`, `withTheme`, `connect(mapState)(Component)` — were the Redux-era composition primitive. Hooks replaced them. Prefer hooks for injecting data or behaviour; reserve HOCs for structural wrapping (error boundaries, route guards, feature-flag gates that may return null).

```tsx
// slop — HOC for what is trivially a hook
const ProfilePage = withAuth(withTheme(ProfilePageImpl));

// fix — hooks compose directly, stack trace stays flat
function ProfilePage() {
  const user = useAuth();
  const theme = useTheme();
  return <ProfilePageImpl user={user} theme={theme} />;
}
```

HOCs are invisible in DevTools, shadow prop types, and nest without limit. Hooks are callable values with clear call sites.

---

## Render props vs children

Render props (`<X render={data => <Y data={data} />} />`) predate hooks and occasionally fit — list virtualization, measurement (`<AutoSizer>{({width,height}) => ...}</AutoSizer>`). For everything else, `children` is cleaner and the idiom every React reader expects.

Use `children` when the consumer renders a subtree. Use a render prop only when you need to pass *data* back to the consumer's JSX — and then call it `children` (`children: (data: X) => ReactNode`) so the call site reads as composition, not configuration.

---

## `forwardRef` in React 19

In React 18 and earlier, forwarding a ref to a DOM node inside your component required wrapping the component in `forwardRef`. In React 19, `ref` is a plain prop — the wrapper is obsolete.

```tsx
// React 18 — required the wrapper
const Button = forwardRef<HTMLButtonElement, Props>((props, ref) => (
  <button ref={ref} {...props} />
));

// React 19 — ref is a plain prop
function Button({ ref, ...props }: Props & { ref?: Ref<HTMLButtonElement> }) {
  return <button ref={ref} {...props} />;
}
```

Training data predates this; Claude, Copilot, and GPT still emit `forwardRef` wrappers reflexively. In a React 19 codebase, strip them. See [Mudssrali: "Stop using forwardRef() in your custom components in React."](https://mudssrali.com/blog/stop-using-forward-ref-in-your-custom-components-in-react) Lint: flag `forwardRef` whose `ref` parameter is unused, and any `forwardRef` in a React 19+ project.

---

## Wrapper-component disease

The shadcn/Radix school is good discipline taken too far when a tree reads `<StyledContainer><Container><Box><div>...</div></Box></Container></StyledContainer>` for a button. Five components, one `div`, no behaviour. DevTools is unreadable; every keystroke re-renders five nodes.

| Wrapper purpose | Worth the node | Slop signal |
|---|---|---|
| Semantic/accessibility shell (`<Dialog>`) | Yes | — |
| Layout primitive with variants (`<Stack gap="md">`) | Yes | — |
| Same-shape-different-name re-export | No | Delete |
| "Style wrapper" around styled-component | No | Collapse styles into one component |
| Pure pass-through (`<Box {...props} />`) | No | Delete |

The rule: a wrapper earns its existence by adding a behaviour, a constraint, or a semantic role. Renaming is not a behaviour.

---

## Component smell / signal / right shape

| Smell | Signal | Right shape |
|---|---|---|
| God component | >250 lines, >4 `useState`, >3 `useEffect` | Extract data hook, form hook, modal sibling |
| Premature extraction | 5 files, no third call site | Inline until three uses exist |
| Prop drilling | Prop passed through 3+ uninterested layers | Lift consumer up as `children` |
| Prop explosion | 10+ props, many optional | Named slots + discriminated `variant` |
| Boolean flag variants | 2+ mutually exclusive `is*` flags | Single `variant` union |
| HOC ceremony | `withX(withY(withZ(Component)))` | `useX(); useY(); useZ()` inside |
| Render prop where children work | `render={d => <Y />}` | `children={d => <Y />}` or plain `children` |
| `forwardRef` in React 19 | Any `forwardRef` call | `ref` as a plain prop |
| Wrapper disease | 5-level DOM tree, one concrete element | Collapse pass-throughs |

---

## Common AI failure modes

**`god-component`** — 500+ lines mixing data, form, modal, and rendering in one function with 10+ `useState` and 5+ `useEffect`. The Bolt/Lovable default. Split along axes that change independently (data hook, form library, modal sibling), not into a `Container`/`Presenter` pair.

**`premature-extraction`** — feature arrives as five files (`UserList`, `UserListItem`, `UserListEmpty`, `UserListContainer`, `useUserList`) with a single call site. Abramov: *"Duplication is far cheaper than the wrong abstraction."* Wait for the third concrete use.

**`prop-explosion`** — `<UserCard name={} email={} avatar={} role={} onClick={} onEdit={} onDelete={} showAvatar={} showRole={} size={} variant={} />`. Signals a missing `user: User` object, missing slots for actions, or a missing discriminated variant.

**`boolean-flag-variants`** — `<Alert isError isWarning isInfo isSuccess />` or `<Button primary secondary tertiary ghost />`. Mutually exclusive booleans allow invalid combinations and force cascading `if` checks. Collapse to a `variant` union.

**`render-prop-where-children-work`** — `<DataProvider render={data => <List data={data} />}>` where `<DataProvider>{data => <List data={data} />}</DataProvider>` reads the same. Older-training GPT output.

**`hoc-where-hook-works`** — `withAuth(withTheme(withAnalytics(Component)))` for what is three lines of hook calls inside the body. HOCs are reserved for structural wrapping; injection is a hook's job.

**`wrapper-component-disease`** — shadcn-style `<Container><Card><CardHeader><CardTitle>` around one `<h3>`. Either the wrappers carry behaviour (keep) or they are rename-only pass-throughs (delete).

**`forwardref-cargo-cult`** — React 19 project with `forwardRef` wrappers on every custom component, often with `ref` parameters that are unused. Training-data lag; `ref` is a plain prop in 19.

---

### Avoid

- Components over ~250 lines with more than four `useState` and three `useEffect` calls.
  — That density is a page-sized container; extract hooks and siblings.
- Splitting a 40-line component into five "clean architecture" files before a third call site exists.
  — Abstraction before duplication is the wrong abstraction; wait for the shape to repeat three times.
- Prop drilling through three or more intermediary components that do not read the prop.
  — Lift the consumer up as `children` instead; state wraps down, consumers wrap up.
- Components with ten or more props, especially with mutually-exclusive boolean flags.
  — Collapse into named slots plus a discriminated `variant` union.
- `<Alert isError isWarning />`-style APIs that allow invalid combinations.
  — Flag-argument anti-pattern; one `variant` union eliminates invalid states.
- HOC chains (`withA(withB(withC(X)))`) where the HOCs inject data or behaviour.
  — Hooks replace injection; HOCs are reserved for structural wrapping.
- `forwardRef` wrappers in a React 19+ codebase.
  — `ref` is a plain prop; the wrapper is obsolete and pollutes DevTools.
- Wrapper components that rename and pass through without adding behaviour.
  — Renaming is not a behaviour; collapse pass-throughs.
- Render props where `children` as a function reads the same.
  — Prefer the idiom every React reader expects.

See [`../SKILL.md`](../SKILL.md) for the React posture and hard bans.
See [`../anti-patterns.md`](../anti-patterns.md) for the named in-extension catalog.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core code-craft foundation.
See [`../../../sublime/references/interfaces.md`](../../../sublime/references/interfaces.md) for the universal module-boundary discipline.
See [`../../../anti-patterns/gratuitous-abstraction.md`](../../../anti-patterns/gratuitous-abstraction.md) for the cross-language premature-extraction catalog.
See [`../../../anti-patterns/architectural-slop.md`](../../../anti-patterns/architectural-slop.md) for broader structural anti-patterns.
See [`rendering-and-performance.md`](rendering-and-performance.md) for the render-cost implications of composition shape.
See [`styling.md`](styling.md) for the styling-layer companion to component composition.
See [`../../typescript/SKILL.md`](../../typescript/SKILL.md) for the discriminated-union discipline this reference depends on.
