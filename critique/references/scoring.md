# Critique Scoring Guide

Score each of the five code-design dimensions on a 0–4 scale. Be honest — a 4 means genuinely excellent, not "acceptable." Most code lands at 2 or 3, and that is fine. The point of the score is to name what is weakest, so the right verb can act on it.

## The Five Dimensions

### 1. Concept

Does this code solve the right problem, at the right level, in the right place?

**Check for**:
- The problem is clearly stated and the code actually addresses it (not an adjacent problem).
- The chosen level of the stack matches the problem (business logic in domain modules, not in controllers or DB layer).
- The posture matches the code (library-level care on library code, script-level on scripts).
- No out-of-scope work creeping in — the module does *its* thing and nothing else.
- The problem is a real problem, not a hypothetical one the author imagined.

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Wrong problem entirely. The code answers a question nobody asked. |
| 1 | Adjacent to the real problem. Solves something, but not the thing. |
| 2 | Mostly right but scope drift — the module bundles two or three concerns that should be separate. |
| 3 | Right problem, right level. Small amount of scope bleed at the edges. |
| 4 | Clearly and exactly solves the stated problem. A reviewer could state the problem from the code alone. |

### 2. Names

Do the identifiers — variables, functions, types, modules — carry their weight?

**Check for**:
- Names describe what the thing IS or RETURNS, not what it does internally.
- Booleans read as true statements (`isReady`, `hasErrors`, not `ready`).
- Domain vocabulary, not framework vocabulary.
- No `Manager`, `Helper`, `Service`, `Handler`, `Util` suffixes adding no information.
- No type divergence (`UserData` / `UserInfo` / `UserDetails` for one concept).
- Consistent casing within and across files.
- Short names where scope is narrow, full names where scope is wide.

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Generic names everywhere — `data`, `item`, `result`, `handle`, `Manager`. |
| 1 | Many generic names; inconsistent casing; type divergence present. |
| 2 | Mostly specific names, but `Helper`/`Util` appears and at least one concept has two names. |
| 3 | Names match the domain; minor inconsistencies. |
| 4 | Every name would survive reading aloud to someone unfamiliar with the code. No divergence. |

### 3. Structure

Is the control flow, file layout, and function shape inspectable?

**Check for**:
- Early returns on failure; happy path down the left margin.
- One conceptual level of abstraction per function.
- No function longer than a screen; no nesting beyond two levels without extraction.
- No god components or 300-line handlers generated from one prompt.
- Files have a name that describes contents (no `utils.ts`, `helpers.ts`, `common.ts`).
- No copy-paste across endpoints or modules.

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | A single god function or god component. No extracted seams. |
| 1 | One or more oversized functions, deep nesting, copy-paste duplication. |
| 2 | Most functions are appropriately sized; one or two need extraction. |
| 3 | Clean control flow, good extraction, small files that describe themselves. |
| 4 | Every function fits on one screen, does one thing, and could be reviewed in isolation. |

### 4. Abstraction fit

Is the right amount of abstraction present — no more, no less?

**Check for**:
- Every abstraction has at least two real, current callers.
- No Factories, Builders, Strategies, Providers, or interfaces for a single implementation.
- No premature generics; no over-parameterized functions.
- Copy-paste duplication is not masquerading as "independent implementations."
- The level of abstraction matches the posture (library gets more; script gets less).

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Factory/Strategy spam, or copy-paste everywhere with no abstraction. Both extremes equally wrong. |
| 1 | Several speculative abstractions with one caller; or duplication begging to be lifted. |
| 2 | Abstraction is roughly right but one or two callers are still waiting to be lifted, or one factory is decorating nothing. |
| 3 | Abstractions earn their keep; duplication is limited to cases under the threshold. |
| 4 | Every abstraction has a second caller today. Nothing is speculative. Nothing is crying to be extracted. |

### 5. Interface

Would a new caller write natural-looking code against this module?

**Check for**:
- The call site reads as a sentence: `customer.recentOrders.total()`, not `customer.data.total()`.
- No boolean flag parameters; 3+ parameters use an options object.
- Accepts the widest reasonable input; returns the narrowest reasonable output.
- Public surface is small; internal helpers stay private.
- Error cases are modeled (result types, typed exceptions), not `null`-as-channel.
- The common case is the shortest call.

**Scoring**:
| Score | Criteria |
|-------|----------|
| 0 | Boolean flag cascades (`render(page, true, false, true)`), leaked internals, nullable-error-channels. |
| 1 | Multiple design smells at the call site — any caller must peek at the definition to use it. |
| 2 | Usable with one read of the definition; a few rough edges. |
| 3 | Reads cleanly at the call site; the common case is short. |
| 4 | The call site reads as English. A new caller writes correct code on the first try. |

---

## Scoring the overall design

Sum the five dimension scores. The total is out of 20.

| Total | Grade |
|-------|-------|
| 18–20 | Exceptional. Ship and study. |
| 14–17 | Good. Small edits; ready for review. |
| 10–13 | Mixed. Identify the weakest dimension and run the matching verb. |
| 5–9 | Needs rework. The design itself is off; patching won't save it. |
| 0–4 | Scrap and restart with a better concept. |

---

## Using the scores

Each low-scoring dimension maps to a follow-up sublime verb. The score is not the point; the verb it unlocks is.

| Weak dimension | Follow-up verb | What it will do |
|----------------|----------------|-----------------|
| Concept | (none — the human must revisit the problem statement) | A verb cannot rescue wrong-problem code. |
| Names | [`name`](../SKILL.md) | Run the anti-attractor procedure on every identifier. |
| Structure | [`refactor`](../../refactor/SKILL.md) | Restructure without changing behavior. |
| Abstraction fit | [`simplify`](../../simplify/SKILL.md) if over; [`extract`](../../extract/SKILL.md) if under | Remove one direction, add the other only with a second caller. |
| Interface | [`refactor`](../../refactor/SKILL.md) with call-site-first rewrite | Rewrite the signature before the implementation. |

Re-run `critique` after the follow-up to see the score lift. The goal is not 20/20 — the goal is that the *weakest* dimension is no longer the bottleneck to shipping.

### Avoid

- Scoring generously to move on.
- Averaging the dimensions instead of naming the weakest.
- Treating a 4 as "no issues here" — it means "genuinely excellent," which is rare.
- Scoring Concept based on "does it work" rather than "does it solve the right problem."
- Skipping the follow-up verb recommendation — the score is the means, not the end.
