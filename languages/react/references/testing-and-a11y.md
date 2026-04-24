# Testing and accessibility

Test the component the way a user uses it; make it reachable by a user the way assistive tech reaches it — if your test needs `getByTestId`, your component is probably missing a `role` or `aria-label`, and your users with screen readers are missing the same affordance.

React Testing Library and semantic HTML encode the same truth from two directions. RTL's query priority ladder exists because real users — sighted or not — find controls by their accessible name and role. Screen readers and keyboard navigation work by the same mechanism. A `<div onClick>` has neither role nor keyboard affordance, so the RTL test cannot find it with `getByRole("button")` and the screen-reader user cannot find it either. The "fix" of adding `data-testid` papers over the accessibility defect without removing it. The same discipline — use the right element, give it a name, make it reachable — satisfies both. Both subjects are grouped here because the failure modes rhyme: the test reaches for `getByTestId` for the same reason the component ships as `<div onClick>` instead of `<button>`.

## RTL query priority — `getByRole` first

Kent C. Dodds's [priority ladder](https://testing-library.com/docs/queries/about/#priority), in order:

1. `getByRole` — accessibility-first; matches how assistive tech navigates.
2. `getByLabelText` — form fields by their visible or `aria-labelledby` label.
3. `getByPlaceholderText` — fallback for inputs without labels (but prefer a real label).
4. `getByText` — non-interactive content.
5. `getByDisplayValue` — current form value.
6. `getByAltText` — images and `area` elements.
7. `getByTitle` — last resort for elements with `title`.
8. `getByTestId` — escape hatch for elements with no accessible surface, e.g. a drag handle deliberately hidden from ATs.

`getByTestId` is last for a reason: reaching for it means your test cannot identify the element the way a user would, which means a real user cannot either. Treat every `data-testid` as a flag to ask whether the component is missing a role or an accessible name.

```tsx
// Wrong — test works, screen reader user cannot find the control
<div data-testid="submit-btn" onClick={handleSubmit}>Submit</div>
expect(screen.getByTestId("submit-btn")).toBeInTheDocument();

// Right — role + name; both the test and the screen reader find it
<button onClick={handleSubmit}>Submit</button>
expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
```

## `userEvent` over `fireEvent`

`fireEvent` dispatches a single synthetic event. `userEvent` (v14+) simulates the full sequence a real user generates — focus, keydown, keypress, input, change, blur — in the correct order, with realistic timing. `fireEvent.change(input, { target: { value: "hi" } })` sets the value in one shot and skips every event in between, masking bugs in controlled inputs, IME handling, and keyboard-triggered side effects.

```tsx
// Wrong — skips focus, keydown, input
import { fireEvent } from "@testing-library/react";
fireEvent.change(input, { target: { value: "hello" } });
fireEvent.click(button);

// Right — real interaction sequence
import userEvent from "@testing-library/user-event";
const user = userEvent.setup();
await user.type(input, "hello");
await user.click(button);
```

`userEvent.setup()` returns an instance; call it once per test and share. The async `await` is mandatory — `userEvent` is async so it can interleave React's scheduling.

## `findBy*` for async, `getBy*` for present, `queryBy*` for absent

Three query families, three jobs. Mixing them produces flaky tests.

- **`getBy*`** — synchronous. Throws if the element is missing. Use when the element is already in the DOM.
- **`findBy*`** — async. Returns a promise that resolves when the element appears, or rejects after a timeout. Use when the element appears after a fetch, a state update, or any post-render async work.
- **`queryBy*`** — synchronous. Returns `null` if missing; does not throw. The only correct choice for negative assertions.

```tsx
// Wrong — getBy throws before the async element renders
expect(screen.getByText(/welcome/i)).toBeInTheDocument();

// Right — findBy waits
expect(await screen.findByText(/welcome/i)).toBeInTheDocument();

// Wrong — getBy throws instead of asserting absence
expect(screen.getByRole("alert")).not.toBeInTheDocument();

// Right — queryBy returns null, assertion passes cleanly
expect(screen.queryByRole("alert")).not.toBeInTheDocument();
```

`findBy*` replaces most `waitFor(() => getBy...)` wrappers and produces clearer failure messages.

## `act()` warnings — fix, do not suppress

`Warning: An update to X inside a test was not wrapped in act(...)` means the test finished while React had pending work. The fix is almost never `await act(async () => ...)` — it is `findBy*` or `waitFor` for the specific element or condition you were checking.

```tsx
// Wrong — console.error noise silenced, flakiness preserved
jest.spyOn(console, "error").mockImplementation(() => {});
render(<AsyncComponent />);

// Right — wait for the assertion's target
render(<AsyncComponent />);
expect(await screen.findByText(/loaded/i)).toBeInTheDocument();
```

The warning exists for a reason; suppressing it hides real race conditions that manifest as intermittent CI failures.

## Snapshot tests — small and targeted

Snapshots of entire component trees capture every class name, every whitespace change, every shadcn internal. One diff in a leaf mutates thousands of lines across unrelated tests, everyone reviews them by hitting `u`, and the snapshot stops encoding intent.

Use snapshots for small, stable outputs: a serialized error object, a generated SQL string, a formatted date. For component structure, prefer explicit assertions — a role, a label, a class. Explicit assertions encode what you care about; snapshots encode everything and nothing.

```tsx
// Wrong — bloat; every className change mutates the snapshot
expect(container).toMatchSnapshot();

// Right — targeted
expect(screen.getByRole("button", { name: /save/i })).toBeEnabled();
expect(screen.getByRole("alert")).toHaveTextContent(/saved/i);
```

## Shallow rendering — skip it

Enzyme's shallow renderer was an artifact of class-component instance testing. React Testing Library has no shallow mode by design — the whole point is to render the component the way the browser does. Code that mocks every child, asserts on instance internals, or reaches for `wrapper.find(ChildComponent).props()` is Enzyme idiom leaking into an RTL codebase.

If a component is too heavy to render in isolation, extract the logic into a hook or a plain function and test that directly. If a child's side effect is noisy, mock the specific module (`jest.mock("./analytics", ...)`) rather than the rendered tree.

## `<button>` vs `<div onClick>`

A native `<button>` is:

- A focusable element in the tab order.
- Announced as "button" by screen readers.
- Activated by Enter and Space keys without any code.
- Given hover, focus-visible, and disabled states by the browser.
- Submits or resets a surrounding `<form>` based on its `type`.

`<div onClick>` is none of those. To match `<button>`'s behavior you need `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter and Space, `aria-pressed`/`aria-disabled` where relevant, plus CSS for every interaction state. Every AI-generated `<div onClick>` is a worse button re-implemented by hand.

```tsx
// Wrong — unreachable by keyboard, invisible to screen readers, no focus ring
<div className="btn" onClick={handleClick}>Save</div>

// Right — native button does the work
<button type="button" onClick={handleClick}>Save</button>

// Only if you genuinely cannot use <button> (e.g. wrapping a link in ARIA weirdness)
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
>
  Save
</div>
```

The same applies to `<a>` for navigation, `<input type="checkbox">` for toggles, and `<details>` for disclosures. Reach for the native element first; reach for ARIA only when no native element fits.

## Icon-only buttons need an accessible name

A button with an icon and no text is a button with no accessible name. Screen readers announce "button" and nothing else. The fix is `aria-label` on the button, or a visually hidden `<span>` with the name.

```tsx
// Wrong — announced as "button" with no context
<button onClick={close}><XIcon /></button>

// Right — aria-label gives it a name
<button aria-label="Close dialog" onClick={close}><XIcon aria-hidden="true" /></button>
```

Mark the icon itself `aria-hidden="true"` so it is not announced separately (SVG icons often include a `<title>` that leaks through otherwise).

## `<img>` needs `alt`

`alt` is not optional. Two cases:

- **Decorative image** — `alt=""` (empty). Screen readers skip it.
- **Meaningful image** — `alt="description of what the image conveys"`. Describe the function or content, not the filename.

Omitting `alt` makes assistive tech fall back to the URL or filename. `alt="image"` is worse than nothing because it confirms the element is an image the user already knows is there.

```tsx
// Wrong
<img src="/hero.png" />
<img src="/hero.png" alt="hero.png" />
<img src="/hero.png" alt="image" />

// Right — decorative background
<img src="/decorative-swirl.png" alt="" />

// Right — meaningful content
<img src="/chart-q3-revenue.png" alt="Q3 revenue up 14% over Q2" />
```

## Form inputs need labels

Every input needs a programmatic name. Three acceptable mechanisms:

- **Explicit `<label htmlFor>`** — the preferred form. Also gives you a larger click target.
- **`aria-label`** — for inputs where a visible label would be redundant (search in a search form).
- **`aria-labelledby`** — pointing to an existing element by id.

`placeholder` is not a label. It disappears on focus, fails WCAG contrast by default, and leaves screen-reader users with nothing.

```tsx
// Wrong
<input type="text" placeholder="Email" />

// Right — explicit label
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// Right — label wraps the input
<label>Email <input type="email" /></label>

// Right — aria-label when visible text would duplicate
<input type="search" aria-label="Search products" />
```

## Keyboard-only users

Every user who cannot use a mouse — power users, screen-reader users, users with motor disabilities — reaches every control by Tab and activates by Enter or Space. An `onClick` without the keyboard counterpart is invisible to this entire population.

The guard rail is semantic HTML: if you use `<button>`, `<a>`, `<input>`, `<select>`, the browser handles Tab, Enter, Space, and focus rings for you. When you must attach `onClick` to a non-interactive element, you also need:

- `tabIndex={0}` — enter the tab order.
- `role` — announce what the element is.
- `onKeyDown` — handle Enter and Space (and call `preventDefault` on Space to stop page scroll).

`jsx-a11y/click-events-have-key-events` and `jsx-a11y/no-static-element-interactions` catch the omission.

## Testing and a11y concerns table

| Concern | Wrong | Right |
|---|---|---|
| Query priority | `screen.getByTestId("save-btn")` | `screen.getByRole("button", { name: /save/i })` |
| Interaction fidelity | `fireEvent.change(input, { target: { value: "hi" } })` | `await user.type(input, "hi")` |
| Async element | `expect(screen.getByText(/loaded/i))` | `expect(await screen.findByText(/loaded/i))` |
| Absence assertion | `expect(screen.getByRole("alert")).not.toBeInTheDocument()` | `expect(screen.queryByRole("alert")).not.toBeInTheDocument()` |
| `act()` warning | `console.error` spy suppresses the warning | `await screen.findBy*` for the awaited state |
| Snapshot scope | `expect(container).toMatchSnapshot()` | Explicit role / text / state assertions |
| Button element | `<div onClick={save}>Save</div>` | `<button onClick={save}>Save</button>` |
| Icon-only button | `<button><XIcon /></button>` | `<button aria-label="Close"><XIcon aria-hidden="true" /></button>` |
| Decorative image | `<img src="/swirl.png" />` | `<img src="/swirl.png" alt="" />` |
| Meaningful image | `<img src="/chart.png" alt="image" />` | `<img src="/chart.png" alt="Q3 revenue up 14%" />` |
| Input label | `<input placeholder="Email" />` | `<label htmlFor="email">Email</label><input id="email" />` |
| Custom interactive | `<div onClick={go}>` | `<div role="button" tabIndex={0} onClick={go} onKeyDown={...}>` |

## Common AI failure modes

- **`getbytestid-over-getbyrole`** — `data-testid` sprinkled across every element and the whole test suite built on `getByTestId`. The test passes and tells you nothing about whether the component is reachable. Every `data-testid` should prompt the question: is this element missing a role or an accessible name? Reach for `getByRole`, `getByLabelText`, `getByText` first; use `getByTestId` only for elements deliberately hidden from assistive tech.
- **`fireevent-over-userevent`** — `fireEvent.change` and `fireEvent.click` used as the default interaction API. Skips focus, keydown, and the event sequence real users generate, hiding bugs in controlled inputs and keyboard shortcuts. Use `userEvent.setup()` and `await user.click/type/keyboard`.
- **`shallow-render-in-rtl`** — Enzyme-style `shallow(...)`, `wrapper.find(Child).props()`, or manual child mocking in an RTL suite. RTL has no shallow renderer by design. Render the real tree; extract testable logic into hooks or plain functions if the tree is genuinely too heavy.
- **`snapshot-bloat`** — whole-component or whole-page `toMatchSnapshot` calls. Every className tweak mutates the snapshot and reviewers rubber-stamp with `u`. Snapshots encode nothing about intent. Use explicit role, text, and state assertions; reserve snapshots for small stable serializations.
- **`act-warning-ignored`** — `console.error` spies silencing *"update not wrapped in act"* warnings. The warning flags a real race. Fix by awaiting `findBy*` or `waitFor` for the specific state you were asserting on.
- **`findby-vs-getby-race`** — `getByText(/loaded/i)` used for text that appears after an async fetch. `getBy` is synchronous; the assertion throws before the element exists. Use `findBy*` for anything awaited and `queryBy*` for absence assertions.
- **`div-as-button`** — `<div onClick={handler}>` where a `<button>` belongs. No focus, no Enter/Space, no role. The accessibility hit is total; the test slop (`getByTestId`) is the symptom. Use `<button type="button">`; the browser wires everything.
- **`missing-aria-label-icon-button`** — icon-only buttons with no accessible name. Screen readers announce "button" and nothing else. Add `aria-label` on the button and `aria-hidden="true"` on the decorative icon.
- **`img-without-alt`** — `<img>` with no `alt` attribute, or `alt="image"`, or `alt="hero.png"`. Empty `alt=""` for decoration; a description of what the image conveys for meaningful content.
- **`form-without-labels`** — `<input placeholder="Email">` with no `<label>`, `aria-label`, or `aria-labelledby`. Placeholders are not labels — they disappear on focus, fail contrast, and leave screen-reader users with nothing. Every input has a programmatic name.

### Avoid

- `getByTestId` as the default query.
  — Tests pass against components that are unreachable by assistive tech; RTL's priority ladder puts it last for a reason.
- `fireEvent.*` for user interactions.
  — Skips the focus/keydown/input/change sequence real users produce; `userEvent` is the default.
- `getBy*` for elements that appear asynchronously.
  — Throws before the element exists; use `findBy*`.
- `getBy*` inverted for absence assertions.
  — Throws instead of asserting absence; use `queryBy*` for `not.toBeInTheDocument`.
- Suppressing `act()` warnings with a `console.error` spy.
  — Hides real race conditions that surface as flaky CI; wait for the specific state with `findBy*`/`waitFor`.
- Whole-tree snapshot tests.
  — Encode everything and nothing; every unrelated change mutates them and reviewers rubber-stamp with `u`.
- Enzyme-style shallow rendering in an RTL suite.
  — RTL has no shallow mode; render the real tree or extract logic into a hook or plain function.
- `<div onClick>` where `<button>` or `<a>` would work.
  — No focus, no keyboard, no role; every native element you skip becomes a worse hand-rolled ARIA puzzle.
- Icon-only buttons with no `aria-label`.
  — Announced as "button" with no context; add `aria-label` and mark the icon `aria-hidden="true"`.
- `<img>` without `alt`, or with `alt="image"` / `alt="filename.png"`.
  — Screen readers fall back to the URL; `alt=""` for decorative, descriptive text for meaningful.
- `placeholder` used as a label.
  — Disappears on focus, fails WCAG contrast, leaves screen-reader users with nothing; use `<label htmlFor>` or `aria-label`.
- `onClick` on a non-interactive element with no `onKeyDown`, `tabIndex`, or `role`.
  — Unreachable by keyboard users; `jsx-a11y/click-events-have-key-events` and `jsx-a11y/no-static-element-interactions` catch it.

See [`../SKILL.md`](../SKILL.md) for the React posture and hard bans.
See [`nextjs-and-rsc.md`](nextjs-and-rsc.md) for the sibling App Router and RSC boundary discipline.
See [`../anti-patterns.md`](../anti-patterns.md) for the named catalog entries on React testing and a11y slop.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core code-craft foundation.
See [`../../../sublime/references/tests.md`](../../../sublime/references/tests.md) for the universal testing discipline that RTL specializes.
See [`../../../anti-patterns/testing-slop.md`](../../../anti-patterns/testing-slop.md) for catalog entries on testing ceremony shared across languages.
See [`../../typescript/SKILL.md`](../../typescript/SKILL.md) and [`../../typescript/references/types.md`](../../typescript/references/types.md) for the event-type and prop-type discipline that makes RTL queries type-safe.
