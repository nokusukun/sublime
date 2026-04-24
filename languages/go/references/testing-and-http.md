# Testing and HTTP

Go's `testing` package plus `net/http` server primitives are production-grade; every popular "helper" library competes with them for simpler problems — `testify` for a five-line assertion is ceremony, and `http.ListenAndServe` without timeouts or graceful shutdown ships a slowloris vulnerability on day one.

Both subjects share a failure mode: the model reaches for a third-party abstraction where the stdlib is the idiom, and drops the server-hardening details that should be obvious. Table tests without subtests, `reflect.DeepEqual` instead of `cmp.Diff`, `http.ListenAndServe(":8080", mux)` with no timeouts, `http.Error` followed by `w.Write` — all produce code that passes a cursory review and fails in production. The stdlib primitives are the right answer; know which knobs to turn.

## Taxonomy — testing

- **Table-driven tests with subtests.**
- **`t.Helper()` on test helpers.**
- **`t.Fatal` in goroutines.**
- **`testify` overuse.**
- **`reflect.DeepEqual` vs `go-cmp`.**
- **`t.Parallel()` and subtest independence.**

## Taxonomy — HTTP

- **`http.Server{}` timeouts.**
- **Graceful shutdown with `signal.NotifyContext`.**
- **`defer resp.Body.Close()` on every client call.**
- **`http.Error` followed by `w.Write` — the superfluous-WriteHeader bug.**
- **Missing `return` after error write.**
- **`context.Background()` in a handler vs `r.Context()`.**

---

## Table-driven tests with subtests

A table without `t.Run` shares one test name across every case. You lose `-run 'TestParse/empty'` targeting, lose parallelism, and failure output points at the outer loop's assertion line regardless of which case failed.

```go
// slop — no subtests
for _, tc := range tests {
    got := Parse(tc.in)
    if got != tc.want {
        t.Errorf("%s: Parse(%q) = %d, want %d", tc.name, tc.in, got, tc.want)
    }
}

// idiom
for _, tc := range tests {
    t.Run(tc.name, func(t *testing.T) {
        if got := Parse(tc.in); got != tc.want {
            t.Errorf("Parse(%q) = %d, want %d", tc.in, got, tc.want)
        }
    })
}
```

Each subtest gets its own `*testing.T`, its own failure scope, and an addressable name. If cases are independent, add `t.Parallel()` inside the subtest. `paralleltest` and `tparallel` flag tables that skip `t.Run`.

---

## `t.Helper()`

Without `t.Helper()`, failures inside a helper report the line number *in the helper*, not at the caller. Every failure becomes a scavenger hunt through shared setup.

```go
// slop — failure line points into the helper
func assertEqual(t *testing.T, got, want int) {
    if got != want { t.Errorf("got %d, want %d", got, want) }
}

// idiom — failure line points at the caller
func assertEqual(t *testing.T, got, want int) {
    t.Helper()
    if got != want { t.Errorf("got %d, want %d", got, want) }
}
```

The rule is mechanical: every function taking `*testing.T` that calls `t.Errorf`/`t.Fatalf` starts with `t.Helper()`. `thelper` enforces it.

---

## `t.Fatal` in a goroutine

`t.Fatal` calls `runtime.Goexit` on the goroutine that owns it. From a spawned goroutine, that kills the goroutine — not the test — and subsequent assertions run against indeterminate state.

```go
// slop
go func() {
    r, err := Fetch()
    if err != nil { t.Fatal(err) } // kills the goroutine; test continues
    _ = r
}()

// idiom — report via channel
errCh := make(chan error, 1)
go func() {
    r, err := Fetch()
    if err != nil { errCh <- err; return }
    resultCh <- r
}()
select {
case err := <-errCh:      t.Fatal(err)
case r := <-resultCh:     _ = r
case <-time.After(5 * time.Second): t.Fatal("timeout")
}
```

Inside a helper, use `t.Error` plus `return`. `go vet testinggoroutine` and staticcheck `SA2002` flag the pattern.

---

## `testify` overuse

`testify/assert` and `testify/require` dominate the training corpus. They are not free: the dependency, the DSL, the assertion-per-line style that buries intent.

```go
// testify — dependency, buried intent
assert.Equal(t, expected.Name, got.Name)
assert.Equal(t, expected.Age, got.Age)
assert.Equal(t, expected.Email, got.Email)

// stdlib — one assertion, one failure site, a diff
if diff := cmp.Diff(expected, got); diff != "" {
    t.Errorf("user mismatch (-want +got):\n%s", diff)
}
```

Peter Bourgon: *"TDD/BDD packages bring new, unfamiliar DSLs and control structures, increasing the cognitive burden."* Stdlib `testing` plus `google/go-cmp` covers the real cases; `testifylint` catches common abuses inside testify; `depguard` forbids the import outright.

---

## `reflect.DeepEqual` vs `go-cmp`

`reflect.DeepEqual` is a reflection primitive, not a testing API: `nil` map ≠ empty map, `NaN` ≠ `NaN`, no diff on failure.

```go
// slop
if !reflect.DeepEqual(got, want) {
    t.Errorf("got %+v, want %+v", got, want) // eyeball the diff yourself
}

// idiom
if diff := cmp.Diff(want, got); diff != "" {
    t.Errorf("(-want +got):\n%s", diff)
}
```

`go-cmp` gives a usable diff, stable `nil`-vs-empty treatment, and options (`cmpopts.IgnoreUnexported`, `cmpopts.EquateEmpty`) that encode intent. It is the one third-party testing dependency to allow by default.

---

## `t.Parallel()` and subtest independence

`t.Parallel()` runs sibling subtests concurrently. It also reveals state shared via closure over the enclosing loop variable.

```go
// pre-1.22 slop — all subtests see the last tc
for _, tc := range tests {
    t.Run(tc.name, func(t *testing.T) {
        t.Parallel()
        check(tc.in) // closure captures the shared loop variable
    })
}
```

Go 1.22 fixed loop-variable scoping, so new code is safer. The rule still holds for any other shared state: subtests with `t.Parallel()` must not mutate ambient variables, and fixtures must be per-subtest.

---

## `http.Server{}` timeouts

`http.ListenAndServe(":8080", mux)` constructs a default `http.Server` with **no timeouts**. Every field defaults to zero, which Go reads as *no deadline ever*. A slowloris client can hold a connection open indefinitely.

```go
// slop — slowloris vulnerability
log.Fatal(http.ListenAndServe(":8080", mux))

// idiom — Cloudflare's canonical timeout stack
srv := &http.Server{
    Addr:              ":8080",
    Handler:           mux,
    ReadHeaderTimeout: 5 * time.Second,
    ReadTimeout:       30 * time.Second,
    WriteTimeout:      30 * time.Second,
    IdleTimeout:       120 * time.Second,
}
log.Fatal(srv.ListenAndServe())
```

`ReadHeaderTimeout` is the critical one — the only timeout that defends against slowloris header-trickling. `gosec G112` flags servers missing it.

---

## Graceful shutdown

A server that exits without draining in-flight requests drops user traffic every deploy. The idiom, codified by Mat Ryer's *[How I write HTTP services in Go after 13 years](https://grafana.com/blog/2024/02/09/how-i-write-http-services-in-go-after-13-years/)*:

```go
func main() {
    ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer stop()

    srv := &http.Server{Addr: ":8080", Handler: mux, ReadHeaderTimeout: 5 * time.Second}
    go func() {
        if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
            log.Fatal(err)
        }
    }()

    <-ctx.Done()
    shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(shutdownCtx); err != nil { log.Printf("shutdown: %v", err) }
}
```

`srv.Shutdown` stops accepting new connections, waits for active handlers, then closes idle ones. The 10-second bound caps slow handlers.

---

## `defer resp.Body.Close()`

Every successful `http.Client` call returns a non-nil `*http.Response` whose `Body` must be closed — even if you ignore the body. Without it, the connection leaks and keep-alive reuse breaks.

```go
// slop — leaks
resp, _ := http.Get(url)
data, _ := io.ReadAll(resp.Body)

// idiom
resp, err := http.Get(url)
if err != nil { return err }
defer resp.Body.Close()
if resp.StatusCode >= 400 { return fmt.Errorf("status %d", resp.StatusCode) }
data, err := io.ReadAll(resp.Body)
```

The `defer` goes *after* the error check — `resp` is `nil` when `err != nil`, so deferring `Close()` first nil-dereferences at function exit. `bodyclose` catches the missing close; `nilness` catches the wrong order.

---

## `http.Error` + `w.Write` = superfluous WriteHeader

`http.Error(w, msg, code)` is terminal for the response. Writing again produces the runtime log `http: superfluous response.WriteHeader call` and the second write silently drops. The subtle form is the missing `return`:

```go
// slop — no return; both branches run
u, err := getUser(r)
if err != nil {
    http.Error(w, err.Error(), http.StatusNotFound)
    // missing return
}
json.NewEncoder(w).Encode(u) // runs on error path; nil deref panic

// idiom
if err != nil {
    http.Error(w, err.Error(), http.StatusNotFound)
    return
}
json.NewEncoder(w).Encode(u)
```

This is *the* Copilot "add error handling" shape — the model inserts the error branch and forgets the `return`. A `ruleguard` rule catches it mechanically.

---

## `context.Background()` in a handler

`r.Context()` cancels on client disconnect, `srv.Shutdown`, and upstream deadline. `context.Background()` does none of these.

```go
// slop — query runs to completion after client disconnects
db.QueryContext(context.Background(), "SELECT ...")

// idiom
db.QueryContext(r.Context(), "SELECT ...")
```

The Go blog: *"it can be quite dangerous … your process could backlog and exhaust its resources."* `contextcheck` flags the mismatch.

---

## Construct reference

| Construct | Idiom | Slop signature |
|---|---|---|
| Table-driven test | `t.Run(tc.name, func(t *testing.T) { ... })` | Bare `for` with top-level `t.Errorf` |
| Test helper | `t.Helper(); if got != want { t.Errorf(...) }` | Helper without `t.Helper()` — line numbers lie |
| Goroutine failure | `errCh <- err; return` + `select` | `t.Fatal` inside the goroutine |
| Equality assertion | `cmp.Diff(want, got)` | `reflect.DeepEqual(got, want)` |
| Simple assertion | `if got != want { t.Errorf(...) }` | `assert.Equal(t, want, got)` for a 5-line test |
| HTTP server | `&http.Server{ReadHeaderTimeout: ...}` | `http.ListenAndServe(":8080", mux)` |
| Shutdown | `signal.NotifyContext` + `srv.Shutdown(ctx)` | Bare `ListenAndServe`, no signal handling |
| Response body | `defer resp.Body.Close()` after error check | No close, or close before nil check |
| Error response | `http.Error(w, msg, code); return` | `http.Error(...)` + `w.Write(...)` with no return |
| Handler context | `r.Context()` | `context.Background()` in a handler |

---

## Common AI failure modes

**`table-test-without-subtests`** — bare `for` over a table with no `t.Run`. You lose `-run` targeting, parallelism, and meaningful failure names. Wrap each iteration in `t.Run(tc.name, ...)`.

**`fatal-in-goroutine`** — `t.Fatal` in a spawned goroutine kills the goroutine, not the test. Push errors through a channel, or use `t.Error` plus `return` in helpers. `go vet testinggoroutine` catches it.

**`testify-overuse`** — `testify/assert` imported for a file with two assertions. The dependency costs more than `if got != want { t.Errorf(...) }`. New code uses stdlib `testing` plus `go-cmp`.

**`missing-t-helper`** — helper calls `t.Error`/`t.Fatal` with no `t.Helper()`. Failure line numbers point inside the helper. Every helper taking `*testing.T` starts with `t.Helper()`.

**`reflect-deep-equal-over-cmp-diff`** — `reflect.DeepEqual(got, want)`. Surprising semantics (`nil` map ≠ empty map, `NaN` ≠ `NaN`), no diff. Use `cmp.Diff(want, got)`.

**`superfluous-writeheader`** — `http.Error(w, ...)` followed by another write. Produces `http: superfluous response.WriteHeader call` and silently drops the second write. Fix is usually a missing `return`.

**`no-graceful-shutdown`** — `http.ListenAndServe(":8080", mux)` with no signal handling. Every deploy drops in-flight requests. Wrap main in `signal.NotifyContext` and call `srv.Shutdown(ctx)`.

**`no-server-timeouts`** — `http.Server{}` with every timeout defaulted to zero. Slowloris keeps connections open until FDs run out. Set `ReadHeaderTimeout` at minimum.

**`no-return-after-error`** — `if err != nil { http.Error(...) }` without `return`. Both branches run; superfluous-WriteHeader log in prod.

---

### Avoid

- Table-driven tests without `t.Run` subtests.
  — You lose `-run` targeting, parallelism, and meaningful failure names.
- Test helpers missing `t.Helper()` on the first line.
  — Failure line numbers point at the helper, not the caller.
- `t.Fatal` / `t.Fatalf` inside a spawned goroutine.
  — It kills the goroutine, not the test; push errors through a channel.
- `testify/assert` imported for a file with two or three assertions.
  — The dependency and DSL cost more than `if got != want { t.Errorf(...) }`.
- `reflect.DeepEqual` in tests.
  — Surprising semantics for `nil` vs empty and `NaN`; no diff on failure. Use `cmp.Diff`.
- `http.ListenAndServe(":8080", mux)` as production server setup.
  — No timeouts, no shutdown. Construct an `http.Server{}` explicitly.
- `http.Server{}` without `ReadHeaderTimeout`.
  — Slowloris vulnerability by default; `gosec G112` flags.
- No `signal.NotifyContext` + `srv.Shutdown(ctx)` in main.
  — Every deploy drops in-flight requests.
- `defer resp.Body.Close()` before the error check.
  — Dereferences nil when the request errored.
- Any HTTP client call with no `defer resp.Body.Close()`.
  — Leaks connections; breaks keep-alive reuse.
- `http.Error(w, msg, code)` without an immediate `return`.
  — Success-path code runs on the error path; superfluous-WriteHeader log in prod.
- `context.Background()` or `context.TODO()` inside an HTTP handler.
  — Breaks cancellation propagation when the client disconnects or the server shuts down. Use `r.Context()`.

See [`../SKILL.md`](../SKILL.md) for the Go posture and hard bans.
See [`../anti-patterns.md`](../anti-patterns.md) for the named catalog entries on testing and server patterns.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core code-craft foundation.
See [`../../../sublime/references/tests.md`](../../../sublime/references/tests.md) for the universal testing discipline.
See [`../../../sublime/references/errors.md`](../../../sublime/references/errors.md) for error-handling posture.
See [`../../../anti-patterns/testing-slop.md`](../../../anti-patterns/testing-slop.md) for catalog entries on testing ceremony.
See [`../../../anti-patterns/security-and-correctness.md`](../../../anti-patterns/security-and-correctness.md) for catalog entries on server hardening.
See [`structure.md`](structure.md) for package organization and type design.
See [`stdlib.md`](stdlib.md) for the stdlib idiom reference.
