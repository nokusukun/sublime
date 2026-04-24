# Typing

Type hints are documentation the computer can check; default to them and skip only when the cost genuinely exceeds the benefit.

Python is gradually typed — the checker only knows what you tell it. A signature without annotations is a signature the checker cannot help you with, and one `Any` propagates through every caller that touches it. The payoff is not catching the bug the first time; it is catching the bug the *fifth* time you refactor, when a callsite you forgot disagrees with a contract you changed. A little friction now for a lot of friction later, pushed to the place where it is easy to fix.

## When to annotate

Annotate public surface. Do not annotate trivia.

- **Public functions and methods** get full annotations — every parameter, return type, and raised exception if the style guide uses them. This is the contract other modules rely on.
- **Class attributes** declared at class scope get annotations. The checker uses them to infer `__init__` behaviour, especially with `@dataclass`.
- **Module-level constants** of non-obvious type (`TIMEOUT: Final[float] = 2.5`) get annotations.
- **Short local variables** where the type is obvious from the right-hand side do not need annotations. `count = 0` is fine. `count: int = 0` is noise.
- **Obvious returns** (`def is_empty(self) -> bool: return not self._items`) still get the return annotation, because the *signature* is the contract even when the body is one line.

The heuristic: if a reader has to read the body to know the type, annotate. If they can read it off the first line, you are adding noise.

## mypy vs pyright

Both are mature. Pick one per project and set it to strict from the start — retroactive strictness is a migration, not a setting flip.

- **pyright** (and its editor-integrated twin, Pylance) is faster, catches more by default, and has richer inference. It is the right default for new projects.
- **mypy** is more widely deployed, has more third-party stubs, and is the reference for what "passes type-check" means in open-source Python. Choose it when the ecosystem around you already has.

Either way, turn on strict early. `strict = true` in `pyproject.toml` for mypy; `"typeCheckingMode": "strict"` for pyright. The flags that matter most:

| Flag (mypy) | Flag (pyright) | What it catches |
|---|---|---|
| `--disallow-untyped-defs` | `reportUntypedFunctionDecorator` | Unannotated function signatures |
| `--disallow-any-expr` | `reportAny` | `Any` leaking through an expression |
| `--warn-return-any` | `reportUnknownVariableType` | Function returns `Any` implicitly |
| `--disallow-any-generics` | `reportMissingTypeArgument` | `list` instead of `list[int]` |
| `--no-implicit-optional` | (default in strict) | `def f(x: int = None)` treated as `int | None` |

Gradual adoption is legitimate — `# type: ignore[error-code]` on specific lines, `[[tool.mypy.overrides]]` for modules still migrating — but the target is strict everywhere and the exceptions are tracked.

## Built-in generics (3.9+)

PEP 585 landed in Python 3.9 in October 2020. Use `list[int]`, `dict[str, int]`, `tuple[str, ...]`, `set[Path]`, `type[Exception]` directly from the builtins. Do not import `List`, `Dict`, `Tuple`, `Set`, `Type` from `typing`.

```python
# Yes
def group_by_status(items: list[Order]) -> dict[Status, list[Order]]: ...

# No (if target is 3.9+)
from typing import List, Dict
def group_by_status(items: List[Order]) -> Dict[Status, List[Order]]: ...
```

The old forms are deprecated. Ruff autofixes them (`UP006`). If your target is 3.8 — which in 2026 you probably should not be — add `from __future__ import annotations` and keep the PEP 585 syntax anyway; annotations become strings at parse time.

## `X | None` vs `Optional[X]`

PEP 604 union syntax landed in 3.10. Write `int | None`, not `Optional[int]`. Write `str | bytes`, not `Union[str, bytes]`.

```python
# Yes
def find(id: UserId) -> User | None: ...

# No (if target is 3.10+)
from typing import Optional
def find(id: UserId) -> Optional[User]: ...
```

`Optional[X]` means `X | None`, not "this argument has a default." `def f(x: Optional[int] = 0)` reads as "optional with default 0" but types as "int-or-None with default 0." The `None` is usually unintended. Write `x: int = 0` unless `None` is really legal. Ruff autofixes both (`UP007` for `Union`, `UP045` for `Optional`).

## `Any` vs `object` vs an honest union

`Any` is the nuclear option. A value typed `Any` bypasses all checks, and every expression that touches it becomes `Any`. A function returning `Any` unchecks every caller. `a.b.c.d.e()` compiles when `a` is `Any`, regardless of what is actually there.

- **`Any`** — the checker gives up. Acceptable only at a boundary, with a comment saying why, on its way to a real type. Almost never acceptable in a return annotation.
- **`object`** — the top type. Every value is an `object`. You cannot use it without narrowing (`isinstance`, `hasattr`, `match`). This is what you want when the value is genuinely of-unknown-shape and the checker should force you to narrow.
- **An honest union** — if the value is `int | str | None`, write that. Three possibilities with structure is not "any."

Python has no direct equivalent of TypeScript's `unknown`, but `object` fills the role at strict settings: `def parse(raw: object) -> User` forces the body to validate before using `raw`. Prefer it to `Any` whenever the caller should narrow.

## `cast` and `assert_type`

`typing.cast(T, value)` tells the checker "trust me, this is a `T`" with no runtime check. Use it sparingly — after a boundary parser that already validated, or when interoperating with a third-party function whose stubs are wrong.

```python
from typing import cast

raw: object = await response.json()
validated: dict[str, object] = cast(dict[str, object], raw)  # after we know it is a dict
```

`typing.assert_type(value, T)` is a *checked* assertion — at type-check time, the checker proves the value is `T` or errors. At runtime it is a no-op. Use it in tests and in tricky type-narrowing code to lock in what the checker currently infers.

```python
from typing import assert_type

user = get_user("alice")
assert_type(user, User | None)  # fails type-check if inference drifts
```

`typing.reveal_type(x)` prints the inferred type to the checker's output (not the runtime). Drop it in when narrowing is not doing what you expect, then delete.

## `TypedDict` vs `dataclass` vs `NamedTuple` vs `Protocol`

Four shapes for structured data, each with a distinct lifecycle niche. Detailed comparison lives in [data-modeling.md](data-modeling.md); the typing-level distinction:

| Tool | Runtime type | Structural or nominal | Use when |
|---|---|---|---|
| `TypedDict` | `dict` | Structural (shape-based) | The wire format is a dict — JSON, kwargs, settings |
| `@dataclass` | ordinary class | Nominal (name-based) | Internal record with methods, defaults, or mutation |
| `NamedTuple` | `tuple` subclass | Nominal, immutable | Small, tuple-like values — points, 2-tuples in APIs |
| `Protocol` | any class that fits | Structural (duck-typing made explicit) | You want to accept "anything with these methods" |

A `TypedDict` is a dict at runtime, so you can serialise it to JSON for free and existing code that takes `dict` still works. A `@dataclass` is a real class, so you get identity, equality, methods, and `slots=True` for memory.

A `Protocol` is the tool that makes Python's duck-typing checkable: `class Closeable(Protocol): def close(self) -> None: ...` lets a function accept "any object with a `close()` method" without requiring inheritance. Use protocols instead of abstract base classes in library APIs — they do not force your callers to inherit.

## `Self` (3.11+) and `reveal_type`

`typing.Self` is the type "whatever class is currently being defined, including subclasses." It replaces the old `TypeVar`-bound-to-the-class dance.

```python
from typing import Self

class Builder:
    def with_name(self, name: str) -> Self:
        self._name = name
        return self

class FancyBuilder(Builder):
    def with_colour(self, c: str) -> Self: ...

FancyBuilder().with_name("x").with_colour("red")  # checker keeps FancyBuilder
```

Without `Self`, `with_name` would return `Builder` and the chain would lose the subclass type. `Self` handles `__enter__`, `copy`, `from_row`, and every fluent API correctly in one line.

`reveal_type(x)` is your debugger for the type checker. When narrowing does not go where you expect — a `match` statement that should have exhausted the union, a guard that should have narrowed `x | None` to `x` — drop `reveal_type(x)` in, run the checker, read what it thinks, fix the branch.

## Common AI failure modes

**`dict-str-any-smell`.** Public function returns `dict[str, Any]` (or `Dict[str, Any]`) when the body returns a dict literal with known keys. The model knew the keys at generation time and refused to commit to a schema — this is the single most common type-annotation slop in AI-written Python. If the keys are `{"id": ..., "name": ..., "created_at": ...}`, the return type is a `TypedDict`, a dataclass, or a `NamedTuple`. Not `Any`. Catch with mypy `--disallow-any-expr` or pyright `reportAny`; the fix is to name the shape.

**`list-dict-capital`.** `from typing import List, Dict, Tuple` in a codebase targeting 3.9+. The #1 visual tell of LLM-written Python. PEP 585 has been available for five years; the capital-letter forms are deprecated. Ruff `UP006` autofixes. There is no cost to the fix and no defence for keeping it.

**`optional-on-3-10-plus`.** `Optional[X]` and `Union[A, B]` in 3.10+ code. Same category as `list-dict-capital` — the model defaulted to the pre-PEP-604 forms because its training data has more of them. Ruff `UP007` and `UP045` autofix.

**`any-leakage`.** The function has typed parameters but returns `Any` because something inside — usually `json.loads`, sometimes a third-party call — returns `Any`, and the body does not narrow it. The return type then becomes `Any`, and every caller inherits the leak. Catch with mypy `--warn-return-any` or pyright `reportAny`. Fix by narrowing at the boundary: parse the raw value through a schema (Pydantic, msgspec, attrs with `cattrs`) or validate with `isinstance` before returning.

**`typevar-ceremony`.** A module defines `T = TypeVar("T")`, uses it in one function signature, and gets nothing from it that `object` would not provide. `TypeVar` earns its keep when the *same* type appears in multiple positions in the signature — input and output, or two inputs — and the caller's choice at one position must match at the other. A `TypeVar` used once with no real generic variance is cargo-culted "look, I know types" noise. Delete it. Use `object` or the concrete type.

## Avoid

- `from typing import List, Dict, Tuple, Set, Type` in 3.9+ code.
  — PEP 585 deprecated these. Use the builtins directly; ruff `UP006` autofixes.
- `Optional[X]` and `Union[A, B]` in 3.10+ code.
  — PEP 604 gives `X | None` and `A | B`. Ruff `UP007`/`UP045` autofix.
- `Any` in a public return annotation.
  — It unchecks every caller virally. Use `object` plus a narrower, or name the shape.
- `dict[str, Any]` as a return type when the keys are known at generation time.
  — That is a `TypedDict` or a dataclass. The model knows the shape; make it say so.
- `TypeVar` used once with no generic variance.
  — It adds ceremony without adding a check. Delete or replace with `object`.
- `cast(T, x)` without a validator in the previous line.
  — A cast with no runtime basis is a lie the checker cannot see. Parse, then type.
- `# type: ignore` without an error code or a comment.
  — `# type: ignore[error-code]  # reason` is the disciplined form. The bare form never stops lying.
- Skipping annotations on public functions because "the code is obvious."
  — The contract is what callers rely on; the body changes. Annotate the signature.
- Declaring `def f(x: Optional[int] = 0)` when `None` is not actually legal.
  — Optional means `X | None`, not "has a default." Use `x: int = 0`.
- `if TYPE_CHECKING:` imports for modules you use at runtime.
  — It will raise `NameError`. The guard is for annotation-only imports.

→ For container choice (dataclass vs TypedDict vs Pydantic) see [data-modeling.md](data-modeling.md). For the decorators that break inference (`functools.wraps`, `overload`) see [decorators.md](decorators.md). For the universal any/unknown/cast posture this extension specialises, see [../../../sublime/references/data-modeling.md](../../../sublime/references/data-modeling.md) and the shared catalog entry in [../../../anti-patterns/stylistic-tells.md](../../../anti-patterns/stylistic-tells.md). The parent extension frame is [../SKILL.md](../SKILL.md); in-extension anti-patterns are catalogued in [../anti-patterns.md](../anti-patterns.md).
