# Concurrency

Concurrent code must be structured — context plus errgroup plus a bound — or left sequential; unstructured `go fn()` in a loop is the most common AI-generated Go footgun.

Goroutines are cheap enough that a model reaches for them at the first sign of a loop. The cost is paid later: exhausted FDs, a starved DB pool, a 429 from an upstream, a leaked timer that holds a request's memory past the deadline. The discipline is that every `go` keyword sits inside a scope — an `errgroup.Group`, a worker pool with a known size — that owns the lifetime of what it spawns, cancels them together, and waits for them before returning. If you cannot draw that scope on paper, the code is not concurrent, it is leaking.

## Goroutines are cheap but not free

A goroutine's stack starts at ~2 KB and grows on demand; a thousand goroutines cost a few MB. That figure is what models memorize; it is not the limit that matters. The limit is whatever the goroutine touches — one HTTP client, one DB connection, one rate-limited API. Fanning ten thousand goroutines at a pool of 25 means 9,975 queue on the pool, the 25 in flight starve the rest of the program, and the external service sees a burst that looks like an attack.

```go
// Slop — unbounded fan-out. Kills your DB pool, your upstream, or both.
func EnrichAll(ctx context.Context, ids []int64) error {
    for _, id := range ids {
        go enrich(ctx, id) // no bound, no wait, no error path
    }
    return nil
}

// Fix — bounded errgroup, first error cancels the rest.
func EnrichAll(ctx context.Context, ids []int64) error {
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(16)
    for _, id := range ids {
        g.Go(func() error { return enrich(ctx, id) })
    }
    return g.Wait()
}
```

The "slop" version is worse than sequential: it returns `nil` before any work has completed, drops every error, and leaks goroutines that the caller no longer has a handle on.

## `context.Context` is the propagation vehicle

Every long-running, cancellable, or I/O-bound function takes `ctx context.Context` as its first argument. In HTTP handlers, that context is `r.Context()` — not `context.Background()`, not `context.TODO()`. The handler's context carries the client's cancellation signal, the server's shutdown deadline, and any middleware-installed values; cutting it breaks all three.

```go
// Slop — fresh Background loses client-disconnect and shutdown signals.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    rows, err := h.db.QueryContext(context.Background(), "SELECT ...")
    _ = err
    _ = rows
}

// Fix — propagate the request's context all the way down.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    rows, err := h.db.QueryContext(r.Context(), "SELECT ...")
    // ...
    _, _ = rows, err
}
```

Store contexts in parameters, not in struct fields. A `type Worker struct { ctx context.Context }` turns a per-call lifetime into a per-instance lifetime, which is never what you want — the first request that uses that worker pins its deadline onto every subsequent request. The `context` package documentation is explicit: pass contexts, do not store them.

When you derive a cancellable context, capture the cancel function and defer it. Dropping the cancel — `ctx, _ := context.WithTimeout(parent, 5*time.Second)` — leaks the timer until the parent's deadline fires, and `go vet` will flag it.

```go
ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
defer cancel()
return h.svc.Fetch(ctx, id)
```

For context values, the key must be an unexported type — not a string, not any built-in type. The godoc warns that string keys collide across packages; the static analyzer `SA1029` catches it.

```go
type ctxKey int
const userIDKey ctxKey = 0

ctx = context.WithValue(ctx, userIDKey, id) // right
ctx = context.WithValue(ctx, "userID", id)  // wrong — collision risk, SA1029
```

## `errgroup.Group` with `SetLimit(n)`

`golang.org/x/sync/errgroup` is structured concurrency for Go: a group owns its goroutines, `Wait` blocks until they all return, `SetLimit(n)` caps in-flight work, `WithContext` cancels the group on the first non-nil error. Default to `errgroup`; reach for raw goroutines only when the group does not fit.

```go
func FetchAll(ctx context.Context, urls []string) ([]Result, error) {
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(8)
    results := make([]Result, len(urls))
    for i, u := range urls {
        g.Go(func() error {
            r, err := fetch(ctx, u)
            if err != nil {
                return err
            }
            results[i] = r
            return nil
        })
    }
    if err := g.Wait(); err != nil {
        return nil, err
    }
    return results, nil
}
```

Three properties to check: the group's context is used by every child, `SetLimit` is called for any fan-out larger than a handful, and writes to shared state are indexed (`results[i] = r`) not appended (which would race). The `sync.WaitGroup`-plus-`errCh` pattern that models default to is a worse reimplementation of `errgroup`: no first-error cancellation, easy to deadlock on an unbuffered error channel.

## Channels — direction and close discipline

Typed channel direction is documentation the compiler enforces. A function parameter of type `chan T` tells the reader nothing; `<-chan T` is a consumer, `chan<- T` is a producer. Write the strictest direction the body needs.

```go
// Slop — directionless, no compile-time check.
func drain(ch chan int) { for range ch {} }
func feed(ch chan int)  { ch <- 1 }

// Fix — intent is checked at the call site.
func drain(ch <-chan int) { for range ch {} }
func feed(ch chan<- int)  { ch <- 1 }
```

Close from the sender, never the receiver — closing from a receiver races with other senders and panics "send on closed channel." For multiple senders, coordinate closure through a done channel or a `sync.Once`. Do not close twice.

Buffered vs unbuffered is not a performance knob. Unbuffered synchronizes sender and receiver; a buffer of one turns a send into a non-blocking hand-off. The most common leak in generated Go is an unbuffered result channel where the receiver returns early.

```go
// Slop — if the caller gives up before ch is read, the goroutine leaks.
func First(ctx context.Context, q string) (string, error) {
    ch := make(chan string) // unbuffered
    go func() { ch <- slowFetch(q) }()
    select {
    case v := <-ch:
        return v, nil
    case <-ctx.Done():
        return "", ctx.Err() // goroutine still blocked on send
    }
}

// Fix — buffer of 1 so the sender can always finish.
func First(ctx context.Context, q string) (string, error) {
    ch := make(chan string, 1)
    go func() { ch <- slowFetch(q) }()
    select {
    case v := <-ch:
        return v, nil
    case <-ctx.Done():
        return "", ctx.Err()
    }
}
```

## `sync.WaitGroup` discipline

WaitGroup counts goroutines; it does not propagate errors and does not cancel on failure. Use it only for fire-and-forget coordination where every child either succeeds or panics. Three common misuses:

- `wg.Add(1)` called inside the goroutine, after it has started, racing with `Wait`. Call `Add` from the parent, before `go`.
- Passing `sync.WaitGroup` by value. The copy has a zero counter; the child's `Done` decrements nothing the parent sees. `go vet copylocks` catches it.
- Forgetting `defer wg.Done()`. A panic inside the goroutine never decrements the counter, and `Wait` hangs forever.

```go
var wg sync.WaitGroup
for _, item := range items {
    wg.Add(1)
    go func() {
        defer wg.Done()
        process(item) // Go 1.22+: item is a per-iteration variable
    }()
}
wg.Wait()
```

If the work can fail and you care about the first failure, you want `errgroup`, not WaitGroup with an error channel on the side.

## `sync.Mutex` versus `sync.RWMutex`

Default to `sync.Mutex`. The belief that `RWMutex` is free performance for read-heavy workloads does not survive real core counts: `RWMutex.RLock/RUnlock` performance degrades as GOMAXPROCS rises ([golang/go#17973](https://github.com/golang/go/issues/17973)) because reader bookkeeping contends across cores. `RWMutex` earns its keep only when the critical section does real work (not a map read) and the read-to-write ratio is extreme. For counters and flags, `sync/atomic` (or `atomic.Int64`, `atomic.Bool`) beats a mutex outright. Do not mix atomic and non-atomic access on the same field.

## `sync.Map` — narrow use

`sync.Map` is specialized for two patterns: entries written once and read many times (cache-like), or entries accessed by disjoint goroutines (sharding). For a balanced read/write workload, a plain `map` under a `sync.Mutex` is faster and less error-prone. `sync.Map` also has no `len`, no sorted iteration, and type-asserts on every `Load`. Reach for it only after profiling shows contention on the mutex you already have.

## The forgotten-sender leak

Any unbuffered channel where the receiver can give up early is a leak waiting to happen. Launch a goroutine, `select` on its result and `ctx.Done()`, return on cancellation — the goroutine is still blocked on the send, holding its stack, captured variables, and any resources it opened. `go vet` does not catch this, `-race` does not catch it, and it only shows up under load. Fix: buffer sized for the maximum senders, or `select` on `ctx.Done()` inside the sender.

`go.uber.org/goleak` catches these in tests by asserting no extra goroutines outlive `TestMain`. Wire it into any package that spawns goroutines.

## Loop-variable capture

Go 1.22 changed `for` loop semantics so each iteration gets a fresh variable. Before 1.22, `for _, v := range xs { go func() { use(v) }() }` captured one shared `v` and every goroutine saw the final value. Models trained on pre-1.22 corpora still emit the buggy form. If your `go.mod` is `go 1.22` or newer, the new semantics apply automatically. If you are stuck on older Go, capture explicitly:

```go
for _, v := range xs {
    v := v // shadow — pre-1.22
    go func() { use(v) }()
}
```

`copyloopvar` and `loopclosure` (a govet analyzer) both flag the pre-1.22 mistake.

## `go test -race` is not optional

The race detector instruments memory accesses and reports unsynchronized reads and writes. It is the only tool that deterministically catches a whole class of concurrency bugs — maps written from two goroutines, fields read while being written, atomic-mixed-access. Run the full suite under `-race` in CI. The overhead is real (2–10x CPU) but an undetected race in production is worse.

The race detector does not catch goroutine leaks, unbuffered-send deadlocks, or channel misuse that does not manifest as memory race. For those, use `goleak` in tests and `contextcheck` / `lostcancel` / `fatcontext` in the linter.

## Primitive table

| Primitive | Use when | Footgun |
|---|---|---|
| raw `go fn()` | Inside an `errgroup` or worker pool | Unbounded fan-out, leaked goroutines, silent errors |
| `errgroup.Group` + `SetLimit` | Fan-out with bounded parallelism and first-error cancellation | Forgetting the group's derived context |
| `sync.WaitGroup` | Fire-and-forget with no error to propagate | `Add` inside goroutine; pass-by-value; missing `Done` |
| `context.WithCancel/Timeout/Deadline` | Bounding a call or subtree | Dropping the cancel function; storing ctx in a struct |
| unbuffered `chan T` | Synchronous hand-off, backpressure | Forgotten-sender leak on early receiver return |
| buffered `chan T` (size 1) | Non-blocking one-shot result | Oversized buffers hiding back-pressure |
| `sync.Mutex` | Short critical sections — the default | Holding across I/O or long work |
| `sync.RWMutex` | Extreme read-heavy, long-ish critical sections | Default choice; degrades on many cores |
| `sync/atomic` (`atomic.Int64`, ...) | Counters, flags, lock-free state | Mixing atomic and non-atomic access |
| `sync.Map` | Cache-like or sharded-by-key workloads | Balanced read/write; needing `len` or iteration |
| `sync.Once` | One-shot initialization | New `Once` per call; copying by value |

## Common AI failure modes

- **`unbounded-go-in-loop`** — `for _, x := range items { go work(x) }` with no bound. Exhausts FDs, DB connections, upstream rate limits. Replace with `errgroup.Group` and `g.SetLimit(n)`.
- **`missing-ctx-cancellation`** — long-running goroutine with `for { ... }` that never selects on `ctx.Done()`. Outlives the HTTP server, the DB pool, the request. `contextcheck`, `fatcontext`, `noctx`, `lostcancel` flag variants.
- **`forgotten-sender-leak`** — unbuffered `chan X`, goroutine sends, parent returns early on cancel. Sender blocks forever. Fix: `make(chan X, 1)` or `select` with `ctx.Done()` in the sender.
- **`missing-errgroup`** — `sync.WaitGroup` coordinating fallible tasks with a side-channel `errCh`. Reimplements `errgroup` badly and without first-error cancellation.
- **`waitgroup-misuse`** — `wg.Add(1)` inside the goroutine; passing `sync.WaitGroup` by value; forgetting `defer wg.Done()`. `go vet copylocks` and staticcheck `SA2000` catch subsets.
- **`loopvar-capture-pre-1.22`** — `for _, v := range xs { go func() { use(v) }() }` without shadowing on Go ≤1.21. Fix by upgrading `go.mod` to 1.22 or shadowing explicitly.
- **`directionless-channel-param`** — function takes `chan T` instead of `<-chan T` or `chan<- T`. Loses compile-time producer/consumer enforcement.
- **`rwmutex-premature`** — `sync.RWMutex` as a default for "read-heavy" code where a plain `Mutex` would be faster; degrades on high core counts.
- **`sync-map-abuse`** — `sync.Map` for balanced workloads or where `len`/iteration is needed. Use a plain map with a `Mutex` unless profiling says otherwise.
- **`background-in-handler`** — `context.Background()` or `context.TODO()` inside an HTTP handler instead of `r.Context()`. Breaks cancellation and deadline propagation. `contextcheck` flags it.
- **`context-in-struct-field`** — `type Worker struct { ctx context.Context }`. Violates the `context` godoc directive; `containedctx` flags it.
- **`string-key-context-value`** — `context.WithValue(ctx, "userID", id)`. Collides across packages; staticcheck `SA1029`. Use an unexported `type ctxKey int` constant.
- **`lost-cancel`** — `ctx, _ := context.WithTimeout(...)` discarding the cancel function. Leaks timers. `go vet lostcancel` catches it.
- **`channels-where-mutex-works`** — protecting a single counter via channel plus goroutine plus select when `sync.Mutex` or `atomic.Int64` is simpler. Cargo-culted from "share memory by communicating."

### Avoid

- Unbounded `go fn()` inside a loop.
  — Exhausts FDs, DB pool, upstream quota; drops every error; leaks goroutines.
- `context.Background()` or `context.TODO()` inside an HTTP handler or a function that already has a context.
  — Severs cancellation and deadline; `r.Context()` is the only right answer.
- Storing `context.Context` in a struct field.
  — Turns a per-call lifetime into a per-instance lifetime; the `context` godoc explicitly forbids it.
- `context.WithTimeout`/`WithCancel`/`WithDeadline` without `defer cancel()`.
  — Leaks the timer until the parent context fires; `go vet lostcancel` flags it.
- String or other built-in keys in `context.WithValue`.
  — Collides across packages; staticcheck `SA1029`. Use an unexported type.
- `sync.WaitGroup` with a side-channel for errors when the work is fallible.
  — You have reinvented `errgroup` and lost first-error cancellation.
- `sync.RWMutex` as the default.
  — Performance degrades with core count; plain `Mutex` is faster for short critical sections.
- `sync.Map` for balanced read/write workloads.
  — Specialized data structure with narrow wins; a plain `map` under `Mutex` is usually faster and always simpler.
- Unbuffered channels where the receiver may return early.
  — The classic forgotten-sender leak; buffer of 1 or sender-side `select` on `ctx.Done()`.
- Closing a channel from the receiver or closing it twice.
  — Panics at runtime; close from the sender, once.
- Running tests without `-race` in CI.
  — The only tool that catches unsynchronized access deterministically.

→ For codebase-wide concurrency posture, see [../SKILL.md](../SKILL.md). For core error-handling discipline that context cancellation propagates, see [../../../sublime/references/errors.md](../../../sublime/references/errors.md). For the shared catalog entries on unbounded concurrency and resource exhaustion, see [../../../anti-patterns/security-and-correctness.md](../../../anti-patterns/security-and-correctness.md). For Go-specific anti-patterns and the lint stack that catches most of these, see [../anti-patterns.md](../anti-patterns.md). For the sibling resource-cleanup discipline that goroutine lifetime depends on, see [resources.md](resources.md).
