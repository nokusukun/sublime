# Control flow & structure

Control flow is the second thing a reader sees, after names, and the first thing that tells them whether the code was written with a plan or generated out of reflex.

The shape of a function is a claim about the problem. A function that flows straight down with two early returns claims the problem is mostly linear with two bailouts. A function with five levels of nesting and a `try/catch` around the whole body claims the problem is a mess. One of those claims is usually a lie, and the lie is almost always the second one. Your job is to make the shape match the problem, not the other way around.

## Taxonomy

The dimension breaks into six sub-topics, each with its own failure mode. Every one of them is recoverable in isolation. What makes control flow hard is that they compound — nested conditionals hide reused variables, reused variables hide state transitions, state transitions hide the god component underneath.

- **Early returns** — the happy path down the left margin.
- **Nesting limits** — the two-level rule and when to extract.
- **The one-screen rule** — if you're scrolling, you're lost.
- **Expression bias** — values, not ceremonies.
- **State-machine modeling** — when `if`-chains are a missing type.
- **The god component** — the 500-line function from one prompt.

---

## Early returns: the happy path down the left margin

The happy path is the sequence of operations that runs when nothing goes wrong. It should be readable without ducking into `else` branches. Every precondition, every missing input, every "not applicable" case bails early. The reader gets to the interesting work on the left margin, at the top of the function.

```
// bad — happy path is buried three levels deep
function process(order) {
  if (order) {
    if (order.items.length > 0) {
      if (order.customer.active) {
        // the actual work, finally
      }
    }
  }
}

// good — happy path is the body
function process(order) {
  if (!order) return
  if (order.items.length === 0) return
  if (!order.customer.active) return
  // the actual work, at the left margin
}
```

The second version is not just shorter. It is *inspectable*: each guard is one line, in one place, at the top, and you can read them as a list. The first version forces you to reconstruct the guard list from a nested tree in your head.

**DO** return early on every precondition, not-found, and not-applicable case.
**DO** order guards from cheapest check to most expensive. A null check before a database call.
**DO NOT** use `else` after an early `return`. The `else` is already implied by the layout.
  — The redundant `else` adds a level of indentation and nothing else.

---

## Nesting limits: two levels, then extract

At three levels of nesting, the control flow stops telegraphing its shape. At four, you are writing code that you cannot review. This is a hard limit, not a guideline.

When you hit two levels and feel the pull toward a third, that is a signal to extract. Not to flatten with more early returns — to *extract*. The thing inside the second level is a concept. Name it.

```
// bad — three levels, the inner block is trying to be a function
for (const user of users) {
  if (user.active) {
    for (const order of user.orders) {
      if (order.status === 'pending') {
        // ten lines of logic
      }
    }
  }
}

// good — the inner concept gets a name
for (const user of users) {
  if (!user.active) continue
  processPendingOrders(user.orders)
}
```

The extracted helper makes the outer loop a one-liner and gives the inner logic a name a future reader can grep. Your natural failure mode is to keep nesting because each added level feels like a small step. Small steps compound into unreadable pyramids.

---

## The one-screen rule

A function should fit on a screen. Not because screens are sacred — because a function that doesn't fit on a screen is almost certainly doing more than one thing, and the reader has to hold both halves in working memory while scrolling.

The rule is not "≤ 40 lines." It is: when the function exceeds one screen, stop and ask what two concepts are fighting inside it. Split along the seam.

| Length | Typical diagnosis | Typical fix |
|---|---|---|
| ≤ 10 lines | healthy | leave alone |
| 10–30 lines | watch for hidden seams | extract if a comment is needed mid-function |
| 30–60 lines | smells like two functions | split along the seam; name both halves |
| 60–150 lines | god function in progress | hard split; extract 2–4 named helpers |
| > 150 lines | see *god component* below | redesign, do not refactor |

The table is descriptive, not prescriptive. A parser or a switch-dispatched reducer can legitimately be long. Most generated functions that cross 60 lines are not those — they are a linear script that wanted to be three functions and never got split.

---

## Expression bias: prefer values to statements

Where the language allows, reach for an expression. Expressions compose, return values, and let you assign the result. Statements do work via side effects and leave the reader to reconstruct what was computed.

```
// statement-shaped — mutate a local across branches
let label
if (status === 'paid') {
  label = 'Paid'
} else if (status === 'pending') {
  label = 'Pending'
} else {
  label = 'Unknown'
}

// expression-shaped — the value comes out whole
const label = match(status, {
  paid: 'Paid',
  pending: 'Pending',
  _: 'Unknown',
})
```

In TypeScript: ternaries for two branches, a lookup object for many, an `exhaustive` switch on a discriminant for state machines. In Python: dict dispatch, comprehensions, `match`. The reflex to reach for `if/else` with mutating assignments is a habit from languages that made expressions hard. You don't have to keep the habit.

**DO** bind the result of a computation to a name on the line it's computed.
**DO** use ternaries for two branches with short arms.
**DO NOT** reuse a variable for two different meanings across a function. Give each meaning its own name.
  — Variable reuse is the bug that the type system cannot see.

---

## State-machine modeling: when if-chains are a missing type

When you find yourself writing `if (status === 'pending') ... else if (status === 'processing') ... else if (status === 'paid') ...` in multiple places, the code is telling you something: you have a state machine and no type for it.

The fix is not "extract a helper." The fix is to model the state with a discriminated union and switch on the tag once, exhaustively. The compiler then tells you every place you forgot a case when a new state appears.

```ts
type Order =
  | { kind: 'pending'; placedAt: Date }
  | { kind: 'processing'; startedAt: Date; workerId: string }
  | { kind: 'paid'; paidAt: Date; amount: number }

function label(order: Order): string {
  switch (order.kind) {
    case 'pending': return `placed ${format(order.placedAt)}`
    case 'processing': return `processing since ${format(order.startedAt)}`
    case 'paid': return `paid ${format(order.paidAt)}`
  }
}
```

The payoff is that `placedAt` is only accessible on `pending`, `amount` is only accessible on `paid`, and adding a fourth state is a compile error at every call site. The `if`-chain version would have silently fallen through and produced the empty string.

---

## The god component: the 500-line function from one prompt

The most recognizable architectural slop pattern in generated code is one massive function or component that does everything — the 500-line React component, the 300-line request handler. It appears because the prompt was "build the checkout page," the model generated it as one artifact, and nothing forced a seam.

Seams exist in your head before they exist in the file. You know the seams from the problem. A checkout page has an address form, a payment widget, an order summary, and a submit flow. Those are four components and at least three hooks. The fact that they can all be typed into one file is not an argument for typing them into one file.

Split as you write. The rule is: if the function you just wrote has a comment that starts with "now we" or "next, we" — that comment is a function boundary trying to escape. Make it escape.

---

## Common AI failure modes

These patterns appear by name in the slop taxonomy. Recognize them on sight.

**Happy-path utopia (1.6)** — generated code assumes every input is well-formed, every network call returns, every file exists. The happy path is the only path. The fix is not to wrap it all in `try/catch` (that's the other failure mode). The fix is to name the actual failure cases and either guard them at the top or model them in the types. If a function can't meaningfully proceed on empty input, guard empty at the top. If it can, handle empty as part of the main logic, not as a surprise.

**God-prompt-component (10.7)** — the 500-line component or 300-line handler generated from one long prompt, with no extracted seams. The tell is not length alone; it is length with no names. A long function of named helpers reading top-to-bottom is fine. A long function where every ten lines is a different concept inlined with the last is not. When you notice it in your own output, stop writing and split. Do not "finish it and clean up later" — you will not clean up later, and neither will the next reader.

**Copy-paste architecture (10.8)** — similar-but-slightly-different logic duplicated across endpoints, handlers, or components. Each copy has a three-character difference that will drift over time. The fix is to extract, but *only after the second caller exists* — do not preempt. Once three callers diverge, the shared concept is the intersection, not the union. Factor what is the same; let the differences stay differences.

---

### Avoid

- Nesting past two levels instead of extracting a named helper.
- Reusing a variable for a second meaning in the same function.
- `if`/`else if` chains on a string tag that should be a discriminated union.
- 300-line handlers and 500-line components generated in one pass.
- Copy-pasted endpoints with three-character deltas.
- Wrapping the happy path in `try/catch` instead of naming the failures.
- `else` branches that exist only because an early `return` would have made them redundant.
- Statement-shaped mutation where an expression would return the value whole.
- Functions whose body reads like a tutorial — "First we…", "Now we…", "Finally we…". Those are function boundaries.
