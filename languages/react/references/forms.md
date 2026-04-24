# Forms

A form is an input-shape contract, not a pile of `useState` calls — either use the platform (uncontrolled inputs plus `FormData`, server actions) or use a form library (react-hook-form), and do not hand-roll ten `useState`s with ten `onChange`s per form.

Every serious form has the same four concerns: the field values, a validation pass over them, a submission action, and feedback during and after that action. The platform already owns three of those — browsers collect field values into `FormData`, `<input required minLength>` validates, forms submit to `action` URLs, and the four built-in input events drive feedback. React layered a controlled-input model on top because some UIs genuinely need per-keystroke awareness of every value. LLM-generated code defaults to controlled everywhere, regardless of whether the component actually needs keystroke-level awareness, and the resulting ten-`useState`-ten-`onChange` files are slop.

## Controlled vs uncontrolled

**Controlled:** React owns the value. `<input value={name} onChange={e => setName(e.target.value)} />`. Use when the UI reacts to every keystroke — live validation on the field, character-count, auto-suggest, conditional rendering based on the value, cross-field derived formatting.

**Uncontrolled:** the DOM owns the value. `<input name="name" defaultValue={initial} ref={ref} />`. Use when the value is only needed at submission — the overwhelming majority of fields. Read it via `FormData` at submit time, or via a ref if you need an imperative handle.

A form is not obligated to pick one posture for every field. A dozen uncontrolled inputs plus one controlled combobox is a perfectly sensible shape. The slop is the opposite default — twelve controlled inputs so you can submit a single object.

```tsx
// Slop — twelve controlled inputs, no reason for any of them.
function ProfileForm() {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // ... eight more
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void api.updateProfile({ first, last, email, phone /* ... */ });
  };
  return (
    <form onSubmit={onSubmit}>
      <input value={first} onChange={e => setFirst(e.target.value)} />
      <input value={last} onChange={e => setLast(e.target.value)} />
      {/* ... */}
    </form>
  );
}

// Fix — uncontrolled + FormData. React owns none of the field values.
function ProfileForm() {
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    void api.updateProfile(data);
  };
  return (
    <form onSubmit={onSubmit}>
      <input name="first" defaultValue="" />
      <input name="last" defaultValue="" />
      <input name="email" type="email" defaultValue="" />
      <input name="phone" type="tel" defaultValue="" />
      {/* ... */}
      <button type="submit">Save</button>
    </form>
  );
}
```

Each `useState` you remove is a re-render you do not cause on every keystroke.

## The `value`-without-`onChange` trap

Passing `value={x}` without an `onChange` handler makes the input read-only and triggers React's "changing an uncontrolled input to be controlled" warning the first time the value changes from `undefined`. The slop shape: LLMs write `value={user?.email}` during initial render, then `onChange` setting `email` state that started as `undefined`. React flips categorization mid-life.

Pick one. If controlled, seed state with `""` (not `undefined`) and always supply `onChange`. If uncontrolled, use `defaultValue`, never `value`.

```tsx
// Slop — undefined becomes string; flips uncontrolled -> controlled.
const [email, setEmail] = useState<string | undefined>();
<input value={email} onChange={e => setEmail(e.target.value)} />;

// Fix — seed a string.
const [email, setEmail] = useState("");
<input value={email} onChange={e => setEmail(e.target.value)} />;

// Or uncontrolled.
<input name="email" defaultValue={initialEmail ?? ""} />;
```

## Platform forms + `FormData`

The Remix / Next.js server-action idiom, and the pattern everyone should reach for first:

```tsx
// Uncontrolled inputs, browser serialization, one submit read.
function NewItemForm() {
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const parsed = ItemSchema.parse(Object.fromEntries(formData));
    await api.createItem(parsed);
    e.currentTarget.reset();
  };
  return (
    <form onSubmit={onSubmit}>
      <input name="title" required />
      <input name="quantity" type="number" min={1} required />
      <select name="category" defaultValue="misc">
        <option value="misc">Misc</option>
        <option value="food">Food</option>
      </select>
      <button type="submit">Add</button>
    </form>
  );
}
```

Three things the platform already did: it collected the field values (`FormData`), it validated presence and type (`required`, `type="number"`, `min`), and it will reset the fields when you call `.reset()` on the form node. You wrote none of that in React.

Parse once, at submit, with a schema. See [../../../sublime/references/data-modeling.md](../../../sublime/references/data-modeling.md) on parse-at-the-boundary.

## react-hook-form for complex forms

When the form has 20+ fields, cross-field validation, dynamic field arrays, or multi-step wizards, reach for [react-hook-form](https://react-hook-form.com/). It uses uncontrolled inputs underneath with a refs registry, so it does not re-render the form on every keystroke, and it integrates with Zod / Valibot / Yup for submit-time parsing.

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  age: z.coerce.number().int().min(18),
});
type FormValues = z.infer<typeof schema>;

function SignupForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });
  const onSubmit = handleSubmit(async (values) => {
    await api.signup(values);
  });
  return (
    <form onSubmit={onSubmit}>
      <input {...register("email")} />
      {errors.email && <p>{errors.email.message}</p>}
      <input {...register("age")} type="number" />
      {errors.age && <p>{errors.age.message}</p>}
      <button disabled={isSubmitting}>Sign up</button>
    </form>
  );
}
```

Do not reach for react-hook-form for a two-field search box; the setup cost is real. Match the tool to the form's size.

## Validation posture

Parse at submit, not on every keystroke. Live-validating every field as the user types produces error messages that appear before the user has finished typing, interrupt their focus, and flash in and out. The platform's own behavior is to validate on blur and on submit, and you should rarely do more than that.

When you do want live validation — password strength, username availability — scope it to the specific field that needs it. Do not run the full schema over the full form on every keystroke of every input.

```tsx
// Slop — re-parses the entire form on every keystroke, flashes errors.
const [values, setValues] = useState<Shape>(initial);
const errors = schema.safeParse(values).error?.flatten().fieldErrors;
return (
  <>
    <input value={values.email} onChange={e => setValues({...values, email: e.target.value})} />
    {errors?.email && <p>{errors.email[0]}</p>}
    {/* ... */}
  </>
);

// Fix — parse once, at submit.
const [errors, setErrors] = useState<FieldErrors | null>(null);
const onSubmit = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const result = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
  if (!result.success) { setErrors(result.error.flatten().fieldErrors); return; }
  setErrors(null);
  void api.save(result.data);
};
```

See sibling [hooks.md](hooks.md) on derived-value rules — re-deriving validation errors during render is fine; storing them in a parallel `useState` alongside the values is the slop.

## Form state scope

A form's state lives in the component that owns the form. Lifting it to Context is almost always wrong — a Context around a form re-renders every subtree under the provider on every keystroke, which is the exact problem uncontrolled inputs solve for free.

Multi-step wizards are the edge case that sometimes justify lifting. Even there, a single `useReducer` in the wizard's root component plus prop passing is cleaner than a Context. Reserve Context for values that cross unrelated subtrees; a form is one tree.

See [state-management.md](state-management.md) on `form-state-in-context` and the broader Context-vs-local-state split.

## Server actions (Next.js 14+)

In Next.js App Router, `action={serverAction}` replaces `onSubmit` + `fetch`. The form submits directly to a server function, progressive enhancement works without JavaScript, and there is no round trip through a client-side fetch layer.

```tsx
// app/items/actions.ts
"use server";
import { z } from "zod";
const ItemSchema = z.object({ title: z.string().min(1), quantity: z.coerce.number().int().min(1) });
export async function createItem(formData: FormData) {
  const parsed = ItemSchema.parse(Object.fromEntries(formData));
  await db.items.create({ data: parsed });
  revalidatePath("/items");
}

// app/items/new/page.tsx
import { createItem } from "../actions";
export default function NewItemPage() {
  return (
    <form action={createItem}>
      <input name="title" required />
      <input name="quantity" type="number" min={1} required />
      <button type="submit">Add</button>
    </form>
  );
}
```

No `onSubmit`, no `fetch`, no `useState` for loading, no manual revalidation. The slop variant — `onSubmit` + `fetch('/api/items', {...})` in a client component — builds a parallel API route for something a server action handles in one file.

## `useActionState` / `useFormStatus` (React 19)

React 19 added two hooks that bind client UI to server-action state cleanly.

`useActionState(action, initialState)` wraps a server action and returns the last result, a dispatch function for the form's `action`, and a `pending` flag. Use it when the form needs to show the result of the submission inline (validation errors from the server, a success message).

`useFormStatus()` reads the submission status of the nearest parent `<form>`. Use it inside a submit button to show a disabled/loading state without threading a prop.

```tsx
// app/login/actions.ts
"use server";
export async function login(prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  try { await auth.signIn(parsed.data); return { ok: true }; }
  catch (e) { return { ok: false, errors: { _form: [(e as Error).message] } }; }
}

// app/login/form.tsx
"use client";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>;
}

export function LoginForm() {
  const [state, action] = useActionState(login, { ok: false });
  return (
    <form action={action}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      {state.errors?._form && <p>{state.errors._form[0]}</p>}
      <SubmitButton />
    </form>
  );
}
```

No `useState` for pending, no `useState` for errors, no `onSubmit` wrapper. The only client-side React is the pieces that genuinely need the client — the disabled button during submission, the inline error message.

## Form-size table

| Form size / shape | Recommended posture | Anti-pattern |
|---|---|---|
| Single input (search, quick filter) | Uncontrolled + `onSubmit` reads `FormData`, or one `useState` for live filtering | Three `useState` + memo + callback ceremony |
| 2–6 fields, submit-only | Uncontrolled + `FormData` + schema parse at submit | One `useState` per field + `onChange` per field |
| 2–6 fields, live validation or dependent fields | Controlled with one state object or per-field `useState`, schema at submit | Re-parsing full schema on every keystroke |
| 10+ fields, complex validation | react-hook-form + Zod resolver | Hand-rolled controlled state + custom error store |
| Any form, Next.js App Router | `action={serverAction}` + `useActionState` + `useFormStatus` | `onSubmit` + client `fetch` + `/api/submit` route |
| Multi-step wizard | `useReducer` in the wizard root, props/slots to steps | Context provider around the form |

## Common AI failure modes

- **`controlled-uncontrolled-confusion`** — `<input value={x} />` with no `onChange`, or `value` seeded as `undefined` and later set to a string. Produces React's "changing an uncontrolled input to be controlled" warning and a field that looks read-only until the user realizes it. Pick a posture per input and commit to it; seed controlled state with `""`, not `undefined`.
- **`validation-everywhere`** — re-parsing the full schema on every keystroke in every field, emitting errors before the user has finished typing. Parse at submit; scope live validation to the one or two fields that genuinely need it (password strength, availability check).
- **`form-state-in-context`** — a single form's values lifted into a Context provider wrapping the form tree. Every keystroke re-renders every consumer, which is the exact problem uncontrolled inputs or react-hook-form's ref registry avoid for free. Keep form state in the form component.
- **`missing-form-action`** — Next.js 14+ project using `onSubmit` + `fetch('/api/...')` + a parallel API route instead of `action={serverAction}`. Server actions remove the round trip, work without client JS, and integrate with `useActionState` / `useFormStatus`. Use them.
- **`onchange-per-field-boilerplate`** — ten fields, ten `useState`s, ten `onChange` handlers, one giant `onSubmit` that packages it all into an object. Every keystroke re-renders the whole form. Replace with uncontrolled inputs + `FormData` for simple forms, or react-hook-form for complex ones.

### Avoid

- `<input value={x} />` without `onChange`, or `useState<string | undefined>()` seeded without a string.
  — React flips the input between uncontrolled and controlled mid-life, warns, and the field appears read-only until the first value is forced in.
- One `useState` per field with one `onChange` per field for submit-only forms.
  — Every keystroke re-renders the whole form for no gain; the platform reads `FormData` at submit without any of it.
- Parsing the full validation schema on every keystroke.
  — Errors flash in and out before the user finishes typing and interrupt focus; parse at submit, scope live checks to the one field that needs them.
- A form's state lifted into Context.
  — Every consumer under the provider re-renders on every keystroke; the form is one tree and owns its own state.
- `onSubmit` + `fetch` + a hand-rolled `/api/submit` route in a Next.js App Router project.
  — Server actions handle submission, revalidation, and progressive enhancement in one file; the parallel API route is a rebuild of something the framework already provides.
- Tracking `isSubmitting` / `isPending` in a `useState` next to a server action.
  — `useFormStatus` reads it from the nearest `<form>` directly; `useActionState` returns a `pending` flag bound to the action.
- Reaching for react-hook-form on a two-field search box.
  — The setup cost outweighs the savings; match the tool to the form's size.
- `value={user?.email}` in an input whose parent might render before `user` loads.
  — Seeds `undefined` into a controlled input; render a skeleton until the value is known, or seed `""`.
- A Context provider wrapping a single multi-step form.
  — `useReducer` in the wizard root with prop passing has the same ergonomics without the re-render scope.

→ Parent skill: [../SKILL.md](../SKILL.md). Core foundation on parse-at-the-boundary that drives validation posture: [../../../sublime/references/data-modeling.md](../../../sublime/references/data-modeling.md). Core foundation: [../../../sublime/SKILL.md](../../../sublime/SKILL.md). Sibling hooks reference for the `useState` / derived-state rules that govern validation shape: [hooks.md](hooks.md). Sibling state-management reference for the state-scope rules and `form-state-in-context` cross-reference: [state-management.md](state-management.md). TypeScript cousin for form-values typing with Zod / Valibot: [../../typescript/SKILL.md](../../typescript/SKILL.md), [../../typescript/references/generics.md](../../typescript/references/generics.md). Shared catalog for input-trust and boundary-validation themes: [../../../anti-patterns/security-and-correctness.md](../../../anti-patterns/security-and-correctness.md). In-extension React anti-patterns: [../anti-patterns.md](../anti-patterns.md).
