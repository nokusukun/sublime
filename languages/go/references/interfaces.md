# Interfaces

Accept interfaces, return structs — the interface is discovered, not designed, and it belongs at the consumer side once two concrete implementations exist, not preemptively at the producer side.

Go's interface system is structural: a type satisfies an interface if it has the methods, with no `implements` keyword to declare the relationship. This makes interfaces cheap to introduce — but only in the direction Go actually wants them. Consumers declare the small interface they need, and every concrete type that fits is usable. Producers who declare their own interfaces up front, one per struct, recreate the Java hierarchy Go was designed to avoid. AI-generated Go is saturated with this inversion: `Repository` interfaces sitting beside the one `pgRepository` that implements them, `NewFoo` constructors that return the interface instead of the struct, `interface{}` parameters where generics or a concrete type would do. The discipline is subtractive: delete the interface until a second caller needs it, then let its shape emerge from what both callers require.

## "The bigger the interface, the weaker the abstraction"

Rob Pike's line. `io.Reader` and `io.Writer` are one method each. Anything that implements `Read([]byte) (int, error)` is a `Reader` — files, network connections, compressed streams, test doubles, `bytes.Buffer`, standard input. The interface is weak in the sense that it promises little, which is exactly why it is powerful: every type that moves bytes fits, and every function that takes a `Reader` works on all of them.

The reverse shape is a ten-method `UserService` interface with `Create`, `Get`, `Update`, `Delete`, `List`, `Search`, `Activate`, `Deactivate`, `ResetPassword`, `SendEmail`. One struct implements it — the concrete `userService` in the same package. The interface is strong in the sense that it promises a specific API, and for that reason nothing else can satisfy it. It is not an abstraction; it is a duplicate of the struct.

```go
// strong abstraction — one method, satisfied by everything
type Reader interface {
    Read(p []byte) (n int, err error)
}

// weak abstraction — mirrors one struct, satisfied by nothing else
type UserService interface {
    Create(ctx context.Context, u *User) error
    Get(ctx context.Context, id string) (*User, error)
    // ... eight more methods ...
}
```

If you cannot name two concrete types that satisfy your interface, the interface is a struct definition in disguise.

## Producer-side vs consumer-side

Go's idiom inverts the OO default. In Java the producer declares `interface Foo` and ships an implementation; callers depend on the interface. In Go the *consumer* declares the interface it needs, and any producer whose struct fits is usable. This only works because Go interfaces are structural.

```go
// consumer-side — right
package report

type Fetcher interface {
    Fetch(ctx context.Context, id string) ([]byte, error)
}

func Run(ctx context.Context, f Fetcher, id string) (*Report, error) { ... }
```

```go
// producer-side — slop
package userclient

type Client interface {
    Fetch(ctx context.Context, id string) ([]byte, error)
}

type client struct{ /* ... */ }
func (c *client) Fetch(ctx context.Context, id string) ([]byte, error) { ... }

func New() Client { return &client{} }
```

The producer-side version forces dynamic dispatch on every call and heap-escapes the returned value. The consumer-side version keeps the concrete `*client` on the stack, lets the compiler inline calls, and still lets a test in `report/` substitute a fake `Fetcher`.

If two consumers in two packages end up declaring the same three-method interface, that is the moment you promote it — into a neutral package, not the producer's. Interfaces live with the caller until several callers share them.

## "Discover, don't design"

Rob Pike: *"Don't design with interfaces, discover them."* Jack Lindamood codified it: *"Accept interfaces, return structs."* Write the concrete thing first. Use it directly. Introduce an interface the day a second caller needs to substitute a different implementation. Speculation about what an interface "should" look like, before a second implementation exists, produces interfaces that are wrong in ways you cannot see — too wide, too narrow, at the wrong seam.

The slop shape is writing `type Storage interface { ... }` the same commit you write `type pgStorage struct { ... }`. At that point you have one caller, one impl, and an interface that is a transcription of the struct's method set. When a second impl arrives — an in-memory fake for tests, a Redis variant — you discover the interface forced the wrong shape on both, and you refactor. The refactor would not have been needed if you had waited.

## `Repository` / `Service` interfaces that mirror structs 1:1

The enterprise-Java transplant. `type UserRepository interface { Create; Read; Update; Delete }` with exactly one concrete `pgUserRepository` in the same package. Cursor and Copilot agent mode produce it reliably because it looks like "clean architecture" and the model was trained on Spring Boot tutorials.

Andrei Boar: *"If you abuse interfaces by creating many mocks, you end up testing mocks that are never used in production."* The mirror interface exists to be mocked; the mock implements the signatures and returns whatever the test wants; the tests pass. But the tests are verifying that the mock behaves like the mock, not that any code path through the real storage works. When the real `pgUserRepository` breaks, the mirror-mocked tests stay green.

Test against a real implementation where you can — an in-memory SQLite, a real HTTP round-tripper — and reserve mocks for genuine external dependencies (third-party APIs, paid services) where a real call is impractical.

## `any` / `interface{}` — when and when not

`any` (the Go 1.18 alias for `interface{}`) is right in two shapes:

- **JSON decoding when the structure is genuinely dynamic.** `var out any; json.Unmarshal(b, &out)` for inputs whose schema you do not know. If you know the schema, use a struct with JSON tags.
- **Reflection and formatting.** `fmt.Println(v ...any)`, `reflect.ValueOf(x any)`.

Outside those, `any` is a lazy signature for a concrete type or a generic.

```go
// wrong — you know the shape
func SendEmail(params map[string]any) error {
    to := params["to"].(string)       // panics on wrong shape
    ...
}

// right — describe the shape
type EmailParams struct {
    To, Subject, Body string
}
func SendEmail(p EmailParams) error { ... }

// right — generic when the caller's type varies but your code is uniform
func First[T any](xs []T) (T, bool) {
    var zero T
    if len(xs) == 0 { return zero, false }
    return xs[0], true
}
```

With generics, many places that used to reach for `interface{}` now take a type parameter. The parameter constrains what the function can *do* with the value while leaving the concrete type to the caller.

## Returning structs from constructors

A constructor that returns an interface hides the concrete type from every caller. Hiding is occasionally useful — to prevent callers reaching for private methods, to let you swap implementations later. It is almost never useful when there is one implementation.

```go
// wrong — interface return, one impl
func NewStore() Store { return &pgStore{db: openDB()} }

// right — struct return, caller picks what it needs
func NewStore() *PGStore { return &PGStore{db: openDB()} }
```

The struct-return version gives the caller the richest possible type. If a downstream package wants to accept this store through a two-method interface, it declares that interface in its own package and the `*PGStore` satisfies it structurally. Everyone gets what they need; nobody pays for a wider indirection than they use. Returning an interface from a constructor is the single most common shape of producer-side slop. `ireturn` lints for it.

## Satisfaction by embedding

Go composes interfaces the same way it composes structs — by embedding.

```go
type Reader interface { Read(p []byte) (n int, err error) }
type Writer interface { Write(p []byte) (n int, err error) }
type Closer interface { Close() error }

type ReadCloser interface {
    Reader
    Closer
}
```

This is how the standard library avoids ten-method interfaces. A function that only reads takes a `Reader`; a function that reads and closes takes a `ReadCloser`; the same `*os.File` satisfies both. When you design a new interface, embed the smaller ones you already have instead of writing a flat wide one.

## Mocking without producer-side interfaces

The most common justification for a producer-side interface is "I need it for tests." You do not.

```go
// production — no interface
package mail
type Sender struct { /* config */ }
func (s *Sender) Send(ctx context.Context, to, subj, body string) error { ... }
```

```go
// caller package — declares the tiny interface it needs
package signup

type mailer interface {
    Send(ctx context.Context, to, subj, body string) error
}
func NewHandler(m mailer) *Handler { return &Handler{m: m} }
```

```go
// caller's test — fake that fits the caller's interface
type fakeMailer struct{ sent []string }
func (f *fakeMailer) Send(ctx context.Context, to, subj, body string) error {
    f.sent = append(f.sent, to); return nil
}
```

The `mail.Sender` struct exports no interface. The consumer declares a one-method `mailer`. Production uses `*mail.Sender`; tests use `*fakeMailer`. The structural match does the work.

## Shape table

| Interface shape | Who declares it | Compile-time enforcement | When to use |
|---|---|---|---|
| Single-method (`Reader`, `Stringer`) | Producer or shared contract package | Structural; any matching type fits | Many concrete types already share a one-line shape |
| Consumer-defined, small (1–3 methods) | Consumer package | Structural | Default for dependency injection and testability |
| Producer-defined, mirrors one struct | Producer package | Structural but single impl | Almost never; delete and return the struct |
| Empty interface (`any`) | Anywhere | None | Dynamic JSON, reflection, `fmt` — nowhere else |
| Embedded composite (`ReadCloser`) | Wherever components live | Composition of smaller contracts | Combine small interfaces instead of flattening |
| Generic constraint (`comparable`, `Ordered`) | Constraint package or caller | Compile-time on the type parameter | Heterogeneity *and* compile-time safety |
| Mock-only for a single impl | Producer "for testability" | Structural but one impl in prod | Never; move it to the caller |

## Common AI failure modes

- **`preemptive-single-impl-interface`** — an interface in the producer package with exactly one implementation in the same package and no external caller that needs a second. Rob Pike: *"Don't design with interfaces, discover them."* Adds indirection, blocks inlining, escapes values to the heap. `iface` and `interfacebloat` flag many of these. Delete the interface; return the struct; let a caller declare a consumer-side interface the day a second impl appears.
- **`producer-side-interface`** — `func NewServer() Server` where `Server` is an interface defined in the same package as the implementation. Violates *"Accept interfaces, return structs."* Forces dynamic dispatch and heap escape at every call site. `ireturn` catches it. Return `*server`; callers that want a narrower view declare their own interface.
- **`interface-any-abuse`** — `interface{}` / `any` parameters and `map[string]any` for structured data when a concrete struct or a generic type parameter would do. Common when LLMs port Python or JavaScript code without translating the type model. Use a struct for known shapes; use a generic `[T any]` when the code is uniform over an unknown type; reserve `any` for reflection and genuinely dynamic JSON.
- **`repository-service-mirror`** — `type UserRepository interface { Create; Read; Update; Delete }` with exactly one concrete `pgUserRepository`, "for testability." Endemic in LLM-generated "clean architecture" scaffolds. Andrei Boar: *"If you abuse interfaces by creating many mocks, you end up testing mocks that are never used in production."* Delete the interface; test against a real lightweight implementation; reserve mocks for genuine external dependencies.
- **`empty-interface-for-json`** — `var out map[string]interface{}` for unmarshalling when a struct with JSON tags would work. `musttag` and `tagliatelle` flag the caller side. Describe the shape with a struct; the compiler catches typos and wrong types.
- **`new-returns-interface`** — `func NewStore() Store { return &pgStore{} }`. The canonical return-side shape of "accept interfaces, return structs" violations. `ireturn` catches it. Return `*PGStore`; let each caller take whatever interface its own package defines.

### Avoid

- Declaring an interface in the same package as its only implementation.
  — No caller benefits; the indirection costs inlining and stack allocation.
- Returning an interface from a constructor when you have one concrete type.
  — Hides the type from every caller and forces dynamic dispatch; `ireturn` catches it.
- `type FooService interface { /* every method of fooService */ }` with one impl.
  — Mirror interfaces exist to be mocked; mocks that mirror a single impl test the mock, not the code.
- `any` or `interface{}` in a signature for data whose shape you control.
  — Every access is a typed assertion that can panic; a struct or generic is always better.
- `map[string]interface{}` for JSON you own the schema of.
  — Callers must remember every key and its type; a tagged struct is compile-time-safe.
- A ten-method interface where composition of two-method interfaces would work.
  — *"The bigger the interface, the weaker the abstraction."* Embed small interfaces instead.
- Producer-package mock interfaces for internal dependencies.
  — Move the interface to the consumer; production uses the struct, tests use a fake.
- `interface{}` parameters when Go 1.18 generics would give you a typed parameter.
  — Generics preserve the caller's type through the function; `any` throws it away.
- Extracting an interface "for flexibility" when no second caller exists.
  — Wait until two callers need the abstraction; the shape emerges from what both require.
- Reflection and type switches to implement polymorphism a small consumer-side interface would give you.
  — The interface is shorter, faster, and extensible without editing a central dispatcher.

→ For the second-caller rule and the preemptive-interface trap framing that this file extends, see [../../../sublime/references/interfaces.md](../../../sublime/references/interfaces.md). For parent governing claims, see [../SKILL.md](../SKILL.md) and [../../../sublime/SKILL.md](../../../sublime/SKILL.md). For shared catalog entries on Factory/Strategy/Provider spam, single-use interfaces, and wrapper-that-forwards-args, see [../../../anti-patterns/gratuitous-abstraction.md](../../../anti-patterns/gratuitous-abstraction.md) and [../../../anti-patterns/architectural-slop.md](../../../anti-patterns/architectural-slop.md). For Go-specific anti-patterns beyond interfaces, see [../anti-patterns.md](../anti-patterns.md). For the error-side discipline that pairs with this one, see [errors.md](errors.md).
