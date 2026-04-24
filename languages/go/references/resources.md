# Resources and cleanup

Every acquired resource needs a release; `defer` is Go's tool for that, but its sharp edges — loops, argument evaluation at call-site, closure capture, pre-check placement — make it the second-most-common source of leaks after unbounded goroutines.

A resource is any handle whose lifetime is not governed by the garbage collector: a file descriptor, socket, row cursor, response body, mutex, timer, subprocess, temp directory. Each has an acquire call and a release call, and the code between them owns the resource. Leak it and the program keeps working until the pool runs out; the failure then surfaces a long way from the cause. The discipline: every acquire is immediately followed by the release, before any branch that could return between them.

## `defer` semantics

`defer stmt` schedules `stmt` to run when the surrounding function returns. Two rules that models routinely get wrong:

1. Arguments are evaluated at the `defer` site, not at the call. `defer fmt.Println(x)` captures `x`'s value now; later mutations to `x` do not change what prints.
2. The deferred call runs at function return, not at block exit. A `defer` inside a `for` loop runs once per iteration queued, and all of them execute only when the enclosing function returns.

```go
// The argument is evaluated now (1), the call runs later.
func demo() {
    x := 1
    defer fmt.Println(x) // prints 1
    x = 2
    defer fmt.Println(x) // prints 2, runs first (LIFO)
}
// Output: 2 \n 1
```

Deferred calls execute LIFO. For code that matches "open A, open B, close B, close A," the LIFO order is what you want — write the defers in the same order as the opens.

## `defer resp.Body.Close()` — the canonical HTTP discipline

`(*http.Response).Body` is an `io.ReadCloser` backed by the TCP connection. If you do not close it, the connection cannot return to the keep-alive pool; the transport allocates a fresh handshake for the next request, and under load the process exhausts ephemeral ports. Fail to drain the body before closing and the same thing happens — the transport discards the connection rather than reading unknown trailing bytes.

```go
// Slop — leaks the connection on any early return.
resp, err := http.Get(url)
if err != nil {
    return err
}
body, err := io.ReadAll(resp.Body)
if err != nil {
    return err // resp.Body never closed
}
return parse(body)

// Fix — defer Close immediately after the error check.
resp, err := http.Get(url)
if err != nil {
    return err
}
defer resp.Body.Close()
body, err := io.ReadAll(resp.Body)
if err != nil {
    return err
}
return parse(body)
```

`bodyclose` catches the missing-close case statically. For large bodies you do not need, `io.Copy(io.Discard, resp.Body)` before `Close` returns the connection to the pool. In hot paths, use `http.Client` with an explicit `Transport` and `io.LimitReader` so a hostile server cannot stream gigabytes at you.

## `defer` before the error check

Put the `defer` after the nil check on the resource, not before it.

```go
// Slop — if http.Get returns (nil, err), resp.Body is a nil dereference.
resp, err := http.Get(url)
defer resp.Body.Close()
if err != nil {
    return err
}

// Fix — check err first, then defer.
resp, err := http.Get(url)
if err != nil {
    return err
}
defer resp.Body.Close()
```

This applies to every call that can return `(nil, err)`: `os.Open`, `sql.Open`, `net.Dial`, `os.Create`. The nilness analyzer flags the obvious cases.

## `defer` inside a loop

A `defer` inside a `for` body queues a call for when the *function* returns, not when the iteration ends. Run the loop over ten thousand files and you have ten thousand open descriptors, ten thousand deferred closes, and a process that hits `EMFILE` long before the loop completes.

```go
// Slop — FD exhaustion on large directories.
func processAll(paths []string) error {
    for _, p := range paths {
        f, err := os.Open(p)
        if err != nil {
            return err
        }
        defer f.Close() // runs only when processAll returns
        if err := process(f); err != nil {
            return err
        }
    }
    return nil
}

// Fix — extract the per-iteration body into its own function.
func processAll(paths []string) error {
    for _, p := range paths {
        if err := processOne(p); err != nil {
            return err
        }
    }
    return nil
}

func processOne(p string) error {
    f, err := os.Open(p)
    if err != nil {
        return err
    }
    defer f.Close()
    return process(f)
}
```

The extraction is the fix. It makes the defer's scope a single iteration, keeps the error paths short, and composes naturally with `errgroup` if you want to parallelize later. `gocritic`'s `deferInLoop` rule catches this pattern, and `revive`'s `defer` rule catches it with a different heuristic.

## Loop-variable capture in `defer`

Closely related: `defer cleanup(x)` inside a loop schedules the call for later, which means the argument (`x`) is evaluated now and captured. Pre-1.22, `x` from `for _, x := range xs` was the shared loop variable; the deferred calls all ran against the final value. Since Go 1.22, each iteration gets a fresh `x` and the capture is safe, but you still have the FD-exhaustion problem above. The extraction-to-function fix resolves both.

## `defer-unlock` in long functions

`mu.Lock(); defer mu.Unlock()` is correct when the function is short and does not block on I/O. When the function does anything slow — an HTTP call, a disk write, a channel send that could block — the lock is held for that entire duration and turns the mutex into a global stop-the-world. This is the "defer unlock because it's safer" pattern that shows up constantly in generated Go.

```go
// Slop — lock held across a network call. Every other caller queues.
func (s *Service) Refresh(ctx context.Context) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    data, err := s.client.Fetch(ctx) // slow, blocks everyone
    if err != nil {
        return err
    }
    s.cache = data
    return nil
}

// Fix — do the slow work unlocked, then take the lock for the write.
func (s *Service) Refresh(ctx context.Context) error {
    data, err := s.client.Fetch(ctx)
    if err != nil {
        return err
    }
    s.mu.Lock()
    s.cache = data
    s.mu.Unlock()
    return nil
}
```

If multiple goroutines can refresh concurrently, use `singleflight` to collapse duplicate requests, not a long-held mutex. Never hold a lock across a channel send that could block on backpressure — that is a textbook deadlock.

## `sync.Pool` — narrow use

`sync.Pool` reuses objects to cut GC pressure. Worth reaching for in two cases: large `[]byte` buffers in request-scoped code (`net/http`'s own transport uses pools this way), and allocation-heavy inner loops where profiling has proven GC is the bottleneck. Elsewhere it is cargo cult — pooled objects must be reset on `Put`, `Get` can return a fresh zero value at any time, and the pool is unbounded. A pool with a forgotten `Reset` is worse than no pool.

```go
var bufPool = sync.Pool{
    New: func() any { return new(bytes.Buffer) },
}

func render(w io.Writer, v Value) error {
    buf := bufPool.Get().(*bytes.Buffer)
    defer func() {
        buf.Reset()
        bufPool.Put(buf)
    }()
    if err := format(buf, v); err != nil {
        return err
    }
    _, err := w.Write(buf.Bytes())
    return err
}
```

If you cannot demonstrate from a profile that allocation is your problem, do not add a pool. The cost in read-tax and subtle bugs outweighs any win.

## `os.File`, `bufio.Writer`, `sql.Rows`

Every acquire has a matching release. The mapping is mechanical:

- `os.Open`, `os.Create`, `os.OpenFile` → `f.Close()`.
- `bufio.NewWriter(w)` → `w.Flush()` before the underlying `Close`; an unflushed buffered writer loses its last chunk.
- `bufio.Scanner` — no close, but check `s.Err()` after the `Scan` loop to see if iteration stopped on error.
- `sql.Open` → `db.Close()` at program shutdown (not per query).
- `(*sql.DB).Query` → `rows.Close()` **and** `rows.Err()`. `Close` is idempotent; call it with `defer` and still check `rows.Err()` after the loop.
- `(*sql.DB).Prepare` → `stmt.Close()` when you are done with the statement.
- `os.Pipe`, `net.Pipe` → close both ends.
- `exec.Cmd` → `cmd.Wait()` to reap the subprocess and release its pipes.

```go
rows, err := db.QueryContext(ctx, query, args...)
if err != nil {
    return err
}
defer rows.Close()

for rows.Next() {
    var r Row
    if err := rows.Scan(&r.ID, &r.Name); err != nil {
        return err
    }
    out = append(out, r)
}
return rows.Err() // check for iteration errors, not just rows.Next returning false
```

`sqlclosecheck` catches missing `rows.Close()`; `rowserrcheck` catches missing `rows.Err()`. Both belong in the lint stack.

## `signal.NotifyContext` and graceful shutdown

A production HTTP server needs a shutdown path. `http.ListenAndServe(":8080", mux)` is a toy: it cannot drain in-flight requests, cannot close idle connections cleanly, cannot coordinate with a load balancer's health check. Wrap it with `signal.NotifyContext` and `srv.Shutdown(ctx)`:

```go
func run() error {
    ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer stop()

    srv := &http.Server{
        Addr:              ":8080",
        Handler:           mux,
        ReadHeaderTimeout: 5 * time.Second,
        ReadTimeout:       30 * time.Second,
        WriteTimeout:      30 * time.Second,
        IdleTimeout:       120 * time.Second,
    }

    errCh := make(chan error, 1)
    go func() {
        if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
            errCh <- err
        }
        close(errCh)
    }()

    select {
    case <-ctx.Done():
    case err := <-errCh:
        return err
    }

    shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
    defer cancel()
    return srv.Shutdown(shutdownCtx)
}
```

The four timeouts on `http.Server` are not optional. Defaults are zero, which means infinite, which means a slowloris attacker — or a misbehaving client — can tie up a connection forever. `gosec G112` flags the missing `ReadHeaderTimeout` specifically.

`errors.Is(err, http.ErrServerClosed)` is how you distinguish "we asked it to shut down" from "it crashed."

## Explicit close versus defer

`defer` is the right default; readers can see the cleanup next to the acquire, and the close runs on any return path including panics. Two cases where explicit close wins:

- **Long-running functions.** A function that opens many resources sequentially and processes them each for milliseconds should close each resource as it finishes, not hold all of them until return. Extract each unit into its own function (see "defer inside a loop") so the defer scope matches the resource lifetime.
- **Performance-critical paths.** The deferred call has a small but non-zero cost. In a tight loop where you have measured and the `defer` is a bottleneck, hand-write the close at every return and add a test. Do this only with a profile in hand.

A third case, often mistakenly cited: "defer does not run on `os.Exit`." True, but `os.Exit` skips every cleanup in the program — you are not protecting file descriptors, you are shutting the process down. If you need cleanup before exit, return from `main` instead.

## Resource table

| Resource | Acquisition | Release | Common leak |
|---|---|---|---|
| `*http.Response` | `http.Get`, `client.Do` | `resp.Body.Close()`, ideally after draining | Missing close breaks keep-alive; `bodyclose` catches it |
| `*os.File` | `os.Open`, `os.Create` | `f.Close()` | `defer` in a loop → FD exhaustion |
| `*bufio.Writer` | `bufio.NewWriter(w)` | `w.Flush()` then underlying `Close` | Unflushed buffer drops the last chunk |
| `*sql.DB` | `sql.Open` | `db.Close()` at shutdown | Closed per-query instead of per-program |
| `*sql.Rows` | `db.QueryContext` | `rows.Close()` + `rows.Err()` | Missing `rows.Err()` hides iteration errors |
| `*sql.Stmt` | `db.PrepareContext` | `stmt.Close()` | Prepared statements pile up in driver |
| `sync.Mutex` | `mu.Lock()` | `mu.Unlock()` | Held across I/O; `defer Unlock` in long fn |
| `context.CancelFunc` | `context.WithTimeout`/`WithCancel` | `cancel()` via `defer` | Dropped cancel leaks timer; `go vet lostcancel` |
| `exec.Cmd` | `cmd.Start` | `cmd.Wait()` | Zombie process and leaked pipes |
| `net.Listener` | `net.Listen` | `l.Close()` | Leaked port in tests |
| `time.Timer`, `time.Ticker` | `time.NewTimer`, `NewTicker` | `t.Stop()` | Leaked goroutine on the timer's send |
| `os.MkdirTemp` | `os.MkdirTemp` | `os.RemoveAll(dir)` | Accumulated temp dirs across test runs |
| `http.Server` | `srv.ListenAndServe` | `srv.Shutdown(ctx)` on signal | Drops in-flight requests; no signal handling |

## Common AI failure modes

- **`defer-in-loop`** — `for _, f := range files { file, _ := os.Open(f); defer file.Close() }`. All closes run at function exit; FDs exhaust. Extract the per-iteration body into its own function. `gocritic deferInLoop` and `revive defer` flag it.
- **`missing-defer-body-close`** — `http.Get` or `client.Do` followed by reading the body with no `defer resp.Body.Close()`. Breaks keep-alive and leaks the connection. `bodyclose` catches it statically; this is the single most common LLM footgun in HTTP client code.
- **`defer-before-err-check`** — `resp, err := http.Get(...); defer resp.Body.Close(); if err != nil { return err }`. Nil dereference on the failure path. Put the `defer` after the `err != nil` check.
- **`defer-loopvar-capture`** — `for _, x := range xs { defer cleanup(x) }`. Pre-1.22 captures the shared loop variable; every-Go-version accumulates deferred calls until function return. Extraction fixes both.
- **`defer-unlock-in-long-fn`** — `mu.Lock(); defer mu.Unlock()` in a function that then makes an HTTP call or a blocking channel send. Holds the lock across the slow work. Do the slow work unlocked, then take the lock for the write.
- **`no-graceful-shutdown`** — `http.ListenAndServe(":8080", mux)` with no signal handling, no `srv.Shutdown(ctx)`, no timeouts. Drops in-flight requests on SIGTERM; vulnerable to slowloris. Wrap with `signal.NotifyContext` and set the four `http.Server` timeouts.

### Avoid

- `defer` inside a `for` loop over a bounded or large collection.
  — All closes run at function exit; extract the body into its own function so the defer scope matches one iteration.
- `defer resp.Body.Close()` before checking `err`.
  — Nil dereference on the error path; check `err != nil` first, then defer.
- Reading an `http.Response` body without `defer resp.Body.Close()`.
  — Leaks the TCP connection and breaks keep-alive; `bodyclose` flags it.
- Reading rows without `defer rows.Close()` and a post-loop `rows.Err()`.
  — Missed iteration errors and leaked statements; `sqlclosecheck` and `rowserrcheck` catch them.
- `mu.Lock(); defer mu.Unlock()` wrapping I/O or a blocking send.
  — Turns the mutex into a global stop-the-world; hold the lock only for the write.
- `sync.Pool` without a profile proving allocation is the bottleneck.
  — Read-tax and subtle reset bugs that outweigh any win.
- `http.ListenAndServe` with no `http.Server` struct and no signal handling.
  — Drops in-flight requests; no timeouts means slowloris-vulnerable.
- `http.Server` without `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout`.
  — Defaults are zero, which is infinite; `gosec G112` flags the missing header timeout.
- `bufio.NewWriter(...)` without `Flush()` before close.
  — Drops the last buffered chunk.
- Opening a temp directory without `defer os.RemoveAll(dir)`.
  — Test and build artefacts pile up across runs.
- `context.WithTimeout(...)` without `defer cancel()`.
  — Leaks the timer until the parent deadline fires; `go vet lostcancel` flags it.

→ For codebase-wide cleanup posture and the acquisition/release contract, see [../SKILL.md](../SKILL.md). For core error-handling discipline that defer propagation depends on, see [../../../sublime/references/errors.md](../../../sublime/references/errors.md). For shared catalog entries on resource exhaustion and unbounded growth, see [../../../anti-patterns/security-and-correctness.md](../../../anti-patterns/security-and-correctness.md). For Go-specific anti-patterns and the lint stack that catches most of these, see [../anti-patterns.md](../anti-patterns.md). For the sibling concurrency discipline that resource lifetime depends on, see [concurrency.md](concurrency.md).
