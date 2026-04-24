# Styling

Pick one styling system and commit; the pervasive LLM slop is 300-character Tailwind strings copy-pasted across five components, arbitrary values the JIT compiler cannot detect, and `styled-components` showing up in a Tailwind project because the training data had both.

The LLM styling failure is compositional: no memory across components, no notion of tokens, no concept of "the project already decided." From [dev.to/avery_code](https://dev.to/): Copilot *"has no memory. It has no notion of what already exists. So it inlines everything. Every time. The same combination of fifteen utilities scattered across four different places."* The output is a 300-character `className` pasted across five buttons, zero of which reference each other. The fix is not to abandon Tailwind — it is to commit to one system, extract variants once the string passes ~200 characters, and refuse to mix styling engines.

## Taxonomy

- **One styling system per project.**
- **The `className` string as a code smell.**
- **`cn()` / `clsx` / `tailwind-merge` for conditional classes.**
- **Arbitrary values and design tokens.**
- **Dynamic template strings in Tailwind.**
- **Tailwind v4 vs v3 syntax.**
- **Inline `style` for truly dynamic values.**
- **The mixed-styling project.**

---

## One styling system per project

Pick Tailwind, CSS Modules, a CSS-in-JS library (`styled-components`, `emotion`, `vanilla-extract`, `panda`), or the framework's built-in system. One. The slop signal is two of these in the same project — a `styled-components` `Button.styled.ts` next to Tailwind `className="px-4 py-2 ..."` in the same feature. LLMs do this because training data contains both and they default to whichever example was closest.

The decision is a commitment one, not a technical one. Tailwind buys token consistency and zero-runtime CSS at the cost of committing every developer to the utility vocabulary. CSS Modules buy full CSS power at the cost of `.module.css` files. Choosing both gets the costs of each with the benefits of neither: two mental models, two debuggers, two override paths, double the bundle.

When adding a component to an existing project, detect the styling system from any existing file and match it.

---

## The `className` string as a smell

A Tailwind `className` over ~200 characters is a review signal. It means one of three things: (1) the component has too many responsibilities and should decompose, (2) the same string appears at multiple call sites and should extract to a variant, or (3) the design has escaped the token system and is freestyling arbitrary values.

```tsx
// slop — 280 characters, copy-pasted across 6 buttons in the app
<button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
  Save
</button>

// fix — one variant-aware component, six call sites call <Button>
import { cva, type VariantProps } from "class-variance-authority";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
  {
    variants: {
      intent: {
        primary: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600",
        secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:outline-gray-400",
      },
    },
    defaultVariants: { intent: "primary" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>;

export function Button({ intent, className, ...props }: ButtonProps) {
  return <button className={button({ intent, className })} {...props} />;
}
```

`cva` (class-variance-authority) and `tailwind-variants` are the two common patterns. The library choice is not the point; what matters is that the long class string lives *once* with a named API on top.

---

## `cn()` / `clsx` / `tailwind-merge`

Conditional classes should never be string-interpolated. Interpolation produces `"bg-red-500 bg-blue-500"` when both branches emit; Tailwind's JIT cannot dedupe conflicts because both classes ship.

```tsx
// slop — conflicting classes ship together
<div className={`px-4 py-2 ${isActive ? "bg-blue-500" : "bg-gray-200"} ${variant === "danger" ? "bg-red-500" : ""}`} />
// isActive && variant === "danger" ships "bg-blue-500 bg-red-500"

// fix — clsx composes, tailwind-merge resolves conflicts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs));

<div className={cn(
  "px-4 py-2",
  isActive ? "bg-blue-500" : "bg-gray-200",
  variant === "danger" && "bg-red-500",
)} />
```

Every Tailwind project needs a `cn()` helper. The shadcn/ui convention composes `clsx` + `tailwind-merge`. Put it in `lib/utils.ts`; use it everywhere a class string has a condition.

---

## Arbitrary values and design tokens

Tailwind's arbitrary value syntax — `w-[427px]`, `bg-[#3b82f6]`, `text-[13.5px]`, `grid-cols-[repeat(auto-fit,minmax(200px,1fr))]` — is an escape hatch for the ~5% of styles tokens do not cover. The LLM failure mode is using it pervasively, because the prompt gave a pixel value and the model translated it literally instead of finding the nearest token.

```tsx
// slop — every value is an escape hatch; tokens are invisible
<div className="w-[427px] h-[64px] px-[17px] py-[9px] bg-[#3b82f6] text-[14px] rounded-[6px]" />

// fix — tokens by default, arbitrary only for the genuinely one-off
<div className="w-full max-w-md h-16 px-4 py-2 bg-blue-500 text-sm rounded-md" />
```

Review prompt for every arbitrary value: *"could a token express this?"* If yes, use the token. If no, document why — a pixel-perfect design spec, an external constraint, a legacy value — inline as a comment.

Tailwind v4's `@theme` directive and v3's `tailwind.config.js` `theme.extend` both define tokens. A project with twenty arbitrary values and an unused `@theme` block is not using the token system.

---

## Dynamic template strings

Tailwind's JIT builds the CSS bundle by scanning source files for class names at build time. It sees literal strings; it does not evaluate JavaScript. `className={`bg-${color}-500`}` does not work — the compiler sees `bg-${color}-500`, no class exists, no CSS is generated, the element renders unstyled.

```tsx
// slop — JIT compiler cannot see "bg-red-500" or "bg-blue-500" here
const Badge = ({ color }: { color: "red" | "blue" | "green" }) => (
  <span className={`bg-${color}-500 text-white`} />
);

// fix — full class names as literals, looked up by key
const colors: Record<"red" | "blue" | "green", string> = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
};

const Badge = ({ color }: { color: keyof typeof colors }) => (
  <span className={cn(colors[color], "text-white")} />
);
```

Alternatively, `safelist` the classes in config. The lookup-map is preferred — class names stay visible in source and the type checker narrows `color` to legal values.

---

## Tailwind v4 vs v3

Tailwind v4 (late 2024+) is a rewrite. Common LLM errors:

- **Config:** v3 uses `tailwind.config.js` with `content`, `theme.extend`. v4 uses CSS-first `@import "tailwindcss"` and `@theme { ... }`; JS config is optional via `@config`.
- **Import:** v3 uses `@tailwind base; @tailwind components; @tailwind utilities;`. v4 uses `@import "tailwindcss";`.
- **Oklch colors:** v4 defaults to oklch; hex colors work but mix differently under opacity.
- **Container queries:** native in v4; v3 required a plugin.
- **`@apply`:** still works; v4 tightens what is allowed in `@layer`.

HN: *"almost always it was them trying to use Tailwind v4 the v3 way because some AI told them so."* Detect version from `package.json` before generating config; do not mix v3 directives into a v4 stylesheet.

---

## Inline `style`

`style={{...}}` is correct for truly dynamic values — a position from `useMeasure`, a transform from a drag handler, a color from a user color-picker. It is wrong for static styles (use the styling system) and wrong for semi-dynamic enums (use the lookup-map above).

```tsx
// correct — truly dynamic, value is a number from a computation
<div style={{ transform: `translateX(${dragX}px)` }} />

// wrong — static, belongs in the styling system
<div style={{ padding: "16px", color: "red", fontWeight: "bold" }} />
// fix: className="p-4 text-red-500 font-bold"
```

Inline style bypasses tokens, cannot compose with `cn()`, is a per-element CSSOM write on every render, and breaks the grep of "where is this color defined." Reserve it for the dynamic case.

---

## Styling tool / strength / slop tell

| Tool | Strength | Slop tell |
|---|---|---|
| Tailwind v4 | Zero-runtime, token-enforced, static extraction | 300-char `className` strings, arbitrary values pervasive, no `cn()` helper |
| Tailwind v3 | Same, older JIT | v4 syntax (`@import "tailwindcss";`, `@theme`) applied to v3 project or vice versa |
| CSS Modules | Full CSS power, scoped, boring | Global `:global()` everywhere; `styles` object accessed by string keys |
| `styled-components` / `emotion` | Dynamic styling with props, theming | Appears in a Tailwind project as a "one-off"; runtime cost ignored |
| `vanilla-extract` / `panda` | Zero-runtime CSS-in-JS with types | Set up and then abandoned for inline Tailwind |
| Inline `style` | Truly dynamic per-render values | Static styles (`padding`, `color`, `fontWeight`) that belong in the system |
| `cva` / `tailwind-variants` | Named variant APIs on top of Tailwind | Absent; variants expressed as long ternary strings |

---

## Common AI failure modes

**`tailwind-class-vomit`** — 200–400-character `className` strings, the same fifteen-utility combination pasted across four buttons, five cards, three modals. No extracted component, no variant abstraction. The canonical LLM Tailwind output. Extract with `cva` or `tailwind-variants` once the string hits a second call site.

**`arbitrary-values-everywhere`** — `w-[427px]`, `bg-[#3b82f6]`, `p-[17px]`, `text-[13.5px]` where tokens would cover. The design system is invisible; every value is an escape hatch. For each arbitrary value, ask whether a token covers it; use the token unless there is a documented reason.

**`missing-cn-clsx-helper`** — conditional classes built with string interpolation. Produces duplicate utilities when conditions overlap; `tailwind-merge` is the only reliable conflict resolver. Every Tailwind project needs `cn()` = `clsx` + `tailwind-merge`; its absence is migration debt.

**`inline-style-props`** — `style={{ padding: "16px", color: "red" }}` used pervasively for static styles the styling system covers. Bypasses tokens, cannot compose with `cn()`, is per-element CSSOM writes. Reserve inline `style` for computed positions, drag transforms, user-picker colors.

**`css-in-js-in-tailwind-project`** — `styled-components` or `emotion` imports in a Tailwind project. Two engines, two runtimes, two mental models. LLMs emit this because training data has both and the nearest prompt example decides. Detect the project's system and match it.

**`tailwind-v4-as-v3`** — v4 project receiving v3-style `tailwind.config.js` advice, v3 `@tailwind` directives, or plugin recommendations for features v4 ships natively. Conversely, v3 project receiving `@import "tailwindcss";` and `@theme` syntax. Check `package.json` first.

---

### Avoid

- Two styling systems in the same project (Tailwind + `styled-components`, CSS Modules + `emotion`).
  — Two mental models, two runtimes, two approaches to overrides; commit to one.
- `className` strings over ~200 characters pasted across more than one call site.
  — The string is a component now; extract it with `cva` or `tailwind-variants` and give it a name.
- Conditional classes assembled by string interpolation instead of `cn()` / `clsx` / `tailwind-merge`.
  — Conflicting utilities ship together; `tailwind-merge` is the only reliable resolver.
- Arbitrary values (`w-[427px]`, `bg-[#3b82f6]`) where a token would cover the case.
  — The design system becomes invisible; every value is an escape hatch.
- Dynamic template strings in Tailwind classes (`bg-${color}-500`).
  — The JIT compiler only sees static strings; the class never appears in the bundle.
- Inline `style={{...}}` for static values (`padding`, `color`, `fontWeight`).
  — Bypasses tokens, breaks grep, costs CSSOM writes; reserve for truly dynamic values.
- Mixing Tailwind v3 and v4 syntax in the same project.
  — v4's CSS-first config, `@import "tailwindcss";`, and `@theme` are incompatible with v3's JS config and `@tailwind` directives.
- Omitting `cn()` / `clsx` / `tailwind-merge` from a Tailwind project.
  — Every conditional class becomes a latent conflict bug.
- Hand-rolling variant logic in a long ternary string instead of `cva` / `tailwind-variants`.
  — The string is unreadable, untyped, and duplicates across components.

See [`../SKILL.md`](../SKILL.md) for the React posture, hard bans, and styling system selection rules.
See [`../anti-patterns.md`](../anti-patterns.md) for the named in-extension catalog of styling slop.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core code-craft foundation.
See [`../../../sublime/references/naming.md`](../../../sublime/references/naming.md) for the token-naming discipline this reference inherits.
See [`../../../anti-patterns/stylistic-tells.md`](../../../anti-patterns/stylistic-tells.md) for cross-language surface-level slop tells.
See [`../../../anti-patterns/boilerplate-and-ceremony.md`](../../../anti-patterns/boilerplate-and-ceremony.md) for the ceremony-vs-commitment framing applied here.
See [`component-architecture.md`](component-architecture.md) for the component-extraction discipline that variant libraries ride on.
See [`rendering-and-performance.md`](rendering-and-performance.md) for the render-cost implications of styling-system choices.
See [`../../typescript/SKILL.md`](../../typescript/SKILL.md) for the discriminated-union patterns `cva` and `tailwind-variants` type against.
