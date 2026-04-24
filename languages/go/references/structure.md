# Structure

Go's unit of encapsulation is the package; Go's rules for type design favor the zero value, unstuttered names, and consistent receivers — and the biggest package-organization slop is cargo-culted Java layout: one file per struct, a top-level `/pkg`, and utility-named packages that describe nothing.

A Go codebase reads outside-in from its package names. Before opening a file you already know what `net/http`, `encoding/json`, and `crypto/tls` do — that is the cost the standard library pays to keep its import sites legible. Your natural failure mode, amplified by training data saturated with enterprise Java and Clean Architecture scaffolds, is to shard every struct into its own file, invent a `utils` package, mirror a `/pkg` tree, and declare interfaces next to the one struct that implements them. None of these shapes are Go.

## Taxonomy

- **The package as the unit of organization.**
- **Package names — short, lowercase, non-stuttering.**
- **`utils`, `common`, `helpers`, `misc` — names that describe nothing.**
- **`internal/` as the real visibility boundary.**
- **Stuttering identifiers.**
- **Receiver types — value, pointer, and the no-mixing rule.**
- **Zero values — making them useful.**
- **Struct tags — consistency and silent data loss.**
- **`init()` side effects.**
- **`NewX` constructors vs exposed zero values.**

---

## The package is the unit

Go organizes by package, not by class. The standard library is the reference: `net/http` contains `client.go`, `server.go`, `transport.go`, `request.go`, `response.go` — each file groups a concept, not a single exported type.

```go
// good — net/http-shaped
billing/
    invoice.go      // Invoice, InvoiceID, Create, Void
    statement.go    // Statement, Render
    money.go        // Money, Parse, Format

// bad — Java layout ported to Go
billing/
    Invoice.go
    InvoiceService.go
    InvoiceRepository.go
    InvoiceController.go
```

The Java layout loses on three axes: files have no cohesion, imports stutter (`billing.InvoiceService`), and the package — the real unit of encapsulation — is invisible.

---

## Package names

A package name is short, lowercase, all-one-word, and a noun — it participates in every identifier it exports. `http.Client`, `json.Decoder`, `sql.DB`. Rob Pike: *"A package's name is part of every name it exports."*

```go
// good                       // bad — stutters
package billing               package billing
func Create(...) Invoice      func CreateInvoice(...) Invoice
// billing.Create(...)        // billing.CreateInvoice — "billing billing"
```

Russ Cox on `/pkg` ([golang-standards/project-layout#117](https://github.com/golang-standards/project-layout/issues/117)): *"the vast majority of packages in the Go ecosystem do not put the importable packages in a pkg subdirectory."* A top-level `/pkg/` adds a path segment with zero visibility effect (unlike `internal/`), and the layout repo that popularized it is not a Go team artifact. Do not scaffold `cmd/ + pkg/ + internal/` reflexively.

---

## `utils`, `common`, `helpers`, `misc`

Dave Cheney: *"Avoid package names like base, util, or common."* The name describes the package's role in the import graph (the thing other packages reach into) and nothing about what it contains. Two weeks later it holds four unrelated concepts welded together by a filename.

```go
// slop
package utils
func Contains[T comparable](s []T, v T) bool { ... } // use slices.Contains
func RetryN(...)                                     // belongs in a retry package

// fix — name by content, not role
package retry
func Do(ctx context.Context, fn func() error, opts Options) error { ... }
```

If the helper has no home, invent the concept. `retry`, `ids`, `money` — each earns its existence by being a unit of cohesion.

---

## `internal/` is the real boundary

Go enforces one import rule at the toolchain level: any package under an `internal/` directory is importable only by packages rooted at `internal/`'s parent. Everything else is convention. `/pkg` is convention. `internal/` is the compiler.

```
myapp/
    cmd/myapp/main.go
    billing/           // public-ish if the module is a library
    internal/
        store/         // only importable by myapp/... packages
        config/
```

Put anything you do not want external callers importing under `internal/`. Do not rely on "please don't import this" comments.

---

## Stuttering

An exported identifier is always read as `package.Identifier`. If the identifier repeats the package, you read the name twice.

```go
// slop                         // fix
package user                    package user
type UserService struct{ ... }  type Service struct{ ... }
type UserRepository interface{} type Repository interface{ ... }
// user.UserService              // user.Service, user.Repository
```

staticcheck `ST1003` / `ST1016` and `revive exported` flag these mechanically. The pattern is the LLM-canonical shape for scaffolded CRUD.

---

## Receiver types

The Go code review comments are explicit: *"Don't mix receiver types."* Mixed receivers confuse interface satisfaction — only pointer-receiver methods are in the method set of `*T`; the mixture lets callers hold a copy and mutate through a pointer method they didn't expect.

```go
// slop — mixed
func (u User) Greeting() string { ... }         // value
func (u *User) SetName(n string) { u.Name = n } // pointer

// fix — pointer on everything if any method mutates
func (u *User) Greeting() string { ... }
func (u *User) SetName(n string) { u.Name = n }
```

Rule of thumb: pointer receivers if the method mutates, the struct is large, or the type embeds a non-copyable field (`sync.Mutex`). Value receivers only for tiny, immutable, pure-data types. `recvcheck` and `revive receiver-naming` detect the mismatch.

---

## Zero values

Rob Pike: *"Make the zero value useful."* `sync.Mutex{}` is ready to lock, `bytes.Buffer{}` is ready to write, `time.Time{}` is the zero instant — none require a `New` call.

```go
// bad — zero value panics (nil map)
type Cache struct { m map[string]any }
func (c *Cache) Set(k string, v any) { c.m[k] = v }

// good — lazy-init, zero value works
type Cache struct {
    mu sync.Mutex
    m  map[string]any
}
func (c *Cache) Set(k string, v any) {
    c.mu.Lock(); defer c.mu.Unlock()
    if c.m == nil { c.m = make(map[string]any) }
    c.m[k] = v
}
```

A `NewCache()` is fine when construction genuinely requires validation (a pool with a configured size, a client with a required URL). If it exists solely to initialize a map, make the zero value lazy instead.

---

## Struct tags

Struct tags are silent: a typo, a missing tag, or inconsistent casing does not fail compilation — it fails at runtime with dropped fields.

```go
// slop — inconsistent, silent data loss
type User struct {
    ID       int    `json:"userId"`     // camelCase
    UserName string `json:"user_name"`  // snake_case — mixed
    Email    string                     // missing — key is "Email"
}

// fix — one convention
type User struct {
    ID       int    `json:"id"`
    UserName string `json:"user_name"`
    Email    string `json:"email"`
}
```

`go vet structtag` catches malformed syntax. `musttag` and `tagliatelle` catch inconsistent conventions and missing tags on exported fields.

---

## `init()` side effects

Peter Bourgon: *"the only job of `func init` is to initialize package global state, so I think it's best understood as a serious red flag."* Opening a DB, reading env vars, or parsing flags in `init()` makes imports side-effectful; tests lose isolation and the package cannot be used as a library.

```go
// slop
func init() {
    db, err = sql.Open("postgres", os.Getenv("DATABASE_URL"))
    if err != nil { log.Fatal(err) }
}

// fix — explicit constructor, caller controls
func Open(ctx context.Context, dsn string) (*DB, error) {
    db, err := sql.Open("postgres", dsn)
    if err != nil { return nil, err }
    return &DB{db}, db.PingContext(ctx)
}
```

`gochecknoinits` and `gochecknoglobals` forbid the pattern outright.

---

## `NewX` vs exposed zero value

Two legitimate styles: expose a zero-value-usable struct, or expose `NewX` when construction genuinely requires validation. The failure mode is `NewX` that returns an interface.

```go
// slop — returns an interface the caller didn't ask for
type Store interface { Get(id string) (User, error) }
func NewStore(db *sql.DB) Store { return &pgStore{db} }

// fix — return the struct
type Store struct { db *sql.DB }
func NewStore(db *sql.DB) *Store { return &Store{db: db} }
```

Jack Lindamood's proverb: *"Accept interfaces, return structs."* The caller gets a concrete `*Store` and can assign it to whatever interface they define on their side of the import graph.

---

## Shape comparison

| Package / type shape | Idiomatic Go | Slop signal |
|---|---|---|
| `billing/` contains `invoice.go`, `money.go` grouped by concept | Yes | `billing/Invoice.go`, `billing/InvoiceService.go` (Java-shard) |
| `package billing; func Create(...) Invoice` | Yes | `package billing; func CreateInvoice(...)` (stutter) |
| `package retry` with `retry.Do(...)` | Yes | `package utils` with `utils.Retry(...)` |
| `internal/store` (compiler-enforced) | Yes | `pkg/store` (convention, enforces nothing) |
| `user.Service`, `user.Repository` | Yes | `user.UserService`, `user.UserRepository` |
| All methods on `*User` | Yes | Half on `User`, half on `*User` |
| `var c Cache; c.Set("k", 1)` works | Yes | `Cache{}` panics; must call `NewCache()` |
| Consistent `json:"snake_case"` across a struct | Yes | `json:"userId"` next to `json:"user_name"` |
| `func Open(ctx, dsn) (*DB, error)` | Yes | `func init() { db = sql.Open(...) }` |
| `func NewStore(db) *Store` returning the struct | Yes | `func NewStore(db) Store` returning an interface |

---

## Common AI failure modes

**`mixed-receivers`** — same type has both value and pointer receiver methods. Interface satisfaction becomes method-dependent; callers stumble on copies where they expected references. Pick one and let `recvcheck` enforce it.

**`zero-value-broken`** — struct panics on first use because a map or channel field is `nil`; the model adds `NewX` to paper over it. Lazy-init the field, or document that the zero value is explicitly not usable.

**`stuttering-type-name`** — `user.UserService`, `http.HTTPClient`, `config.ConfigOptions`. The package is in scope at every call site; repeating it is noise. Rename to `user.Service`, `http.Client`, `config.Options`.

**`new-returns-interface`** — `func NewStore() Store` where `Store` is an interface declared beside the one concrete implementation. Blocks inlining, forces heap escape, welds callers to your interface. Return the struct.

**`missing-wrong-struct-tags`** — mixed casing in one struct (`json:"userId"` next to `json:"user_name"`), or missing tags on exported fields. Silent data loss on (un)marshal. Enforce with `tagliatelle`.

**`utils-common-helpers`** — `package utils`, `common`, `helpers`, `misc`, `shared`. Dave Cheney: *"its name doesn't reflect its purpose, only its function in breaking the import cycle."* Rename by content.

**`pkg-cargo-cult`** — top-level `/pkg/` scaffolded from `golang-standards/project-layout`. Russ Cox: *"It is unfortunate that this is being put forth as 'golang-standards' when it really is not."* Use `internal/` for visibility.

**`init-side-effects`** — `func init()` opens databases, reads env vars, configures globals. Imports become side-effectful; tests lose isolation. Move to an explicit `Open`/`New`.

**`one-file-per-struct`** — `User.go`, `UserService.go`, `UserRepository.go` at one-struct-per-file granularity. The strongest Java-shape signal. Group by concept.

**`deep-package-hierarchy`** — `internal/domain/services/user/commands/handlers/`. Directory depth substituting for concepts. Flatten.

---

### Avoid

- `package utils`, `package common`, `package helpers`, `package misc`, `package shared`, `package base`.
  — Names that describe a role in the import graph, not contents.
- Top-level `/pkg/` directories scaffolded from `golang-standards/project-layout`.
  — Adds a path segment with no compiler enforcement; `internal/` is the real boundary.
- One exported type per file in Java-style layout.
  — Loses the package as the unit of cohesion.
- Stuttering identifiers — `user.UserService`, `http.HTTPClient`, `config.ConfigLoader`.
  — The package is already in scope at the call site.
- Mixed value and pointer receivers on the same type.
  — Breaks interface satisfaction predictability; pick one.
- Structs whose zero value panics because a map or channel field is `nil`.
  — Either lazy-init or document the non-use-ready zero value; don't paper over with a `New` constructor.
- `NewX()` returning an interface declared in the same package.
  — Violates "accept interfaces, return structs"; blocks inlining; welds callers to your interface shape.
- Mixed-case struct tag conventions within one struct.
  — Silent data loss on (un)marshal.
- `func init()` that opens databases, reads environment variables, or configures globals.
  — Imports become side-effectful; tests lose isolation.
- Deep nested package hierarchies (`internal/domain/services/...`) that substitute folders for concepts.
  — Depth is not organization.

See [`../SKILL.md`](../SKILL.md) for the Go posture and hard bans.
See [`../anti-patterns.md`](../anti-patterns.md) for the named catalog entries on package naming and type shape.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core code-craft foundation.
See [`../../../sublime/references/interfaces.md`](../../../sublime/references/interfaces.md) for the universal module-boundary discipline.
See [`../../../sublime/references/naming.md`](../../../sublime/references/naming.md) for cross-language naming rules.
See [`../../../anti-patterns/file-organization.md`](../../../anti-patterns/file-organization.md) for catalog entries on layout cargo cults.
See [`stdlib.md`](stdlib.md) for the stdlib-symbols-you-should-be-using reference.
See [`testing-and-http.md`](testing-and-http.md) for testing and HTTP server structure.
