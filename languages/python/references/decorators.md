# Decorators

Decorators exist to separate cross-cutting concerns from business logic; a decorator stack deeper than two is almost always wrong.

A decorator is a function that takes a function and returns a function. The syntax is sugar — `@foo` above `def bar` means `bar = foo(bar)` — load-bearing at the call site, invisible at the definition. Every decorator you stack on a function is a silent wrapper the reader must understand before they understand what the function does. Your natural failure mode is to reach for a decorator any time a prompt contains the word "production-ready." Stop. The function is the code; the decorator is the glue.

## Taxonomy

- **When a decorator earns its keep.**
- **When not to decorate.**
- **`functools.wraps` and the identity problem.**
- **Parameterized decorators and the three-level dance.**
- **Class decorators vs function decorators.**
- **The standard three: `@property`, `@classmethod`, `@staticmethod`.**
- **`@cached_property` — the narrow win.**
- **`@contextmanager` — decorators that build context managers.**

---

## When a decorator earns its keep

A decorator earns its keep when the same cross-cutting concern is applied at many call sites and the concern is orthogonal to what the function does. Auth on every route. Retry-with-backoff on every network call. Timing on every handler. Caching on a pure function called with the same inputs.

```python
from functools import lru_cache

@lru_cache(maxsize=1024)
def geocode(address: str) -> tuple[float, float]:
    return _call_geocoder(address)
```

The test is the number of call sites. If the wrapper wraps one function with one caller, the abstraction tax is higher than the repetition it eliminated.

**DO** reserve decorators for behavior that repeats across three or more functions.
**DO** prefer the stdlib decorator over a hand-rolled one — `functools.lru_cache`, `functools.cache` (3.9+), `functools.singledispatch`, `contextlib.contextmanager`.

---

## When not to decorate

A decorator is wrong when it is used once, when it hides the only thing the function does, or when the behavior it adds is specific to one call path.

```python
# wrong — a decorator for one function that appears once
def with_logging(fn):
    def inner(*args, **kwargs):
        print(f"calling {fn.__name__}")
        return fn(*args, **kwargs)
    return inner

@with_logging
def process_order(order_id: str) -> None: ...

# right — log inline, no decorator
def process_order(order_id: str) -> None:
    logger.info("processing order", extra={"order_id": order_id})
    ...
```

---

## `functools.wraps` and the identity problem

A naive decorator replaces the wrapped function with a closure. The new function has a different `__name__`, `__doc__`, `__wrapped__`, and signature. Everything that inspects functions by attribute — `pytest` test discovery, FastAPI dependency injection, Sphinx autodoc — now sees the wrapper.

```python
from functools import wraps

def retry(fn):
    @wraps(fn)                    # copies __name__, __doc__, __wrapped__, __qualname__
    def inner(*args, **kwargs):
        for attempt in range(3):
            try:
                return fn(*args, **kwargs)
            except TransientError:
                if attempt == 2:
                    raise
    return inner
```

Without `@wraps`, `retry(foo).__name__ == "inner"`. `functools.wraps` is not optional; it is the contract a decorator has with every tool that introspects Python.

**DO** always apply `@functools.wraps(fn)` inside the inner function of a custom decorator.
**DO NOT** hand-copy `__name__` and `__doc__` — `wraps` handles the full attribute set and sets `__wrapped__` so `inspect.signature` can see through.

---

## Parameterized decorators and the three-level dance

A decorator that takes arguments is a function that returns a decorator. Three levels of function deep — and where most hand-rolled decorator bugs live.

```python
from functools import wraps

def retry(times: int = 3, on: type[BaseException] = Exception):
    def decorator(fn):
        @wraps(fn)
        def inner(*args, **kwargs):
            for attempt in range(times):
                try:
                    return fn(*args, **kwargs)
                except on:
                    if attempt == times - 1:
                        raise
        return inner
    return decorator

@retry(times=5, on=TimeoutError)
def fetch_once() -> bytes: ...
```

Outer takes config, returns a decorator; decorator takes the function, returns a wrapper; wrapper takes `*args, **kwargs`, calls the function. If you write this dance for one caller, you have written a three-level indirection to replace a two-line `for` loop. Inline it.

---

## Class decorators vs function decorators

Class decorators take a class and return a class — the canonical example is `@dataclass`, which synthesizes `__init__`, `__repr__`, `__eq__`. Write a class decorator when you need to rewrite a class. Do not write a class with `__init__` and `__call__` where a closure would do — that is Java ceremony wrapping a nested function.

---

## `@property`, `@classmethod`, `@staticmethod`

- `@property` — attribute-like getter. Use when the caller cares about the value, not the mechanism. If a property does I/O, it has betrayed its contract.
- `@classmethod` — receives the class as the first argument. Canonical use: alternative constructors (`User.from_row(row)`).
- `@staticmethod` — receives nothing. Almost always the wrong choice: if it doesn't use `self` or `cls`, it is a module function wearing class drag.

```python
class User:
    def __init__(self, first: str, last: str) -> None:
        self.first = first
        self.last = last

    @property
    def full_name(self) -> str:
        return f"{self.first} {self.last}"

    @classmethod
    def from_row(cls, row: dict[str, str]) -> "User":
        return cls(first=row["first_name"], last=row["last_name"])
```

## `@cached_property` — the narrow win

`functools.cached_property` (3.8+) computes a value once per instance and stores it on the instance. It earns its keep when a derived attribute is expensive and invariant across the instance's lifetime.

```python
from functools import cached_property

class Document:
    def __init__(self, raw: bytes) -> None:
        self.raw = raw

    @cached_property
    def parsed(self) -> dict:
        return json.loads(self.raw)
```

`cached_property` only makes sense on instances whose relevant state does not mutate. If the class uses `__slots__` without `__dict__`, it does not work — you need a `__dict__` or a different caching approach.

---

## `@contextmanager` from `contextlib`

`@contextlib.contextmanager` turns a generator into a context manager — one `yield`, setup before, teardown after. The right shape for "do A, run the body, do B no matter what."

```python
from contextlib import contextmanager
from time import perf_counter

@contextmanager
def timed(label: str):
    start = perf_counter()
    try:
        yield
    finally:
        print(f"{label}: {perf_counter() - start:.3f}s")

with timed("parse"):
    result = parse(data)
```

When you reach for a decorator to add "do something before and after," ask first whether a `with` block would read better at the call site. Often it does.

---

## Decorator comparison

| Decorator | Purpose | Alternative | When stacking earns its keep |
|---|---|---|---|
| `@functools.lru_cache` / `@cache` | memoize a pure function | manual dict + key | one-site memoization; never stack with `@retry` — you cache failures |
| `@property` | attribute-like getter | plain method | never stack |
| `@classmethod` | alternative constructor | module-level factory | never stack |
| `@staticmethod` | namespaced function on a class | module function | almost never earns its keep |
| `@cached_property` | per-instance memoized attribute | `@property` + manual cache | never stack |
| `@contextmanager` | generator-based `with` block | class with `__enter__`/`__exit__` | never stack |
| `@dataclass` | synthesize `__init__`/`__repr__`/`__eq__` | hand-written `__init__` | stack only with `@dataclass(frozen=True, slots=True)` as one call |
| custom `@retry` | retry a call on transient failure | explicit `for attempt in range(n):` | stacks with `@timeout` if both apply at every call site |
| custom `@auth_required` | gate access to a handler | inline check | stacks with framework router decorator |
| custom `@trace` | emit a span | `with tracer.span(...)` inside | rarely earns a stack slot — it is the first thing that becomes redundant |

Most decorators you'd want to stack are stdlib. Most stacks of three or more are custom. The stack is the smell.

---

## Common AI failure modes

**`observability-stack`** — `@retry @cache @timed @traced @log` stacked on a five-line function. The wrappers are larger than the body; none of them is used on any other function. The rewrite is structural: pick one (usually `@retry` *or* a single tracing middleware at the router level), delete the rest, move logging into a shared wrapper at the boundary. Tracing at every function is not observability; it is noise that drowns the signal.

**`custom-decorator-for-one-use`** — a hand-rolled `@with_session` at exactly one call site. The `with` block it replaces is three lines. Delete the decorator; use the context manager directly. Extract only when a second caller appears — by then you will know the shape, not guess it.

**`missing-functools-wraps`** — a decorator whose inner function has no `@wraps`. `__name__ == "inner"`, `__wrapped__` unset, `inspect.signature` sees `(*args, **kwargs)`. Pytest fails to discover wrapped tests; FastAPI DI resolves the wrong parameters; Sphinx produces empty docstrings. One-line fix: `from functools import wraps; @wraps(fn)` above `def inner`.

**`class-decorator-where-function-works`** — a class with `__init__` and `__call__` used as a decorator. No state persists across calls, no methods other than `__call__` — it is a closure written with more syntax. Rewrite as a nested function. Class decorators earn their keep only when they genuinely rewrite a class (`@dataclass`), not when they wrap a function.

**`staticmethod-spam`** — `@staticmethod` methods on a class that do not use `self` or `cls`, called only through instances. The method is a module function that was put in a class because "utilities go in classes" in Java. Move it to module scope. If the class's only purpose is to namespace static methods, use a module instead.

---

### Avoid

- Stacks of three or more decorators — the stack is larger than the function it wraps.
  — Each wrapper is indirection the reader must unwrap; three wrappers for four lines of logic means the function is glue.
- Hand-rolled decorators used at one call site.
  — The second-caller rule applies: no second caller means no abstraction yet. Use a `with` block or inline call.
- Custom decorators missing `@functools.wraps(fn)` inside the inner function.
  — Breaks pytest discovery, FastAPI DI, Sphinx, `inspect.signature`, and every future tool that introspects functions.
- `class MyDecorator` with `__init__` and `__call__` where a closure would do.
  — Class ceremony around a closure is Java in Python drag. Use the nested function.
- `@staticmethod` on a method that uses neither `self` nor `cls`.
  — It is a module function in a trench coat. Move it to module scope.
- `@property` that performs I/O or mutation.
  — Properties look like attribute reads; callers do not expect them to hit the network or mutate state.
- `@cached_property` on an instance whose state mutates.
  — The cache is now a correctness bug, not an optimization.
- `@retry` on a non-idempotent operation.
  — You are retrying writes. That is duplication, not resilience.
- `@lru_cache` on a method that holds `self`.
  — The cache pins the instance forever and the hash is object identity, not field equality.
- Decorators that mutate global state on import.
  — Side effects at import time turn `import` into a runtime event and break test isolation.

See [`../SKILL.md`](../SKILL.md) for the Python posture and slop tells.
See [`../anti-patterns.md`](../anti-patterns.md) for the full `observability-stack` and related entries.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core code-craft foundation.
See [`../../../sublime/references/interfaces.md`](../../../sublime/references/interfaces.md) for the universal second-caller rule.
See [`../../../anti-patterns/gratuitous-abstraction.md`](../../../anti-patterns/gratuitous-abstraction.md) for cross-language abstraction tax entries.
See [`imports-and-packaging.md`](imports-and-packaging.md) for module-level wiring that decorators often try to replace.
