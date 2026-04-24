# Go anti-patterns

Go's LLM slop has three gravitational centers. **Error-handling slop** dominates — naked `if err != nil { return err }` without `%w` wrapping is the single most prolific LLM Go pattern, followed by swallowed errors, double-reporting (log AND return), and `err == ErrFoo` sentinel comparisons that break the moment a caller wraps. **Interface pollution** is the architectural sin — single-implementation interfaces declared in the producer package, `NewThing() Thinger` returning an interface, and Repository/Service interfaces that mirror structs 1:1, all violating Rob Pike's *"The bigger the interface, the weaker the abstraction"* and the community proverb *"Accept interfaces, return structs."* **Training-cutoff stdlib blindness** is the third axis — hand-rolled `Contains` loops instead of `slices.Contains`, `io/ioutil` after its 2021 deprecation, `sort.Slice` where `slices.Sort` suffices. The Go team acknowledged this directly in its December 2024 [go fix blog post](https://go.dev/blog/gofix): *"such tools tended — unsurprisingly — to produce Go code in a style similar to the mass of Go code used during training, even when there were newer, better ways."*

---

### `naked-err-return`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `if err != nil { return err }` with no `fmt.Errorf("...: %w", err)` wrapping at a package or layer boundary.

**Forbidden example.**
```go
func GetUser(id string) (*User, error) {
    row, err := db.QueryRow(ctx, "SELECT ... WHERE id = $1", id)
    if err != nil {
        return nil, err
    }
    return row.scan()
}
```

**Why it hurts.** The single most common LLM Go error-handling slop. Dave Cheney: *"the problem with this code is I cannot tell where the original error came from … all that will be printed is: No such file or directory."* `wrapcheck` + `errorlint` catch it.

**Rewrite.**
```go
func GetUser(id string) (*User, error) {
    row, err := db.QueryRow(ctx, "SELECT ... WHERE id = $1", id)
    if err != nil {
        return nil, fmt.Errorf("query user %s: %w", id, err)
    }
    return row.scan()
}
```

**See in `/sublime`:** [SKILL.md#error-handling](SKILL.md#error-handling), [references/errors.md](references/errors.md).

---

### `verb-v-instead-of-w`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `fmt.Errorf("...: %v", err)` instead of `%w` — wraps the message but breaks the chain.

**Forbidden example.**
```go
return fmt.Errorf("load config: %v", err)
```

**Why it hurts.** Defeats Go 1.13 error wrapping. `errors.Is(err, os.ErrNotExist)` and `errors.As(err, &pathErr)` cannot traverse a `%v`-formatted error. Very high frequency in models trained on pre-1.13 code. `errorlint` auto-fixes.

**Rewrite.**
```go
return fmt.Errorf("load config: %w", err)
```

**See in `/sublime`:** [references/errors.md](references/errors.md).

---

### `shadowed-err`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** Inner `err :=` shadows an outer `err`, causing the outer check to see `nil` even when the inner call failed.

**Forbidden example.**
```go
var err error
if cond {
    x, err := fetch()   // NEW err — shadows outer
    use(x)
    _ = err
}
if err != nil { // always nil here
    return err
}
```

**Why it hurts.** LLMs use `:=` reflexively and introduce shadows inside nested blocks. Silent bug: the outer check passes, the real error vanishes. staticcheck `SA4006`; `govet` shadow analyzer.

**Rewrite.**
```go
var err error
if cond {
    var x T
    x, err = fetch()     // assign to outer err
    use(x)
}
if err != nil { return err }
```

**See in `/sublime`:** [references/errors.md](references/errors.md).

---

### `err-swallowed-with-underscore`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `x, _ := fn()` discarding the error return.

**Forbidden example.**
```go
body, _ := io.ReadAll(resp.Body)
return string(body)
```

**Why it hurts.** Cheney: *"If you make less than one decision, you're ignoring the error."* A short read or partial body becomes a silent empty string. `errcheck`, `errchkjson`, `gosec G104`.

**Rewrite.**
```go
body, err := io.ReadAll(resp.Body)
if err != nil {
    return "", fmt.Errorf("read body: %w", err)
}
return string(body), nil
```

**See in `/sublime`:** [SKILL.md#error-handling](SKILL.md#error-handling).

---

### `log-and-return`

**Tags:** `AI-slop` · `Review` · `Lang:Go`

**Pattern.** The same error is logged AND returned — it will be logged again one or two frames up, producing duplicated tracebacks.

**Forbidden example.**
```go
if err := db.Save(ctx, u); err != nil {
    log.Printf("save user %s: %v", u.ID, err)
    return err
}
```

**Why it hurts.** Cheney: *"making more than one decision in response to a single error is also problematic."* The same error appears three or five times in the logs, once per frame. LLMs add `log.Printf` before every return because it "looks defensive." Review/semgrep only — no first-class static rule.

**Rewrite.**
```go
if err := db.Save(ctx, u); err != nil {
    return fmt.Errorf("save user %s: %w", u.ID, err)
}
// caller at the top of the request decides to log once
```

**See in `/sublime`:** [references/errors.md](references/errors.md).

---

### `sentinel-equality-after-wrap`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `err == sql.ErrNoRows` (or any `==` comparison to a sentinel) when callers might wrap.

**Forbidden example.**
```go
if err := db.QueryRow(ctx, q).Scan(&u); err == sql.ErrNoRows {
    return nil, nil
}
```

**Why it hurts.** Works today. Breaks silently the first time a middleware or helper adds `%w`. `errorlint -comparison` is enabled by default.

**Rewrite.**
```go
if err := db.QueryRow(ctx, q).Scan(&u); errors.Is(err, sql.ErrNoRows) {
    return nil, nil
}
```

**See in `/sublime`:** [references/errors.md](references/errors.md).

---

### `errors-as-type-assertion`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `myErr, ok := err.(*MyError)` on a possibly-wrapped error. Also passing a non-pointer to `errors.As` (panics).

**Forbidden example.**
```go
if pathErr, ok := err.(*os.PathError); ok {
    log.Print(pathErr.Path)
}
```

**Why it hurts.** Type assertion doesn't unwrap. The moment any caller wraps with `%w`, the assertion fails silently and the branch is dead. `errorlint -asserts`; `go vet` errorsas analyzer.

**Rewrite.**
```go
var pathErr *os.PathError
if errors.As(err, &pathErr) {
    log.Print(pathErr.Path)
}
```

**See in `/sublime`:** [references/errors.md](references/errors.md).

---

### `preemptive-single-impl-interface`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** An interface declared in the producer package with exactly one implementation in the same package and no second concrete type.

**Forbidden example.**
```go
// package store
type UserStore interface {
    Get(ctx context.Context, id string) (*User, error)
    Save(ctx context.Context, u *User) error
}

type pgUserStore struct{ db *pgx.Conn }
func New(db *pgx.Conn) UserStore { return &pgUserStore{db: db} }
```

**Why it hurts.** Rob Pike: *"Don't design with interfaces, discover them."* Adds indirection, blocks inlining, escapes to heap, drops godoc on un-interfaced methods. The defining LLM slop pattern in Go. `iface`, `interfacebloat`.

**Rewrite.**
```go
// package store
type Store struct{ db *pgx.Conn }
func New(db *pgx.Conn) *Store { return &Store{db: db} }
func (s *Store) Get(ctx context.Context, id string) (*User, error) { ... }
func (s *Store) Save(ctx context.Context, u *User) error { ... }
// consumer package declares its own narrow interface if needed
```

**See in `/sublime`:** [SKILL.md#interface-design](SKILL.md#interface-design).

---

### `producer-side-interface`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `func NewX() X` where `X` is an interface defined in the same package.

**Forbidden example.**
```go
type Server interface { Start(); Stop() }
type server struct{ ... }
func NewServer() Server { return &server{} }
```

**Why it hurts.** Violates Jack Lindamood's codified proverb *"Accept interfaces, return structs."* Forces dynamic dispatch on every call; callers can't see concrete methods added later; heap escape. `ireturn` linter.

**Rewrite.**
```go
type Server struct{ ... }
func NewServer() *Server { return &Server{} }
```

**See in `/sublime`:** [references/interfaces.md](references/interfaces.md).

---

### `repository-service-mirror`

**Tags:** `AI-slop` · `Review` · `Lang:Go`

**Pattern.** An interface that mirrors a struct 1:1 — same methods, same signatures — "for testability."

**Forbidden example.**
```go
type UserRepository interface {
    Create(ctx context.Context, u *User) error
    Read(ctx context.Context, id string) (*User, error)
    Update(ctx context.Context, u *User) error
    Delete(ctx context.Context, id string) error
}
type pgUserRepository struct{ db *pgx.Conn }
// methods exactly match the interface, one concrete impl in the same package
```

**Why it hurts.** Andrei Boar: *"If you abuse interfaces by creating many mocks, you end up testing mocks that are never used in production."* Endemic in LLM-generated "clean architecture" scaffolds from Cursor and Copilot agent mode.

**Rewrite.** Drop the interface. Return `*UserRepository` from `New`. When a test needs a fake, define a narrow interface (`UserReader`, `UserSaver`) in the test's own package and let the concrete struct satisfy it structurally.

**See in `/sublime`:** [SKILL.md#interface-design](SKILL.md#interface-design).

---

### `unbounded-go-in-loop`

**Tags:** `AI-slop` · `Review` · `Lang:Go`

**Pattern.** `for _, x := range items { go work(x) }` with no concurrency bound, no `sync.WaitGroup`, no `errgroup`.

**Forbidden example.**
```go
for _, user := range users {
    go syncUser(user)
}
```

**Why it hurts.** Exhausts file descriptors, DB pool, HTTP keep-alive, rate-limited upstreams. Ten-thousand-item slices become ten-thousand concurrent connections; the downstream goes down before the loop finishes. Review-only — no static linter.

**Rewrite.**
```go
g, ctx := errgroup.WithContext(ctx)
g.SetLimit(10)
for _, user := range users {
    g.Go(func() error { return syncUser(ctx, user) })
}
return g.Wait()
```

**See in `/sublime`:** [SKILL.md#concurrency-and-context](SKILL.md#concurrency-and-context), [references/concurrency.md](references/concurrency.md).

---

### `missing-ctx-cancellation`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** A long-running goroutine with `for { ... }` that never selects on `ctx.Done()`.

**Forbidden example.**
```go
go func() {
    for {
        if err := poll(); err != nil { log.Print(err) }
        time.Sleep(time.Second)
    }
}()
```

**Why it hurts.** *"The for{} plus select has no exit, and the goroutine that owns it is going to outlive the HTTP server, the database pool, and your patience."* Detectable via `contextcheck`, `fatcontext`, `noctx`, `lostcancel` (govet); Go 1.26 runtime goroutine-leak profile catches at runtime.

**Rewrite.**
```go
go func() {
    t := time.NewTicker(time.Second); defer t.Stop()
    for {
        select {
        case <-ctx.Done(): return
        case <-t.C:
            if err := poll(ctx); err != nil { log.Print(err) }
        }
    }
}()
```

**See in `/sublime`:** [references/concurrency.md](references/concurrency.md).

---

### `forgotten-sender-leak`

**Tags:** `AI-slop` · `Review` · `Lang:Go`

**Pattern.** Unbuffered channel; goroutine sends a single result; the parent returns early (timeout, cancellation) before the receive. The sender blocks on send forever.

**Forbidden example.**
```go
ch := make(chan Result)
go func() { ch <- work() }()
select {
case r := <-ch: return r
case <-ctx.Done(): return Result{}  // goroutine blocks forever on ch<-
}
```

**Why it hurts.** Classic Ardan Labs leak pattern. Not caught by `go vet` or `-race`. The goroutine lingers until program exit, holding whatever resources `work()` allocated. `go.uber.org/goleak` in tests.

**Rewrite.**
```go
ch := make(chan Result, 1)   // buffer of 1 lets sender complete
go func() { ch <- work() }()
select {
case r := <-ch: return r
case <-ctx.Done(): return Result{}
}
```

**See in `/sublime`:** [references/concurrency.md](references/concurrency.md).

---

### `loopvar-capture-pre-1.22`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `for _, v := range xs { go func() { use(v) }() }` on Go ≤1.21 — every goroutine sees the same `v`.

**Forbidden example.**
```go
// go.mod: go 1.21
for _, user := range users {
    go func() { notify(user) }()   // all goroutines see the last user
}
```

**Why it hurts.** Pre-1.22, loop variables have one address across iterations. Every spawned goroutine captures the same `user` reference; all run against the last element. LLMs still emit the buggy form because training data predates 1.22. `copyloopvar`, `loopclosure` (govet), `exportloopref`.

**Rewrite.**
```go
for _, user := range users {
    user := user   // shadow to new per-iteration variable
    go func() { notify(user) }()
}
// or bump go.mod to 1.22+ and write the direct form
```

**See in `/sublime`:** [references/concurrency.md](references/concurrency.md).

---

### `rwmutex-premature`

**Tags:** `AI-slop` · `Review` · `Lang:Go`

**Pattern.** `sync.RWMutex` where `sync.Mutex` would do — balanced reads and writes, or short critical sections.

**Forbidden example.**
```go
type Cache struct {
    mu sync.RWMutex
    m  map[string]int
}
func (c *Cache) Get(k string) int {
    c.mu.RLock(); defer c.mu.RUnlock()
    return c.m[k]   // ~ns critical section
}
```

**Why it hurts.** [golang/go#17973](https://github.com/golang/go/issues/17973): *"the performance of sync.RWMutex.R{Lock,Unlock} degrades dramatically as GOMAXPROCS increases."* Cache-line contention on the reader-count atomic makes RWMutex slower than plain Mutex under many readers on short sections. LLMs auto-upgrade to RWMutex because "reads are safe in parallel."

**Rewrite.** Use `sync.Mutex`. Measure before reaching for `RWMutex` — it only wins on read-dominated, long critical sections.

**See in `/sublime`:** [references/concurrency.md](references/concurrency.md).

---

### `defer-in-loop`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `defer f.Close()` inside a `for` loop — all `Close` calls queue until function exit.

**Forbidden example.**
```go
for _, path := range paths {
    f, err := os.Open(path)
    if err != nil { return err }
    defer f.Close()           // queues — does NOT close this iteration
    process(f)
}
```

**Why it hurts.** Andrei Boar: *"you run out of file descriptors."* A thousand iterations queue a thousand `Close` calls; the function holds FDs for its entire duration. `gocritic deferInLoop`; `revive defer`.

**Rewrite.**
```go
for _, path := range paths {
    if err := processFile(path); err != nil { return err }
}
func processFile(path string) error {
    f, err := os.Open(path)
    if err != nil { return err }
    defer f.Close()           // scopes to processFile exit
    return process(f)
}
```

**See in `/sublime`:** [SKILL.md#defer-and-resource-cleanup](SKILL.md#defer-and-resource-cleanup).

---

### `missing-defer-body-close`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `http.Get(url)` followed by reading the body with no `defer resp.Body.Close()`.

**Forbidden example.**
```go
resp, err := http.Get(url)
if err != nil { return err }
body, _ := io.ReadAll(resp.Body)
return string(body)   // body never closed
```

**Why it hurts.** Manish Jain: *"you MUST always read the response.Body and close it, irrespective of whether you need it or not."* Breaks keep-alive connection reuse (the connection never returns to the pool); under load exhausts the client's ephemeral port range. `bodyclose`, `sqlclosecheck`, `rowserrcheck`, `gosec G307`.

**Rewrite.**
```go
resp, err := http.Get(url)
if err != nil { return "", err }
defer resp.Body.Close()
body, err := io.ReadAll(resp.Body)
if err != nil { return "", fmt.Errorf("read body: %w", err) }
return string(body), nil
```

**See in `/sublime`:** [SKILL.md#defer-and-resource-cleanup](SKILL.md#defer-and-resource-cleanup), [references/resources.md](references/resources.md).

---

### `background-in-handler`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `context.Background()` or `context.TODO()` inside an HTTP handler, bypassing the request context.

**Forbidden example.**
```go
func handler(w http.ResponseWriter, r *http.Request) {
    ctx := context.Background()
    u, err := db.GetUser(ctx, r.URL.Query().Get("id"))
    ...
}
```

**Why it hurts.** Breaks cancellation and deadline propagation. Client disconnects don't stop the DB query; slow consumers pile up; the process backlogs. Go blog: *"it can be quite dangerous … your process could backlog and exhaust its resources."* `contextcheck`.

**Rewrite.**
```go
func handler(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()
    u, err := db.GetUser(ctx, r.URL.Query().Get("id"))
    ...
}
```

**See in `/sublime`:** [SKILL.md#concurrency-and-context](SKILL.md#concurrency-and-context).

---

### `context-in-struct-field`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `type Worker struct { ctx context.Context; ... }` — storing a Context as a struct member.

**Forbidden example.**
```go
type Worker struct {
    ctx  context.Context
    jobs chan Job
}
func (w *Worker) Do(j Job) error { return process(w.ctx, j) }
```

**Why it hurts.** The `context` godoc: *"Do not store Contexts inside a struct type; instead, pass a Context explicitly to each function that needs it."* Freezes the context at construction; per-call timeouts and cancellation signals from real callers never reach the work. `containedctx`.

**Rewrite.**
```go
type Worker struct { jobs chan Job }
func (w *Worker) Do(ctx context.Context, j Job) error { return process(ctx, j) }
```

**See in `/sublime`:** [references/concurrency.md](references/concurrency.md).

---

### `string-key-context-value`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `context.WithValue(ctx, "userID", id)` with a built-in string (or int) key.

**Forbidden example.**
```go
ctx = context.WithValue(ctx, "userID", u.ID)
...
id := ctx.Value("userID").(string)
```

**Why it hurts.** `context` godoc: *"key … should not be of type string or any other built-in type to avoid collisions between packages using context."* Two packages using `"userID"` collide silently. staticcheck `SA1029`.

**Rewrite.**
```go
type ctxKey int
const userIDKey ctxKey = iota

ctx = context.WithValue(ctx, userIDKey, u.ID)
id, _ := ctx.Value(userIDKey).(string)
```

**See in `/sublime`:** [references/concurrency.md](references/concurrency.md).

---

### `lost-cancel`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** Discarding the `cancel` function from `context.WithTimeout`/`WithCancel`.

**Forbidden example.**
```go
ctx, _ := context.WithTimeout(parent, 5*time.Second)
return fetch(ctx)
```

**Why it hurts.** `cancel` releases the timer and child-context resources; dropping it leaks them until the timeout naturally fires. Nested in a loop, this is a classic "fat context" leak. `go vet lostcancel`; `fatcontext` linter. Claude frequently drops `cancel`.

**Rewrite.**
```go
ctx, cancel := context.WithTimeout(parent, 5*time.Second)
defer cancel()
return fetch(ctx)
```

**See in `/sublime`:** [references/concurrency.md](references/concurrency.md).

---

### `stuttering-type-name`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** Type names that repeat the package name — `user.UserService`, `http.HTTPClient`, `json.JSONDecoder`.

**Forbidden example.**
```go
// package user
type UserService struct{ ... }
func NewUserService() *UserService { ... }
```

**Why it hurts.** Rob Pike: *"A package's name is part of every name it exports."* Every caller writes `user.UserService`, reading "user user service." Canonical LLM output when scaffolding CRUD modules. staticcheck `ST1003`/`ST1016`; revive `exported`.

**Rewrite.**
```go
// package user
type Service struct{ ... }
func NewService() *Service { ... }
// caller writes user.Service, user.NewService
```

**See in `/sublime`:** [SKILL.md#struct-and-package-organization](SKILL.md#struct-and-package-organization).

---

### `new-returns-interface`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `func NewX() IX` — constructor returns an interface instead of a concrete type.

**Forbidden example.**
```go
type Store interface { Get(id string) (*User, error) }
type pgStore struct{ ... }
func NewStore() Store { return &pgStore{} }   // caller can't see concrete methods
```

**Why it hurts.** Violates *"Accept interfaces, return structs."* Callers lose the ability to call methods added to `*pgStore` that weren't in the interface; they pay dynamic dispatch on every call. `ireturn`.

**Rewrite.**
```go
type Store struct{ ... }
func NewStore() *Store { return &Store{} }
// consumer package declares its own interface if needed
```

**See in `/sublime`:** [SKILL.md#interface-design](SKILL.md#interface-design).

---

### `utils-common-helpers`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `package utils`, `util`, `common`, `helpers`, `misc`, `shared`, `base`.

**Forbidden example.**
```go
// internal/utils/utils.go
package utils
func StringContains(s []string, t string) bool { ... }
func ParseDate(s string) (time.Time, error) { ... }
func HashBytes(b []byte) string { ... }
```

**Why it hurts.** Dave Cheney: *"its name doesn't reflect its purpose, only its function in breaking the import cycle. [A little] duplication is far cheaper than the wrong abstraction."* A grab bag accretes over a project's lifetime and becomes the coupling hotspot. LLMs trained on enterprise Go produce it reflexively. `forbidigo` with a custom rule.

**Rewrite.** Move each function to the package that owns the concept. `ParseDate` belongs in the package that deals with dates; `HashBytes` in the crypto package; `StringContains` is just `slices.Contains` on 1.21+.

**See in `/sublime`:** [SKILL.md#struct-and-package-organization](SKILL.md#struct-and-package-organization).

---

### `pkg-cargo-cult`

**Tags:** `AI-slop` · `Review` · `Lang:Go`

**Pattern.** Scaffolding a top-level `/pkg` directory as in `golang-standards/project-layout`.

**Forbidden example.**
```
myproject/
  cmd/
    server/
  pkg/
    user/
    auth/
  internal/
```

**Why it hurts.** Russ Cox in [golang-standards/project-layout#117](https://github.com/golang-standards/project-layout/issues/117): *"the vast majority of packages in the Go ecosystem do not put the importable packages in a pkg subdirectory. … It is unfortunate that this is being put forth as 'golang-standards' when it really is not."* `pkg/` adds indirection with zero enforcement benefit — unlike `internal/`, which the compiler enforces. Claude and GPT-4 consistently propose this layout.

**Rewrite.**
```
myproject/
  cmd/server/
  user/
  auth/
  internal/       # for truly private code only
```

**See in `/sublime`:** [SKILL.md#struct-and-package-organization](SKILL.md#struct-and-package-organization).

---

### `manual-contains-loop`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `for _, x := range s { if x == target { return true } }` instead of `slices.Contains`.

**Forbidden example.**
```go
func HasID(ids []string, id string) bool {
    for _, x := range ids {
        if x == id { return true }
    }
    return false
}
```

**Why it hurts.** The canonical LLM Go slop pattern, called out directly in the Go team's [go fix blog post](https://go.dev/blog/gofix). `modernize slicescontains` auto-fixes; Go 1.26 `go fix` applies it automatically.

**Rewrite.**
```go
func HasID(ids []string, id string) bool { return slices.Contains(ids, id) }
```

**See in `/sublime`:** [SKILL.md#stdlib-modernization-and-generics](SKILL.md#stdlib-modernization-and-generics), [references/stdlib.md](references/stdlib.md).

---

### `ioutil-post-deprecation`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `ioutil.ReadAll`, `ioutil.ReadFile`, `ioutil.TempDir`, `ioutil.WriteFile` on Go 1.16+.

**Forbidden example.**
```go
import "io/ioutil"
body, err := ioutil.ReadAll(resp.Body)
```

**Why it hurts.** Deprecated in Go 1.16 (February 2021). Its continued presence dates the training data. Every function has a home in `io` or `os`. staticcheck `SA1019`.

**Rewrite.**
```go
import "io"
body, err := io.ReadAll(resp.Body)
// also: os.ReadFile, os.MkdirTemp, os.WriteFile
```

**See in `/sublime`:** [references/stdlib.md](references/stdlib.md).

---

### `sort-slice-over-slices-sort`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })` where `slices.Sort(s)` works. Also `sort.Ints`/`sort.Strings` (deprecated).

**Forbidden example.**
```go
sort.Slice(ages, func(i, j int) bool { return ages[i] < ages[j] })
```

**Why it hurts.** `slices.Sort` is generic, faster (avoids the closure), and reads as one line. `modernize slicessort` auto-fixes; staticcheck `SA1019` flags `sort.Ints`/`sort.Strings`.

**Rewrite.**
```go
slices.Sort(ages)
// or for structs:
slices.SortFunc(users, func(a, b User) int { return cmp.Compare(a.Age, b.Age) })
```

**See in `/sublime`:** [references/stdlib.md](references/stdlib.md).

---

### `testify-overuse`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** Reflexive use of `stretchr/testify` for `assert.Equal` where stdlib `testing` + `cmp.Diff` suffices.

**Forbidden example.**
```go
import "github.com/stretchr/testify/assert"

func TestSlugify(t *testing.T) {
    assert.Equal(t, "hello-world", slugify("Hello World"))
}
```

**Why it hurts.** Peter Bourgon: *"TDD/BDD packages bring new, unfamiliar DSLs and control structures, increasing the cognitive burden."* testify dominates training corpora; LLMs reach for it by reflex. `testifylint` enforces a subset; `depguard` forbids it outright.

**Rewrite.**
```go
func TestSlugify(t *testing.T) {
    if got, want := slugify("Hello World"), "hello-world"; got != want {
        t.Errorf("slugify = %q, want %q", got, want)
    }
}
```

**See in `/sublime`:** [SKILL.md#testing-and-http-patterns](SKILL.md#testing-and-http-patterns).

---

### `missing-t-helper`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** Test helper functions calling `t.Error`/`t.Fatal` without `t.Helper()`.

**Forbidden example.**
```go
func assertValid(t *testing.T, u *User) {
    if u.Email == "" {
        t.Fatalf("empty email")   // reports this line, not the caller
    }
}
```

**Why it hurts.** Failure line numbers point to the helper, not the caller site that passed the bad input. The test output becomes useless for locating the actual bug. `thelper` linter.

**Rewrite.**
```go
func assertValid(t *testing.T, u *User) {
    t.Helper()
    if u.Email == "" {
        t.Fatalf("empty email")
    }
}
```

**See in `/sublime`:** [references/testing-and-http.md](references/testing-and-http.md).

---

### `no-server-timeouts`

**Tags:** `AI-slop` · `Lint` · `Lang:Go`

**Pattern.** `http.Server{}` with no `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, or `IdleTimeout` — or `http.ListenAndServe` directly, which has none of them.

**Forbidden example.**
```go
http.ListenAndServe(":8080", mux)
// or
srv := &http.Server{Addr: ":8080", Handler: mux}
srv.ListenAndServe()
```

**Why it hurts.** Default timeout is zero, which means infinite, which means slowloris. [Cloudflare's guide](https://blog.cloudflare.com/the-complete-guide-to-golang-net-http-timeouts/) is canonical. A single client that holds an open connection and sends one byte per minute can tie up a connection slot indefinitely. `gosec G112`.

**Rewrite.**
```go
srv := &http.Server{
    Addr:              ":8080",
    Handler:           mux,
    ReadHeaderTimeout: 5 * time.Second,
    ReadTimeout:       30 * time.Second,
    WriteTimeout:      30 * time.Second,
    IdleTimeout:       120 * time.Second,
}
ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
defer stop()
go func() { _ = srv.ListenAndServe() }()
<-ctx.Done()
shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
_ = srv.Shutdown(shutdownCtx)
```

**See in `/sublime`:** [SKILL.md#testing-and-http-patterns](SKILL.md#testing-and-http-patterns).

---

**Cross-reference targets:** [`../../sublime/SKILL.md`](../../sublime/SKILL.md) for the core skill and universal BANs. [`../../sublime/references/errors.md`](../../sublime/references/errors.md) for core error-handling discipline. [`../../anti-patterns/`](../../anti-patterns/) for universal catalog entries. In-extension: [`SKILL.md`](SKILL.md) and the seven `references/` files.
