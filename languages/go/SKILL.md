---
name: go
description: "Go-specific extension of the Sublime code-craft skill. Adds Go-scoped positions on error handling and wrapping, interface design (accept interfaces, return structs), goroutine and channel discipline, context propagation, defer and resource cleanup, struct and package organization, generics restraint, and stdlib modernization. Loads with or without the Sublime core. Use when writing, reviewing, or refactoring Go — including net/http services, gRPC, CLI tools, and systems code."
license: MIT. Extension of the Sublime skill. See NOTICE.md for attribution.
user-invocable: true
---

# Sublime — Go

Go rewards code that is obvious and punishes code that borrows from Java or Rust. The biggest slop vector is training-corpus lag — models produce pre-1.21 idioms years after the community moved on, and the Go team has officially said so.

---

## Context Gathering Protocol (Go)

Go looks stable and moves faster than its reputation suggests. Between 1.21 and 1.24 the stdlib absorbed `slices`, `maps`, `cmp.Ordered`, `min`/`max`, per-iteration loop variables, range-over-func, and generic type aliases. Models trained before those landed still emit the old shapes. Resolve the toolchain before you write.

**Required context — read from the project, then confirm:**

- **Go version.** `go.mod` and `go.work`. 1.21+ unlocks `slices`, `maps`, `cmp.Ordered`, built-in `min`/`max`. 1.22+ gives per-iteration loop variables. 1.23+ adds range-over-func. 1.24+ adds generic type aliases.
- **Module layout.** Single module, workspace, `internal/` boundaries. `internal/` is compiler-enforced; `pkg/` is a convention Russ Cox has publicly disavowed.
- **Framework.** Stdlib `net/http` (with 1.22 `ServeMux`), `chi`, `echo`, `gin`, gRPC. Each has its own middleware shape.
- **Test tooling.** `go test`, `testify`, `gocheck`, `ginkgo`. `testify` dominates training data; check the repo.
- **Linter config.** Which `golangci-lint` linters are on — especially `wrapcheck`, `errorlint`, `ireturn`, `contextcheck`, `containedctx`, `bodyclose`, `recvcheck`, `testifylint`, `thelper`, `paralleltest`, `copyloopvar`, `fatcontext`, `modernize`.
- **Error-handling posture.** Sentinel errors, custom types with `errors.As`, or opaque `%w` wrapping. Modern Go is mostly opaque-with-wrapping.
- **Context-propagation discipline.** Does `ctx` thread through? Any struct-embedded contexts? Typed keys on `WithValue`?

**Gathering order:**
1. If loaded instructions contain a **Code Context** section, proceed.
2. Otherwise read `.sublime.md` at the project root.
3. If neither exists and the work is non-trivial, run `sublime teach` first. For one-liners, infer and state assumptions up top.

**CRITICAL:** Do not bump the `go` directive in `go.mod`, do not swap `testify` for stdlib (or the reverse), and do not change the error-handling posture mid-PR without asking.

---

## Go Direction

Before writing non-trivial Go, commit to a posture:

- **Target Go version.** The `go` directive in `go.mod` is the floor. 1.22 gives you per-iteration loopvars and `slices`; not range-over-func.
- **Error-handling posture.** Opaque errors with `%w` wrapping, `errors.Is`/`errors.As` at the handling site, rarely-exposed sentinels is the current idiom. Custom types earn their keep when callers branch on structure.
- **Concurrency posture.** Structured. `errgroup.Group` with `SetLimit` for fan-out, `context.Context` threaded from the entry point, channels for handoff, `sync.Mutex` for shared state. Goroutines without an owner and without a `ctx.Done()` exit are leaks with a timer.
- **Package naming policy.** No `utils`, `common`, `helpers`, `misc`, `shared`, `base`. No top-level `/pkg`. `internal/` is the only import boundary the compiler enforces.

Match the intensity of craft to the posture. A CLI tool does not need `errgroup` ceremony. A gRPC service cannot afford `context.Background()` anywhere near a handler.

---

## Craft Guidelines

### Error handling

→ *Consult [error handling reference](references/errors.md) for the full wrapping, sentinel, and chain discipline.*

Errors are values. The value must carry enough context that a caller three frames up can decide what to do. A raw `return err` is a shrug.

<sublime_go_errors_principles>
**Always apply these — no reference needed:**

- Wrap with `%w` at every return that crosses a package or layer boundary. `fmt.Errorf("fetch user %s: %w", id, err)` says what you were doing and preserves the chain.
- `errors.Is(err, ErrNotFound)` for sentinel matching. `err == ErrNotFound` breaks the moment any caller wraps.
- `errors.As(err, &target)` for structural matching. Never a type assertion on a possibly-wrapped error.
- Log or return — never both. Double-reporting fills logs with the same error at every frame.
</sublime_go_errors_principles>

<sublime_go_errors_rules>
**DO** use `errors.Join` when genuinely aggregating — batch processing, multi-close, validation.
**DO** export sentinels only when callers must branch on identity.
**DO** name custom error types for shape, not one-offs. `ValidationError` with fields, not `FooError` wrapping a string.

**DO NOT** use `%v` to format an error you want a caller to inspect. `errors.Is`/`errors.As` cannot traverse `%v` chains.
**DO NOT** shadow an outer `err` with `err :=` inside a nested block.
**DO NOT** discard an error with `_`. If you truly do not care, leave a comment: `_ = f.Close() // best-effort`.
**DO NOT** build a parallel hierarchy of `FooError`, `BarError` types that each hold one string. Wrap and let the message do the work.
</sublime_go_errors_rules>

---

### Interface design

→ *Consult [interface design reference](references/interfaces.md) for the "accept interfaces, return structs" discipline and the single-implementer test.*

Rob Pike: *"The bigger the interface, the weaker the abstraction."* Jack Lindamood: *"Accept interfaces, return structs."* Both are about the same failure mode — writing the interface before the second implementation exists.

<sublime_go_interfaces_principles>
**Always apply these — no reference needed:**

- Interfaces belong at the consumer, not the producer. The package that needs a `UserReader` defines `UserReader`; the package that implements it returns `*pgStore`.
- Constructors return structs. `func NewStore() *Store`, not `func NewStore() Store`.
- One-method interfaces (`io.Reader`, `io.Writer`, `fmt.Stringer`) are the idiom. Five-method `Repository` interfaces mirroring a struct 1:1 are enterprise slop.
- Interfaces are discovered, not designed. Extract once you see the call shape duplicated across callers.
</sublime_go_interfaces_principles>

<sublime_go_interfaces_rules>
**DO** keep interfaces small — one method, two if they move together (`io.ReadCloser`).
**DO** pass `io.Reader`, `io.Writer`, `context.Context`, `*sql.Tx` as parameters. These are the interfaces Go has already discovered.
**DO** return concrete types so callers get inlining, escape-to-stack, and godoc on methods you didn't abstract away.

**DO NOT** declare a `UserRepository` interface in the same package as its only `pgUserRepository` implementer. When a mock is needed, define the interface in the test file.
**DO NOT** return an interface from a constructor "for flexibility." Callers lose visibility of added methods.
**DO NOT** take `interface{}` / `any` for structured data. That's Python-in-Go.
**DO NOT** write a `Thinger` above a `Thing` as a reflex. If there is one `Thing`, there is no `Thinger`.
</sublime_go_interfaces_rules>

---

### Concurrency and context

→ *Consult [concurrency reference](references/concurrency.md) for `errgroup`, channel direction, the forgotten-sender pattern, and RWMutex tradeoffs.*

Goroutines are cheap; leaks are not. Every `go fn()` needs an owner, a bound, and an exit. `sync.RWMutex` is not a safer `sync.Mutex` — under contention it is a slower one.

<sublime_go_concurrency_principles>
**Always apply these — no reference needed:**

- Every goroutine has an owner, a bound, and an exit path. No fire-and-forget.
- Every `go fn(x)` in a loop pairs with `errgroup.SetLimit(N)`, a `WaitGroup`, or a buffered semaphore. Unbounded fan-out exhausts FDs, DB pools, and rate limits.
- Every long-running `for { ... }` selects on `ctx.Done()` and returns cleanly.
- `context.Context` is the first parameter of every function that does I/O or crosses a goroutine boundary.
- `sync.Mutex` is the default. `sync.RWMutex` earns its keep only on read-dominated, long critical sections.
</sublime_go_concurrency_principles>

<sublime_go_concurrency_rules>
**DO** use `errgroup.WithContext` for fallible fan-out. First error cancels the rest.
**DO** type channel direction: `chan<- Msg`, `<-chan Msg`. Compile-time enforcement of producer/consumer roles.
**DO** buffer one-shot result channels (`make(chan Result, 1)`) so the sender can't block on an abandoned parent.
**DO** `defer cancel()` on every `WithTimeout`/`WithCancel`.

**DO NOT** spawn `go work(x)` inside a range loop with no bound. `errgroup.SetLimit(10)` is the canonical fix.
**DO NOT** store `context.Context` in a struct field. Pass it to each call that needs it.
**DO NOT** key `context.WithValue` with `string` or `int`. Use an unexported, package-private type.
**DO NOT** reach for `sync.RWMutex` because "reads are safe in parallel." On short critical sections under high `GOMAXPROCS` it is slower than `sync.Mutex`.
</sublime_go_concurrency_rules>

---

### Defer and resource cleanup

→ *Consult [resources reference](references/resources.md) for HTTP body close, defer-in-loop, defer-before-err-check, and long-lock patterns.*

`defer` runs at function exit, not scope exit, and only if the statement before it succeeded. Everything else follows from that.

<sublime_go_resources_principles>
**Always apply these — no reference needed:**

- Every `http.Get`/`http.Do` is followed by `defer resp.Body.Close()` after the err check.
- `defer f.Close()` inside a loop is a bug. `Close` runs at function exit; a thousand iterations leak a thousand FDs.
- `defer` before the error check is a nil-dereference waiting to fire. Check first; defer on the success path.
- A mutex held across a network call is a mutex held across a timeout. Unlock before the I/O.
</sublime_go_resources_principles>

<sublime_go_resources_rules>
**DO** extract loop bodies that need `Close` into a helper so each iteration's `defer` scopes correctly.
**DO** check the error from `Close` on writers. Reads buffer; writes flush.
**DO** pair `context.WithTimeout` with `defer cancel()` on the same line.
**DO** use `t.Cleanup(...)` instead of `defer` in tests — it runs after subtests complete.

**DO NOT** `defer file.Close()` inside a `for` loop. All `Close` calls queue until the surrounding function returns.
**DO NOT** `defer resp.Body.Close()` before the err check from `http.Get`. If `Get` errored, `resp` is nil; the defer panics.
**DO NOT** hold `mu.Lock(); defer mu.Unlock()` across an HTTP call or DB query. The lock scope is now unbounded.
**DO NOT** forget to drain and close the response body when you don't want its contents. The body is what keeps the connection in the keep-alive pool.
</sublime_go_resources_rules>

---

### Struct and package organization

→ *Consult [structure reference](references/structure.md) for receiver-type rules, zero-value design, package-layout principles, and the `/pkg` critique.*

Packages organize by responsibility, not by class. `net/http` groups `client.go`, `server.go`, `transport.go` — not `HTTPClient.go`, `HTTPServer.go`, `HTTPTransport.go`. Rob Pike: *"A package's name is part of every name it exports."*

<sublime_go_structure_principles>
**Always apply these — no reference needed:**

- Package names are short, lowercase, single-word: `user`, `payment`, `queue`. Never `utils`, `common`, `helpers`, `misc`, `shared`, `base`.
- Every exported name is read through the package: `user.UserService` stutters; `user.Service` reads.
- One type, one receiver style. Pointer or value — pick one and commit.
- Design for a useful zero value. `sync.Mutex{}` and `bytes.Buffer{}` work without init for a reason.
- `internal/` is the boundary the compiler enforces. `pkg/` is decoration.
</sublime_go_structure_principles>

<sublime_go_structure_rules>
**DO** group files by responsibility. `client.go`, `server.go`, `transport.go` — not `Client.go`, `Server.go`, `Transport.go`.
**DO** make structs usable at their zero value when possible.
**DO** align and lint struct tags (`tagalign`, `tagliatelle`, `musttag`).
**DO** keep `init()` empty or remove it. Hidden side effects at import time are a red flag.

**DO NOT** create `utils`, `common`, `helpers`, `misc`, `shared`, or `base`. Dave Cheney: the name reflects only the import-cycle workaround, not purpose.
**DO NOT** scaffold `cmd/` + `pkg/` + `internal/` by reflex. `pkg/` is a cargo cult from a layout repo Russ Cox publicly disavowed.
**DO NOT** mix value and pointer receivers on the same type. `recvcheck` flags this.
**DO NOT** spread `User.go`, `UserService.go`, `UserRepository.go` across three files. That's Java class-per-file translated literally.
</sublime_go_structure_rules>

---

### Stdlib modernization and generics

→ *Consult [stdlib reference](references/stdlib.md) for the 1.21–1.24 modernization checklist and the `go fix` acknowledged lag.*

The Go team documented training-corpus lag in the December 2024 `go fix` post: *"such tools tended to produce Go code in a style similar to the mass of Go code used during training, even when there were newer, better ways."* `slices`, `maps`, `strings.Cut`, `cmp.Ordered`, and the 1.22 loopvar fix are the canonical examples.

<sublime_go_stdlib_principles>
**Always apply these — no reference needed:**

- On 1.21+: `slices.Contains`, `slices.Sort`, `slices.Index`, `slices.Sorted(maps.Keys(m))`. Hand-rolled contains/sort loops are tells.
- `strings.Cut` for before-sep/after-sep. `strings.Split(s, sep)[0]` is an index-out-of-range waiting to panic.
- `io.ReadAll`, `os.ReadFile` on 1.16+. `ioutil.*` dates the training data.
- Built-in `min`/`max`, `cmp.Ordered` on 1.21+. Generic `Max[T Ordered]` over `x/exp/constraints` is a training-lag tell.
- Generics are for code you'd write twice across types. One call site means no generic.
</sublime_go_stdlib_principles>

<sublime_go_stdlib_rules>
**DO** run `golangci-lint --enable=modernize` or `gopls fix` on unfamiliar code — both rewrite pre-1.21 idioms.
**DO** use built-in `min`/`max` on 1.21+. `math.Min` is float-only.
**DO** use `slices.SortFunc(s, func(a, b T) int { ... })` returning `cmp.Compare`. The less-than callback is gone.
**DO** use `cmp.Or(a, b, c)` on 1.22+ for first-non-zero chains.

**DO NOT** import `io/ioutil` on Go 1.16+. staticcheck `SA1019`.
**DO NOT** write `sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })` when `slices.Sort(s)` works.
**DO NOT** parameterize a one-call-site function. `func Do[T any](x T)` called once with `Do(42)` is ornamentation.
**DO NOT** use verbose type-parameter names (`TKey`, `TValue`). Stdlib convention is `K`, `V`, `T`.
</sublime_go_stdlib_rules>

---

### Testing and HTTP patterns

→ *Consult [testing and HTTP reference](references/testing-and-http.md) for table-driven tests, `t.Helper`, `t.Cleanup`, graceful shutdown, and server timeouts.*

Go's stdlib `testing` package does more than most `xUnit` ports. `net/http` on its own is a production-grade server — but only if you set the timeouts.

<sublime_go_testing_http_principles>
**Always apply these — no reference needed:**

- Table-driven tests with `t.Run(tc.name, ...)`. Named subtests enable `-run` filtering and parallel execution.
- `t.Helper()` on every helper that calls `t.Error`/`t.Fatal`. Without it, failures point at the helper, not the caller.
- `testing` + `cmp.Diff` is enough for most projects. `testify` earns its keep on legacy codebases, not green-field Go.
- Every `http.Server` sets `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout`. Zero means infinite means slowloris.
- Graceful shutdown: `signal.NotifyContext` + `srv.Shutdown(ctx)`. Not `http.ListenAndServe`.
</sublime_go_testing_http_principles>

<sublime_go_testing_http_rules>
**DO** use `t.Cleanup(...)` instead of `defer` in tests — it composes across helpers and subtests.
**DO** parallelize table-driven tests with `t.Parallel()` inside each `t.Run`.
**DO** use `httptest.NewServer` + `srv.Client()` for HTTP tests. Don't hand-roll the client.
**DO** close response bodies in tests too.

**DO NOT** put `t.Fatal` inside a goroutine spawned from a test. It crashes the binary instead of failing the test.
**DO NOT** reach for `testify.assert.Equal` when `if got != want { t.Errorf(...) }` is two more characters.
**DO NOT** write `http.ListenAndServe(":8080", mux)` in production. No graceful shutdown, no timeouts.
**DO NOT** call `http.Error(w, "bad", 400)` and then `w.WriteHeader(400)`. Runtime logs `http: superfluous response.WriteHeader call`.
</sublime_go_testing_http_rules>

---

## Hard BANs (Go)

<absolute_bans>

**BAN 1: `if err != nil { return err }` without `%w` wrapping at a boundary**
- PATTERN: raw `return err` across a package or layer boundary with no context
- FORBIDDEN: `return err` from any function doing I/O, parsing, or calling another package's fallible API
- WHY: the single most prolific LLM Go pattern. Dave Cheney: *"I cannot tell where the original error came from."* `wrapcheck` + `errorlint`.
- REWRITE: `return fmt.Errorf("fetch user %s: %w", id, err)`.

**BAN 2: Swallowed error via `_`**
- PATTERN: `x, _ := fn()` discarding the error return
- FORBIDDEN: `_` in the error slot of a call that can meaningfully fail
- WHY: Dave Cheney: *"If you make less than one decision, you're ignoring the error."* `errcheck`, `gosec G104`.
- REWRITE: handle it, or explicitly ignore with a comment: `_ = f.Close() // best-effort`.

**BAN 3: Panic in library code**
- PATTERN: `panic(err)`, `panic("unreachable")`, `log.Fatal` outside `main`
- FORBIDDEN: `panic` or `log.Fatal` in code imported by other packages
- WHY: a panic inside someone else's request handler takes down their process.
- REWRITE: return an error. `log.Fatal` belongs only at program entry.

**BAN 4: `context.Background()` inside an HTTP handler**
- PATTERN: `ctx := context.Background()` or `context.TODO()` in request-scoped code
- FORBIDDEN: creating a fresh background context anywhere on the request path
- WHY: breaks cancellation and deadline propagation; client disconnects don't stop the DB query. Go blog: *"your process could backlog and exhaust its resources."* `contextcheck`.
- REWRITE: `ctx := r.Context()`, then `context.WithTimeout(ctx, ...)` + `defer cancel()`.

**BAN 5: Storing `context.Context` in a struct field**
- PATTERN: `type Worker struct { ctx context.Context }`
- FORBIDDEN: any struct carrying a `Context` as a member
- WHY: godoc: *"Do not store Contexts inside a struct type; pass a Context explicitly to each function that needs it."* `containedctx`.
- REWRITE: `ctx context.Context` as the first parameter of every method.

**BAN 6: `context.WithValue` with a built-in string key**
- PATTERN: `ctx = context.WithValue(ctx, "userID", id)`
- FORBIDDEN: `WithValue` keyed by `string`, `int`, or any built-in
- WHY: cross-package collisions. Godoc: *"should not be of type string or any other built-in type."* staticcheck `SA1029`.
- REWRITE: `type userIDKey struct{}` — unexported, package-private, collision-free.

**BAN 7: Unbounded `go fn()` in a loop**
- PATTERN: `for _, item := range items { go work(item) }` with no bound
- FORBIDDEN: any goroutine spawn in a range loop without `errgroup.SetLimit`, `WaitGroup`, or semaphore
- WHY: ten-thousand-item slices become ten-thousand concurrent workers. Exhausts FDs, DB pool, rate limits.
- REWRITE: `g, ctx := errgroup.WithContext(ctx); g.SetLimit(10); for _, item := range items { g.Go(func() error { return work(ctx, item) }) }; return g.Wait()`.

**BAN 8: Missing `defer resp.Body.Close()` after `http.Get`/`http.Do`**
- PATTERN: `resp, err := http.Get(url); body, _ := io.ReadAll(resp.Body)` with no `Close`
- FORBIDDEN: any `*http.Response` not explicitly closed on every success path
- WHY: breaks keep-alive reuse, leaks FDs, exhausts ephemeral ports under load. `bodyclose`.
- REWRITE: `resp, err := http.Get(url); if err != nil { return err }; defer resp.Body.Close(); ...`.

**BAN 9: `defer file.Close()` inside a loop**
- PATTERN: `for _, p := range paths { f, _ := os.Open(p); defer f.Close(); ... }`
- FORBIDDEN: any `defer` on a per-iteration resource inside a for loop
- WHY: `defer` runs at function exit. A thousand iterations queue a thousand `Close` calls. `gocritic deferInLoop`.
- REWRITE: extract the body to a helper so each iteration's `defer` scopes to the helper's return.

**BAN 10: `time.Sleep` for polling with no `ctx.Done()` select**
- PATTERN: `for { if done() { break }; time.Sleep(time.Second) }`
- FORBIDDEN: any polling or backoff loop ignoring the parent context
- WHY: can't be cancelled. Disconnected requests and shutting-down servers leak goroutines until the next `done()` check.
- REWRITE: `t := time.NewTicker(...); defer t.Stop(); for { select { case <-ctx.Done(): return ctx.Err(); case <-t.C: ... } }`.

</absolute_bans>

---

## AI Slop Test (Go)

If an experienced Go reviewer read this diff and said "an AI wrote this," would they be right on sight? These are the tells:

<sublime_go_slop_tells>

- `if err != nil { return err }` with no wrapping, repeated across every function.
- `ioutil.ReadAll` or `ioutil.ReadFile` in Go 1.16+ code.
- `sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })` instead of `slices.Sort(s)`.
- `strings.Split(s, sep)[0]` or `parts := strings.SplitN(s, sep, 2); parts[0], parts[1]` instead of `strings.Cut`.
- `for _, x := range s { if x == target { return true } }` instead of `slices.Contains`.
- A `Repository` interface with one implementation in the same package, no test mocks, no second concrete type.
- `func NewServer() Server` where `Server` is an interface defined next door.
- `package utils`, `package common`, `package helpers`, `package misc`, `package shared`, `package base`, or a top-level `/pkg` directory.
- `UserService`, `HTTPClient`, `JSONDecoder` — stuttering names where the package already conveys it.
- `context.Background()` in a request handler body.
- `go fn(x)` inside a `for` loop with no `errgroup.SetLimit`, `sync.WaitGroup`, or semaphore.
- `sync.RWMutex` on a struct with balanced reads and writes or tiny critical sections.
- `defer resp.Body.Close()` missing after `http.Get`; or present but before the err check.
- A single-file package named after a Java class — `UserService.go` with one type `UserService` inside.
- A test using `testify` for `assert.Equal(t, got, want)` where `if got != want { t.Errorf(...) }` is obvious.
- `http.ListenAndServe(":8080", mux)` with no graceful shutdown, no `http.Server{}` struct, no timeouts.
- `errors.Is(err, io.EOF)` in one function and `if err == io.EOF` in another — posture drift.
- Three decorator-like wrapper funcs stacked (`WithLogging(WithRetry(WithTracing(fn)))`) on a five-line function.
- `context.WithValue(ctx, "userID", id)` with a string key.
- `log.Printf("error: %v", err); return err` — log and return the same error.

</sublime_go_slop_tells>

Good Go is distinctive to its domain. Slop Go is distinctive to the model that wrote it.

---

## Implementation Principles (Go)

Errors carry context through `%w` chains; check with `errors.Is`/`errors.As` at the handling frame. Interfaces live at the consumer; constructors return structs; extract on the second implementation, not the first. Every goroutine has an owner, a bound, and a `ctx.Done()` exit. Context flows as the first parameter — never in a struct, never keyed by a built-in type. `defer` runs at function exit: use it for `resp.Body.Close()` on the success path, never for per-iteration closes. Packages name responsibility; no `utils`, no `/pkg`, no stuttering `user.UserService`. Reach for `slices`, `maps`, `strings.Cut`, `cmp.Ordered` on 1.21+ — pre-1.21 shapes are the training-corpus signature. Generics are for code you'd write twice; a one-caller `func Do[T any]` is ornamentation. Remember: {{model}} is capable of writing Go that Rob Pike would recognize as Go. Don't hold back — but don't write Java either.

---

## Deeper reference

- [references/errors.md](references/errors.md) — wrapping, sentinels, `errors.Is`/`errors.As`, error-chain hygiene.
- [references/interfaces.md](references/interfaces.md) — accept interfaces, return structs; discovery vs design; single-method interfaces.
- [references/concurrency.md](references/concurrency.md) — `errgroup`, channel direction, forgotten-sender, context propagation, RWMutex tradeoffs.
- [references/resources.md](references/resources.md) — `defer` scoping, HTTP body close, defer-in-loop, long-lock patterns.
- [references/structure.md](references/structure.md) — package layout, receiver types, zero-value design, the `/pkg` critique.
- [references/stdlib.md](references/stdlib.md) — 1.21–1.24 modernization, `slices`/`maps`/`cmp`, generics restraint, `go fix`.
- [references/testing-and-http.md](references/testing-and-http.md) — table tests, `t.Helper`, `t.Cleanup`, server timeouts, graceful shutdown.

Go-specific anti-patterns: [anti-patterns.md](anti-patterns.md)

Core foundation: [../../sublime/SKILL.md](../../sublime/SKILL.md)
