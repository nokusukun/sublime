# Standard library

Go's standard library moves, and LLM training data does not keep up — `slices`, `maps`, `cmp.Ordered`, `strings.Cut`, `errors.Join`, and the `ioutil` deprecation are the fault lines that produce the loudest training-corpus-lag slop; pin your Go version and lean into the modern idioms.

Go's standard library is one of the few that treats backward compatibility as a contract and still ships meaningful additions every release. The Go team's own [go fix blog post](https://go.dev/blog/gofix) acknowledges the consequence: LLMs trained on the corpus-at-large *"refused to use the newer ways even when directed to do so in general terms such as 'always use the latest idioms of Go 1.25.'"* Know what moved and when, so the generic `for`-loop the model reaches for becomes a one-liner from `slices` or `maps`.

## Taxonomy

- **`slices` (1.21+) — the container-operation package.**
- **`maps` (1.21+) — keys, values, clone.**
- **`cmp.Ordered` vs `golang.org/x/exp/constraints.Ordered`.**
- **Built-in `min` / `max` (1.21+).**
- **`strings.Cut` (1.18+) — the SplitN replacement.**
- **`io` vs `io/ioutil` — the 1.16 deprecation.**
- **`errors.Join` (1.20+) — multi-error values.**
- **`sort.Slice` / `sort.Ints` / `sort.Strings` — deprecated in favor of `slices`.**
- **Generics — when they earn their keep.**
- **The hallucinated generic method.**

---

## `slices` (1.21+)

Every manual loop that checks containment, sorts, finds an index, or binary-searches has a one-liner in `slices`. These are not style preferences — they are faster and the idiom `modernize` auto-fixes to.

```go
// manual — the training-corpus shape
for _, u := range users {
    if u == target { return true }
}
return false

// modern
slices.Contains(users, target)
```

| Operation | Manual | Modern |
|---|---|---|
| Linear search | `for ... { if x == t { return true } }` | `slices.Contains(s, t)` |
| Sort ordered type | `sort.Slice(s, func(i,j int) bool { return s[i] < s[j] })` | `slices.Sort(s)` |
| Sort custom key | `sort.Slice(s, lessFn)` | `slices.SortFunc(s, cmpFn)` |
| Find index | `for i, x := range ... ` | `slices.Index(s, t)` |
| Binary search | hand-rolled | `slices.BinarySearch(s, t)` |
| Reverse / Delete | index gymnastics | `slices.Reverse` / `slices.Delete` |
| Min / max of slice | running-minimum loop | `slices.Min(s)` / `slices.Max(s)` |

`slices.SortFunc` takes a comparator returning `int` (negative/zero/positive). Do not return `bool` — that's `sort.Slice`'s signature and a common transcription bug.

```go
slices.SortFunc(users, func(a, b User) int { return cmp.Compare(a.Name, b.Name) })
```

---

## `maps` (1.21+)

Three operations moved out of manual-loop territory: `Keys`, `Values`, `Clone`. Paired with `slices.Sorted` (1.23+) they replace the canonical "iterate and sort" pattern entirely.

```go
// manual
keys := make([]string, 0, len(m))
for k := range m { keys = append(keys, k) }
sort.Strings(keys)

// modern (1.23+)
keys := slices.Sorted(maps.Keys(m))
```

`maps.Keys` and `maps.Values` return `iter.Seq`; pipe through `slices.Collect` for an unordered slice, `slices.Sorted` for an ordered one. `maps.Clone` replaces the shallow-copy loop.

---

## `cmp.Ordered` vs `constraints.Ordered`

Since 1.21, the canonical ordered constraint is `cmp.Ordered` in the standard library. `golang.org/x/exp/constraints` is frozen and should not appear in new code.

```go
// slop
import "golang.org/x/exp/constraints"
func Max[T constraints.Ordered](a, b T) T { ... }

// modern
import "cmp"
func Max[T cmp.Ordered](a, b T) T { ... }

// better — built-in min / max (1.21+)
_ = max(a, b)
_ = min(a, b)
```

staticcheck `SA1019` flags the `x/exp` import; `modernize`'s minmax analyzer flags the hand-rolled generic.

---

## `strings.Cut` (1.18+)

`strings.Cut(s, sep)` returns `(before, after, found)`. It replaces every `strings.SplitN(s, sep, 2)` pattern — faster, no index-out-of-range panic risk, and makes the missing-separator case explicit.

```go
// slop
parts := strings.SplitN(s, "=", 2)
key, value := parts[0], parts[1] // panics if sep absent

// modern
key, value, ok := strings.Cut(s, "=")
if !ok { return fmt.Errorf("missing '=' in %q", s) }
```

Same for `bytes.Cut` and `strings.CutPrefix` / `CutSuffix` (1.20+). `modernize stringscut` auto-rewrites.

---

## `io` vs `io/ioutil`

`io/ioutil` is deprecated as of Go 1.16 (2021). Its functions live on in `io` and `os`:

| Deprecated | Replacement |
|---|---|
| `ioutil.ReadAll` | `io.ReadAll` |
| `ioutil.ReadFile` | `os.ReadFile` |
| `ioutil.WriteFile` | `os.WriteFile` |
| `ioutil.TempFile` | `os.CreateTemp` |
| `ioutil.TempDir` | `os.MkdirTemp` |
| `ioutil.NopCloser` | `io.NopCloser` |
| `ioutil.Discard` | `io.Discard` |

An `ioutil` import in 2026 code is a training-cutoff fingerprint; staticcheck `SA1019` flags every call. The package still works, but no new code should reach for it.

---

## `errors.Join` (1.20+)

Aggregating multiple errors no longer requires a third-party library.

```go
var errs []error
for _, f := range files {
    if err := process(f); err != nil {
        errs = append(errs, fmt.Errorf("%s: %w", f, err))
    }
}
if err := errors.Join(errs...); err != nil { return err }
```

`errors.Is` and `errors.As` walk joined errors automatically. Drop `hashicorp/go-multierror` and `uber.org/multierr` from new code.

---

## `sort.Slice` / `sort.Ints` / `sort.Strings`

`sort.Ints` and `sort.Strings` are deprecated. `sort.Slice` is superseded by `slices.Sort` (ordered types) and `slices.SortFunc` (custom comparators).

```go
// slop
sort.Ints(ns)
sort.Slice(users, func(i, j int) bool { return users[i].Name < users[j].Name })

// modern
slices.Sort(ns)
slices.SortFunc(users, func(a, b User) int { return cmp.Compare(a.Name, b.Name) })
```

The comparator signature changed — `int`, not `bool`. Do not transcribe the `sort.Slice` body directly.

---

## Generics — when they earn their keep

Ian Lance Taylor: *"if the implementation is different for each type, then use an interface type and write different method implementations, don't use a type parameter."*

Generics are right for container-agnostic helpers — `slices.Contains`, a typed `Set[T]`, a `sync.Pool[T]`. They are wrong when:

```go
// slop — one caller, one type
func ProcessUser[T any](u T) error { ... }
ProcessUser(x) // only call site

// fix — drop the type parameter
func ProcessUser(u User) error { ... }

// slop — type parameter where interface works
func Write[W io.Writer](w W, p []byte) { w.Write(p) }

// fix
func Write(w io.Writer, p []byte) { w.Write(p) }
```

A type parameter earns its place when behavior is identical across types. In handler code, `io.Writer` is the cleaner shape. Type parameter names follow stdlib convention: single uppercase letters (`K`, `V`, `T`, `E`) — `TKey`, `TValue`, `TypeOfThing` are C#/Java style.

---

## The hallucinated generic method

Go does **not** allow methods to declare their own type parameters. LLMs fluent in C# and Kotlin hallucinate the syntax, and it appears in PRs before compilation catches it.

```go
// slop — does not compile
func (c *Cache) Get[T any](k string) (T, bool) { ... } // syntax error

// fix — free function
func CacheGet[T any](c *Cache, k string) (T, bool) {
    v, ok := c.m[k]
    if !ok { var zero T; return zero, false }
    t, ok := v.(T)
    return t, ok
}

// or — parameterize the type itself
type Cache[V any] struct { m map[string]V }
func (c *Cache[V]) Get(k string) (V, bool) { v, ok := c.m[k]; return v, ok }
```

The compiler error is `method must have no type parameters`. The fix is free-function form or a parameterized type.

---

## Stdlib symbol movement

| Symbol | Replaced | Since |
|---|---|---|
| `slices.Contains` | manual loop | 1.21 |
| `slices.Sort` | `sort.Ints`, `sort.Strings`, `sort.Slice` (ordered types) | 1.21 |
| `slices.SortFunc` | `sort.Slice` (custom comparator) | 1.21 |
| `slices.Index`, `slices.BinarySearch` | manual search loops | 1.21 |
| `slices.Delete`, `slices.Insert`, `slices.Reverse` | copy/append gymnastics | 1.21 |
| `slices.Sorted(maps.Keys(m))` | manual keys-plus-sort | 1.23 |
| `maps.Keys`, `maps.Values`, `maps.Clone` | manual range loops | 1.21 |
| `cmp.Ordered` | `golang.org/x/exp/constraints.Ordered` | 1.21 |
| built-in `min` / `max` | `math.Max` (float-only), hand-rolled generics | 1.21 |
| `strings.Cut`, `bytes.Cut` | `SplitN(..., 2)` + index arithmetic | 1.18 |
| `strings.CutPrefix`, `strings.CutSuffix` | `HasPrefix` + slice arithmetic | 1.20 |
| `io.ReadAll`, `os.ReadFile`, etc. | `io/ioutil.*` | 1.16 |
| `errors.Join` | third-party multierror libraries | 1.20 |
| `errors.Is` / `errors.As` on joined errors | manual walking | 1.20 |
| loop-var per-iteration semantics | `v := v` shadow inside loops | 1.22 |

---

## Common AI failure modes

**`manual-contains-loop`** — `for _, x := range s { if x == t { return true } }` instead of `slices.Contains(s, t)`. The [go fix post](https://go.dev/blog/gofix) singled this out as the canonical training-corpus shape. `modernize slicescontains` auto-fixes.

**`manual-keys-values-loop`** — hand-rolled `keys := []K{}; for k := range m { ... }`. Replace with `slices.Collect(maps.Keys(m))` or `slices.Sorted(maps.Keys(m))`.

**`ioutil-post-deprecation`** — any `ioutil.*` symbol in new code. Deprecated since 1.16; replace with `io` / `os` equivalents.

**`split-instead-of-cut`** — `strings.SplitN(s, sep, 2)` plus index arithmetic. `strings.Cut` returns a `found` bool so the missing-separator case is explicit.

**`sort-slice-over-slices-sort`** — `sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })` where `slices.Sort(s)` works. Also `sort.Ints`, `sort.Strings`, `sort.Float64s` for ordered types.

**`generic-for-single-caller`** — `func Do[T any](x T)` with one instantiation. The type parameter is ceremony.

**`generic-where-interface-works`** — `func Log[W io.Writer](w W, msg string)` when the body only calls `io.Writer` methods. The interface form is identical at the call site.

**`verbose-type-param-names`** — `TKey`, `TValue`, `TypeOfThing`. Stdlib uses single uppercase: `K`, `V`, `T`.

**`over-constrained-param`** — `[T constraints.Ordered]` on the frozen `x/exp` package, or a hand-rolled `Max[T]` when built-in `max` works. Both flag through staticcheck `SA1019`.

**`generic-method-hallucination`** — `func (c *Cache) Get[T any](...)`. Not legal Go. Lift to a free function or parameterize the receiver type.

---

### Avoid

- Manual `for _, x := range s { if x == t { return true } }` containment loops.
  — `slices.Contains` has existed since 1.21 and reads as the intent.
- Manual `keys := []K{}; for k := range m { ... }` loops.
  — `maps.Keys` returns an iterator; pipe through `slices.Collect` or `slices.Sorted`.
- Any `ioutil.*` symbol in post-2021 code.
  — Deprecated since 1.16; flags through staticcheck `SA1019`.
- `strings.SplitN(s, sep, 2)` + index arithmetic.
  — `strings.Cut` is the stdlib replacement and makes the missing-separator case explicit.
- `sort.Ints`, `sort.Strings`, `sort.Float64s`, `sort.Slice` for ordered types.
  — `slices.Sort` and `slices.SortFunc` are the replacements; the `sort` variants are deprecated.
- `golang.org/x/exp/constraints.Ordered` in new code.
  — The package is frozen; `cmp.Ordered` is the stdlib canonical.
- Hand-rolled `Max[T]` / `Min[T]` generics.
  — Built-in `min` / `max` since 1.21 work on any ordered type.
- Type parameters on functions called with one concrete type.
  — The parameter is ceremony; use the concrete type.
- Type parameters where an interface would express the constraint identically.
  — `io.Writer`, `io.Reader`, `fmt.Stringer` are not slop to reach for.
- `TKey`, `TValue`, `TypeOfThing`-style type parameter names.
  — Stdlib uses single uppercase letters; follow it.
- `func (r *Receiver) Method[T any](...)` — methods with their own type parameters.
  — Not legal Go. Lift to a free function or parameterize the receiver type.
- Third-party multierror libraries for new code.
  — `errors.Join` covers the case; `errors.Is` / `errors.As` walk joined errors.

See [`../SKILL.md`](../SKILL.md) for the Go posture and version pinning.
See [`../anti-patterns.md`](../anti-patterns.md) for the named catalog entries on stdlib-blindness.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core code-craft foundation.
See [`../../../sublime/references/dependencies.md`](../../../sublime/references/dependencies.md) for the dependency-minimization discipline.
See [`../../../anti-patterns/dependency-slop.md`](../../../anti-patterns/dependency-slop.md) for catalog entries on third-party-over-stdlib patterns.
See [`structure.md`](structure.md) for package organization and type design.
See [`testing-and-http.md`](testing-and-http.md) for testing and HTTP server idioms.
