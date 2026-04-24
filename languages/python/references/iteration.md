# Iteration and comprehensions

Python's iteration is the language's best feature; a manual `for i in range(len(x))` loop is a sign the writer does not speak Python.

Everything in Python is iterable or can be made so, and the language gives you a dense vocabulary for walking data: comprehensions, generator expressions, `enumerate`, `zip`, `itertools`, `any`, `all`, `sum`, `Counter`, `defaultdict`, `deque`. The idiomatic author reaches for these first; the slop-prone author translates a `for (int i = 0; i < n; i++)` from Java, accumulates into a list with `append`, and reimplements `Counter` in four lines. Every such loop is a missed opportunity to say what you mean in one line.

## Taxonomy

- **List comprehensions — when they replace a loop cleanly.**
- **Generator expressions and laziness.**
- **`enumerate`, `zip`, `itertools` — the idiomatic building blocks.**
- **`filter`, `map` vs comprehensions.**
- **Short-circuit with `any`, `all`, and generator expressions.**
- **`collections.Counter`, `defaultdict`, `deque`.**
- **`itertools.chain.from_iterable`, `groupby`, `islice`.**
- **Mutation during iteration.**
- **Walrus `:=` in comprehensions (3.8+).**

---

## List comprehensions

A list comprehension replaces a three-line append loop with one expression. Use it when the loop's job is "produce a new list from an old one, with a per-element transform and/or filter."

```python
# loop slop
out: list[int] = []
for x in xs:
    if x > 0:
        out.append(x * x)

# comprehension
out = [x * x for x in xs if x > 0]
```

Comprehensions read cleanly up to two `for` clauses and one `if`. Past that, write the loop — readability beats compression.

**DO** prefer the comprehension when the intent is "list-from-list."
**DO NOT** use a comprehension for side effects. `[print(x) for x in xs]` builds a throwaway list; write `for x in xs: print(x)`.

---

## Generator expressions and laziness

Swap brackets for parentheses and you have a generator expression: lazy, one-pass, memory-constant. Reach for this when feeding `sum`, `any`, `all`, `min`, `max`, a `for` loop, or any function that takes an iterable.

```python
total = sum(x * x for x in xs if x > 0)       # no intermediate list
found = any(is_valid(x) for x in xs)          # short-circuits on first True

# wrong — materializes the whole list, defeats short-circuit
found = any([is_valid(x) for x in xs])
```

That is `materialized-where-generator-works`. Ruff's `C419` flags it. Default to the generator expression in `any`/`all`/`sum`/`min`/`max` unless you need the list afterward.

---

## `enumerate`, `zip`, `itertools`

Three tools eliminate nearly every index-based loop.

```python
# slop → idiomatic
for i in range(len(items)): print(i, items[i])
for i, item in enumerate(items): print(i, item)

# slop → idiomatic
for i in range(len(names)): print(names[i], scores[i])
for name, score in zip(names, scores, strict=True): print(name, score)
```

`zip`'s `strict=True` (3.10+) raises on length mismatch — pass it unless you have explicitly decided silent truncation is correct.

`itertools` is the standard library's iterator algebra:

```python
from itertools import chain, islice, groupby, pairwise, batched

flat = list(chain.from_iterable(nested))
first_ten = list(islice(stream, 10))
for key, group in groupby(sorted_rows, key=lambda r: r.team): ...
for a, b in pairwise(xs): ...              # 3.10+
for chunk in batched(xs, 3): ...           # 3.12+
```

`groupby` requires input sorted by the key — otherwise it only groups adjacent runs. Every Python engineer has hit that bug once.

---

## `filter`, `map` vs comprehensions

`filter` and `map` still work, but a comprehension is almost always the better choice.

```python
# uncommon
squared = list(map(lambda x: x * x, xs))
positives = list(filter(lambda x: x > 0, xs))

# idiomatic
squared = [x * x for x in xs]
positives = [x for x in xs if x > 0]
```

The comprehension reads as a sentence; `map`/`filter` with a lambda reads as an incantation. Exception: when you already have the function by name (`map(str.strip, lines)`), either form is fine.

---

## Short-circuit with `any`, `all`, `sum`

`any` and `all` short-circuit on the first decisive element — only helpful if the input is lazy. Always pair with a generator expression.

```python
ok = all(validate(x) for x in xs)            # short-circuits
ok = all([validate(x) for x in xs])          # wrong; runs every validate first

total = sum(order.amount for order in orders if order.billed)
```

For a non-default zero use `sum(items, start=[])`, though `itertools.chain.from_iterable` is usually the better call for flattening.

---

## `collections.Counter`, `defaultdict`, `deque`

Reaching into `collections` is how you avoid reinventing basic container behavior.

```python
from collections import Counter, defaultdict, deque

tallies = Counter(word.lower() for word in words)
top_five = tallies.most_common(5)

by_team: defaultdict[str, list[Player]] = defaultdict(list)
for player in players:
    by_team[player.team].append(player)

recent: deque[Event] = deque(maxlen=1000)
recent.append(event)                          # drops the oldest when full
```

Slop version — four lines of noise reinventing one-line stdlib intent:

```python
tallies[key] = tallies.get(key, 0) + 1                 # use Counter
if k not in by_team: by_team[k] = []; by_team[k].append(v)  # use defaultdict(list)
```

---

## `itertools.chain.from_iterable`, `groupby`, `islice`

Three recipes worth memorizing.

```python
from itertools import chain, groupby, islice

flat = list(chain.from_iterable(nested))               # flatten one level
rows.sort(key=lambda r: r.team)
for team, members in groupby(rows, key=lambda r: r.team):
    roster[team] = list(members)
head = list(islice(generate_forever(), 100))           # first N lazily
```

`chain.from_iterable` is the lazy idiomatic flatten; `[x for sub in nested for x in sub]` is the comprehension form. Both are fine; the slop version is a nested `for` loop that appends into a pre-declared list.

---

## Mutation during iteration

Mutating a container while iterating over it is either undefined (dicts, sets) or a guaranteed off-by-one bug (lists). Iterate over a copy, collect changes and apply them after, or build a new container.

```python
# wrong — off-by-one
for item in items:
    if is_stale(item):
        items.remove(item)

# right — filter into a new list
items = [item for item in items if not is_stale(item)]

# wrong for dicts — RuntimeError: dictionary changed size during iteration
for key, value in cache.items():
    if expired(value):
        del cache[key]

# right — collect keys first
for key in [k for k, v in cache.items() if expired(v)]:
    del cache[key]
```

---

## Walrus `:=` in comprehensions (3.8+)

The walrus binds a value inside an expression. In comprehensions, it avoids recomputing an expensive predicate twice.

```python
results = [parse(line) for line in lines if parse(line) is not None]  # twice
results = [parsed for line in lines if (parsed := parse(line)) is not None]  # once
```

Use it when the name improves readability or avoids duplicated work. Walrus inside an already-dense comprehension means the comprehension is doing too much — write the loop.

---

## Iteration tool comparison

| Tool | Lazy | Single-pass | When to use | Anti-pattern it replaces |
|---|---|---|---|---|
| List comprehension `[f(x) for x in xs]` | No | Yes | Build a new list from an old one | `out=[]; for x in xs: out.append(f(x))` |
| Generator expression `(f(x) for x in xs)` | Yes | Yes | Feed `sum`/`any`/`all`/`for`/function | Materialized list when you never need one |
| `enumerate(xs)` | Yes | Yes | Index + value together | `for i in range(len(xs)): xs[i]` |
| `zip(a, b, strict=True)` | Yes | Yes | Parallel iteration, equal-length check | `for i in range(len(a)): a[i], b[i]` |
| `itertools.chain.from_iterable` | Yes | Yes | Flatten one level | Nested `for` + `append` |
| `itertools.islice` | Yes | Yes | Take/skip N lazily | `xs[:n]` on a stream |
| `itertools.groupby` | Yes | Yes (sorted input) | Adjacent runs of equal key | Manual `if prev != cur` |
| `itertools.pairwise` (3.10+) | Yes | Yes | Overlapping pairs | `for i in range(len(xs)-1)` |
| `itertools.batched` (3.12+) | Yes | Yes | Fixed-size chunks | Manual `islice` loop |
| `collections.Counter` | N/A | — | Count occurrences | `d[k] = d.get(k,0)+1` |
| `collections.defaultdict(list)` | N/A | — | Group-by / multimap | `if k not in d: d[k] = []` |
| `collections.deque(maxlen=N)` | N/A | — | Bounded ring buffer, O(1) ends | `list.pop(0)` (O(n)) |
| `any`/`all` + generator | Yes | Yes | Short-circuit predicate | `any([...])` materializes first |
| `sum` + generator | Yes | Yes | Reduce to a number | `sum([x*x for x in xs])` |
| `"".join(iter)` | Yes | Yes | Concatenate strings | `s = ""; s += piece` in a loop |
| `set(xs)` + `in` | N/A | — | Repeated membership tests | `if x in big_list` in a loop |

The pattern: the idiomatic tool is lazy, single-pass, and stdlib. The anti-pattern is a manual loop that reinvents it.

---

## Common AI failure modes

**`range-len-loop`** — `for i in range(len(items)): item = items[i]`. The #1 sign a Python author came from Java. Rewrite as `for item in items:`, or `for i, item in enumerate(items):` when the index is needed. Ruff `SIM113` and pylint `C0200` flag it.

**`parallel-indexing-miss`** — iterating with `range(len(a))` to index both `a[i]` and `b[i]`. Silently assumes equal length; mismatches produce `IndexError` in one direction and silent truncation in the other. Use `zip(a, b, strict=True)`.

**`reinvented-counter-defaultdict`** — `d[k] = d.get(k, 0) + 1` or `if k not in d: d[k] = []; d[k].append(v)`. Four lines reinventing `Counter` and `defaultdict`. One-line rewrite after `from collections import Counter, defaultdict`.

**`manual-flatten`** — nested `for` loops appending into a pre-declared list. `itertools.chain.from_iterable(nested)` does it lazily; `[x for sub in nested for x in sub]` does it eagerly. Either beats the manual version.

**`append-not-comprehension`** — `out = []; for x in xs: out.append(f(x))`. The canonical slop loop — a comprehension spelled out in three lines. Ruff `PERF401` flags it. Exception: when the body is genuinely more than one expression, name it as a function.

**`materialized-where-generator-works`** — `sum([x*x for x in xs])`, `any([cond(x) for x in xs])`. Brackets build a list that `sum` immediately discards; inside `any`/`all` they defeat short-circuiting. Drop the brackets. Ruff `C419`.

**`string-plus-in-loop`** — `s = ""; for piece in pieces: s += piece`. CPython sometimes optimizes to O(n), but the guarantee is O(n²) and optimization varies across runtimes (PyPy, GraalPy). `",".join(pieces)` is O(n), portable, and one line.

**`list-membership-in-loop`** — `for x in xs: if x in big_list: ...`. Every `in big_list` is O(n); the outer loop makes it O(n·m). Convert `big_list` to a `set` once outside the loop; the inner check becomes O(1). The single most common performance pitfall in otherwise-correct Python.

---

### Avoid

- `for i in range(len(x))` when you want `for item in x` or `enumerate`.
  — C-to-Python transliteration; breaks for non-sequence iterables.
- `zip(a, b)` without `strict=True` when lengths should match.
  — Silent truncation hides data-shape bugs.
- `out = []; for x in xs: out.append(f(x))` when a comprehension works.
  — Three lines that say what one line says; Ruff `PERF401`.
- `sum([...])`, `any([...])`, `all([...])` with brackets.
  — Materializes, defeats short-circuit; drop the brackets.
- `s = ""; s += piece` inside a loop.
  — O(n²) on most runtimes; use `",".join(pieces)`.
- `if x in big_list` inside a loop.
  — O(n·m); convert to `set` once, pay O(1) per check.
- `d[k] = d.get(k, 0) + 1` for counting, or `if k not in d: d[k] = []` for grouping.
  — `Counter` and `defaultdict(list)` are one-liners.
- Nested `for` loops that exist to flatten one level.
  — `itertools.chain.from_iterable` or a two-clause comprehension.
- Mutating a list, dict, or set while iterating over it.
  — Undefined for dicts/sets; off-by-one for lists. Copy-or-collect first.
- `filter(lambda x: ..., xs)` / `map(lambda x: ..., xs)` where a comprehension reads better.
  — Comprehension reads as a sentence; lambda inside `filter` rarely does.
- `list.pop(0)` in a loop.
  — O(n) per call; `collections.deque` is O(1) at both ends.
- `[side_effect(x) for x in xs]` discarded for the side effect.
  — Wrote a list to throw it away; write the loop.
- Dense comprehensions with three `for` clauses and multiple `if` clauses.
  — Past two clauses, readability loses; write a named function.

See [`../SKILL.md`](../SKILL.md) for Python posture and slop tells.
See [`../anti-patterns.md`](../anti-patterns.md) for `manual-loop-instead-of-comprehension` and `stdlib-reimplementation`.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core foundation.
See [`../../../sublime/references/readability.md`](../../../sublime/references/readability.md) for clarity discipline.
See [`../../../anti-patterns/reinvention.md`](../../../anti-patterns/reinvention.md) for stdlib-reimplementation entries.
See [`decorators.md`](decorators.md) and [`imports-and-packaging.md`](imports-and-packaging.md) for sibling Python references.
