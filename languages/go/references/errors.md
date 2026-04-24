# Errors

Errors are values; handle them once, wrap them with context, and do not swallow, duplicate, or discard them — `if err != nil { return err }` without `fmt.Errorf("...: %w", err)` is the canonical Go slop signature.

Go has no exceptions. Every failure is named in a function's return signature as `error`, and every caller decides what to do at the point of return. This is the part of Go AI-generated code gets wrong most often: the model inherits a Java or Python reflex — wrap everything, log defensively, invent error classes — and ports it into a language whose idioms are the opposite. Treat errors like values. Give them context, do not duplicate them into the log and the return channel at the same time, and do not throw information away with `_` or a bare `return err`.

## Error as value

`error` is a one-method interface: `type error interface { Error() string }`. It is not a language construct. Any type with an `Error() string` method satisfies it, and `nil` is the absence of error. Checking failure is ordinary control flow — no try, no catch, no stack unwinding.

```go
f, err := os.Open(path)
if err != nil {
    return fmt.Errorf("open config %q: %w", path, err)
}
defer f.Close()
```

Once you see `error` as a value, the rest follows. You inspect it, wrap it, compare it, embed it. You do not need a framework; the `errors` package covers every shape in this document.

## Wrapping with `%w`

`fmt.Errorf("context: %w", err)` produces a new error whose `Unwrap()` returns the original. This is how you add context without destroying the cause chain. `%w` is the only verb that keeps `errors.Is` and `errors.As` working downstream.

The context should name *what this layer was doing*, not *what the error was*. "open config /etc/app.yaml" is useful; "error: error occurred" is noise. Do not include `err` in the message — `%w` renders it.

```go
// right — context says what this layer was trying to do
return fmt.Errorf("load user %s: %w", id, err)

// wrong — %v loses the chain
return fmt.Errorf("error: %v", err)
```

At a package boundary you do not own, wrap. Between helpers inside the same package that share a stack, one wrap at the public boundary is enough. Three wraps in three helpers produces `loadUser: fetchRow: scanRow: sql: no rows` — each layer proud of its one word of context, the reader parsing a mini-poem.

## `errors.Is` vs `errors.As` vs `==`

Three tools, three jobs.

- **`err == sentinel`** — works only when no caller wraps. Breaks silently the moment anyone adds `%w`.
- **`errors.Is(err, target)`** — unwraps the chain and compares against a sentinel value. The right tool for `io.EOF`, `sql.ErrNoRows`, `context.Canceled`.
- **`errors.As(err, &target)`** — unwraps and tests whether any wrapped error is assignable to the target pointer's element type. The right tool for custom error *types* that carry fields.

```go
// brittle — breaks under wrapping
if err == sql.ErrNoRows { ... }

// right
if errors.Is(err, sql.ErrNoRows) { ... }

// typed error with fields
var pErr *os.PathError
if errors.As(err, &pErr) {
    log.Printf("path=%s op=%s", pErr.Path, pErr.Op)
}
```

`errors.As` requires a pointer; passing a non-pointer panics. `go vet` and `errorlint -asserts` catch it.

## Sentinel errors

A sentinel is an exported variable, conventionally `ErrSomething`, declared once and compared by identity. `io.EOF`, `sql.ErrNoRows`, `context.Canceled` earn their keep because they are stable contract markers every caller branches on.

Sentinels are wrong when they proliferate inside a package for internal control flow. A package exporting `ErrInvalidInput`, `ErrNotFound`, `ErrUnauthorized`, `ErrForbidden`, `ErrInternal` — none branched on by any external caller — is mimicking an exception hierarchy. Either use typed errors (callers `errors.As`) or return a wrapped `error` with structured context, but do not export sentinels nobody compares against.

## Custom error types

A struct implementing `Error() string` earns its place when the failure carries fields a caller needs to act on — `*os.PathError` exposes `Op`, `Path`, `Err`, and the caller logging it can structure those fields instead of parsing a string.

The failure mode is cargo-cult. A one-field struct whose `Error()` formats the one field, returned once, never read, is a sentinel dressed up as a type — and a worse one, because every call site must `errors.As` instead of `errors.Is`.

```go
// earns keep — caller inspects fields
type ValidationError struct {
    Field, Rule string
    Got         any
}
func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation: %s failed %s (got %v)", e.Field, e.Rule, e.Got)
}

// slop — one field, formatted once, never read
type UserNotFoundError struct{ ID string }
func (e *UserNotFoundError) Error() string { return "user not found: " + e.ID }
```

Dave Cheney: *"avoid error types, or at least, avoid making them part of your public API."* A private typed error caught at one boundary is fine. Exported, every caller is coupled to your struct.

## `errors.Join`

Go 1.20 added `errors.Join(errs ...error) error`, producing a single error that unwraps to each non-nil input. Use it when a function legitimately produces several failures at once — a validator returning every field that failed, a fan-out worker returning partial results — and you want callers to `errors.Is` or `errors.As` against any of them.

```go
func validate(u User) error {
    var errs []error
    if u.Email == "" { errs = append(errs, &ValidationError{Field: "email", Rule: "required"}) }
    if u.Age < 0    { errs = append(errs, &ValidationError{Field: "age",   Rule: "nonneg"}) }
    return errors.Join(errs...)
}
```

`errors.Join` returns `nil` when all inputs are nil. Do not use it to concatenate unrelated failures across layers — if the caller cannot meaningfully inspect every branch, wrap once with context and return a single chain.

## Logging vs returning

The log-and-return anti-pattern — `log.Printf("error: %v", err); return err` — produces the same failure at every layer on the way up. A five-layer stack yields five log lines for one event, each at a different site, each with a different message. Dave Cheney: *"making more than one decision in response to a single error is also problematic."*

Pick one:

- **Return, don't log.** The default. The caller has more context.
- **Log, don't return.** Only at the top of a goroutine, a request handler, or `main`.
- **Handle, don't log or return.** You took a real action: retried, fell back, emitted a metric. Resolved here.

```go
// wrong — two decisions for one error
if err := step(); err != nil {
    log.Printf("step failed: %v", err)
    return err
}

// right — one decision
if err := step(); err != nil {
    return fmt.Errorf("pipeline step %d: %w", n, err)
}
```

## `panic` and `recover`

`panic` is for programmer error — a nil dereference, an invariant the code's own logic violated. `recover` is for the handful of program boundaries where an unhandled panic would take the process down: the top of an HTTP handler, a worker-pool task runner, `main`. Use it to log, metric, and return a 500; never to convert panics into errors and keep running.

The slop shape is `defer func() { if r := recover(); r != nil { err = ... } }()` scattered through business logic to "make the code robust." It makes the code opaque. A panic that should have surfaced as a fix-this-now stack trace becomes an anonymous error that corrupts state downstream. Write `panic` to crash loudly when an invariant breaks. Recover only at boundaries.

## Cheney's three-line rule

*"Check errors, handle them gracefully, make them opaque."*

- **Check them.** Every `error` return gets a `!= nil` branch. `_` is not a check.
- **Handle them gracefully.** One decision per error. Wrap and return, or log at the top, or recover a retryable failure. Not all three.
- **Make them opaque.** Callers should not parse `Error()` strings. Give them a sentinel (`errors.Is`) or a typed error (`errors.As`).

## Shape table

| Shape | When to use | Anti-pattern |
|---|---|---|
| `return fmt.Errorf("ctx: %w", err)` | Crossing a layer | `return err` bare; `%v` instead of `%w` |
| `return err` bare | Private helper chain, one level | Across layers, discarding context every return |
| `errors.Is(err, Sentinel)` | Sentinel possibly wrapped | `err == Sentinel` when any caller wraps |
| `errors.As(err, &typed)` | Typed error with fields | `err.(*MyError)` on possibly-wrapped err |
| `errors.New("literal")` | Package-level sentinel | Inline `errors.New` returned fresh |
| `errors.Join(errs...)` | Multi-error (validation, fan-out) | Concatenating error strings by hand |
| `log.Printf` at top boundary only | Final layer, no caller | `log` + `return` at every intermediate layer |
| `panic` | Invariant violation | General error mechanism |
| `recover` in top-level defer | Goroutine / handler boundary | Scattered through business logic |
| `_ = f()` with comment | Deliberate discard | Undocumented `_` swallowing an error |

## Common AI failure modes

- **`naked-err-return`** — `if err != nil { return err }` with no `fmt.Errorf("...: %w", err)`. Dave Cheney: *"the problem with this code is I cannot tell where the original error came from … all that will be printed is: No such file or directory."* The single most common LLM Go error-handling slop. `wrapcheck` and `errorlint -errorf` catch it. Rewrite as `return fmt.Errorf("what this layer was doing: %w", err)`.
- **`verb-v-instead-of-w`** — `fmt.Errorf("...: %v", err)` instead of `%w`. Breaks `errors.Is`/`errors.As`, defeats Go 1.13 wrapping. Common in models trained on pre-1.13 code. `errorlint` catches it. `%w` renders identically and preserves the chain.
- **`shadowed-err`** — `err := f()` inside a nested block silently shadowing an outer `err`, so the outer check sees `nil`. LLMs reach for `:=` reflexively. `staticcheck SA4006` and `govet -shadow` flag it.
- **`err-swallowed-with-underscore`** — `x, _ := someFunc()` discarding an error return. Cheney: *"if you make less than one decision, you're ignoring the error."* `errcheck`, `errchkjson`, `gosec G104` flag it. The only acceptable `_` on an error is a documented intentional discard.
- **`log-and-return`** — function both logs AND returns the error; the same failure appears three to five times in logs. LLMs aggressively prepend `log.Printf("error: %v", err)` because it "looks defensive." Pick one — log at the top layer; return with context everywhere else.
- **`sentinel-equality-after-wrap`** — `if err == sql.ErrNoRows` using `==` when any caller might wrap. Breaks silently the moment someone adds `%w`. `errorlint -comparison` (default on) catches it. Use `errors.Is`.
- **`errors-as-type-assertion`** — `myErr, ok := err.(*MyError)` on a possibly-wrapped error. Should use `var me *MyError; errors.As(err, &me)`. Also catches the subtler panic of passing a non-pointer to `errors.As`. `errorlint -asserts` and `go vet errorsas` flag it.
- **`pointless-custom-error-type`** — one-field struct implementing `Error() string` with no extra behavior. Cheney: *"avoid error types, or at least, avoid making them part of your public API."* LLMs mimic Java exception hierarchies. Use `errors.New` and `errors.Is` unless callers read fields on the typed error.

### Avoid

- `return err` bare across a package boundary.
  — The caller cannot tell which layer produced the failure; `fmt.Errorf("what I was doing: %w", err)` costs one line.
- `fmt.Errorf("...: %v", err)` when you meant to wrap.
  — `%v` discards the chain; `errors.Is` and `errors.As` stop working.
- `err == SomeSentinel` where any caller could wrap.
  — The comparison silently becomes false the first time someone adds `%w`; use `errors.Is`.
- `myErr := err.(*MyError)` on a possibly-wrapped error.
  — Type assertion only inspects the outermost error; use `errors.As`.
- `log.Printf("...: %v", err); return err`.
  — Two decisions for one failure; the event appears at every layer on the way up.
- `x, _ := doThing()` when `doThing` returns an error.
  — Undocumented discard; the bug will surface as corrupted state three layers later.
- Exporting a dozen `ErrX` sentinels nobody branches on.
  — Decorative hierarchy; use typed errors or a single wrapped error.
- `recover()` in business logic to "make it robust."
  — Hides invariant violations; recover only at goroutine and handler boundaries.
- `panic` as a substitute for returning `error`.
  — Callers cannot recover without ceremony and the control flow is invisible.
- Reformatting `err.Error()` with `fmt.Sprintf` and returning a plain string.
  — Throws away the chain entirely; callers now parse strings to decide what to do.

→ For the layer-of-recovery framing and the error taxonomy (validation, timeout, bug, corruption), see [../../../sublime/references/errors.md](../../../sublime/references/errors.md). For parent governing claims, see [../SKILL.md](../SKILL.md) and [../../../sublime/SKILL.md](../../../sublime/SKILL.md). For shared catalog entries on paranoid try/catch, swallowed exceptions, and log-and-continue, see [../../../anti-patterns/over-defensive.md](../../../anti-patterns/over-defensive.md) and [../../../anti-patterns/review-burden.md](../../../anti-patterns/review-burden.md). For Go-specific anti-patterns beyond error handling, see [../anti-patterns.md](../anti-patterns.md). For the interface-side discipline that pairs with this one, see [interfaces.md](interfaces.md).
