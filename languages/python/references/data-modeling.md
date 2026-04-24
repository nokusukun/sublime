# Data modeling

Pick the right container for the data's lifecycle; a three-field dict read once is not a dataclass, and a mutable record passed across module boundaries is not a `NamedTuple`.

Python hands you five or six ways to model the same record, and the choice is a statement about how the value travels — does it cross a JSON boundary, get mutated, get constructed from untrusted bytes, get hashed or pattern-matched? Each container answers differently, and each costs a different amount at runtime. Get it right and the defensive scaffolding downstream disappears; get it wrong and you revalidate the same value in four layers.

## `dataclass` — the default internal record

`@dataclass` is the right answer for most internal records. It generates `__init__`, `__repr__`, and `__eq__` from annotated class attributes, and gives you three knobs that change its character.

```python
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True, kw_only=True)
class LineItem:
    sku: str
    quantity: int
    unit_price: Decimal
    metadata: dict[str, str] = field(default_factory=dict)
```

- **`frozen=True`** — instances become hashable and immutable. Assigning to an attribute raises `FrozenInstanceError`. Use this whenever the record is a value, not an entity. It is the default you want 80% of the time.
- **`slots=True`** (3.10+) — the class gets `__slots__`, cutting per-instance memory roughly in half and forbidding attribute typos at runtime. Cheap win; turn it on unless you need dynamic attributes.
- **`kw_only=True`** (3.10+) — callers must pass arguments by name. Eliminates positional-argument transpositions on long records. Worth it for any record with more than two or three fields.

A mutable default (`metadata={}`) at class scope is a trap — every instance shares the same dict. Use `field(default_factory=dict)`. Dataclasses raise `ValueError` for `list`/`dict`/`set` literals, but more exotic mutables slip through.

## `TypedDict` — when the wire format is a dict

`TypedDict` describes the shape of a `dict` without changing its runtime type. Use it when the value starts or ends its life as JSON, `**kwargs`, or a settings mapping, and converting to a class would be friction.

```python
from typing import TypedDict, NotRequired

class UserPayload(TypedDict):
    id: str
    email: str
    display_name: NotRequired[str]   # may be absent
```

At runtime, `UserPayload` instances are plain dicts. The checker enforces the shape; `json.dumps(user)` works; a function taking `dict[str, object]` still accepts it. Use it for FastAPI payloads you do not want to instantiate as a class, `**kwargs` forwarding where the callee expects specific keys, or config files loaded from YAML/TOML. `total=False` (or `NotRequired[X]` per field) marks optional keys. Do not use `TypedDict` when you need methods, validation, or mutation safety — that is a dataclass's job.

## `NamedTuple` — small, tuple-like, truly immutable

`typing.NamedTuple` is a tuple subclass with named fields. The important word is *tuple*: instances are iterable, indexable, unpackable, and immutable.

```python
from typing import NamedTuple

class Point(NamedTuple):
    x: float
    y: float

origin = Point(0.0, 0.0)
x, y = origin        # unpacks like a tuple
origin[0]            # indexes like a tuple
origin == (0.0, 0.0) # compares equal to a tuple
```

Use `NamedTuple` when the tuple-ness is the feature — interop with APIs that expect tuples, lightweight return values, pattern-matching on positional structure. Do not use it for a *record*; the tuple base class leaks through (`isinstance(p, tuple) is True`), and callers start indexing by position. Hynek: "collections.namedtuples are tuples with names, not classes." If you find yourself calling `._replace()` three times, you wanted a frozen dataclass.

## `Pydantic` — only at validation boundaries

`pydantic.BaseModel` is the right tool *only* when runtime validation earns its keep:

- Parsing untrusted input — HTTP bodies, CLI arguments, YAML/TOML configs written by humans.
- Coercing loosely-typed values — `"42"` to `int`, `"2026-04-17"` to `date`.
- Publishing a JSON schema — FastAPI endpoints, OpenAPI generation.

Inside the trusted core, Pydantic is overkill. A record read once from a validated source and passed between two functions you wrote does not need a `BaseModel`. Use `@dataclass(frozen=True, slots=True)` — faster, lighter, and no validation engine in your call graph.

```python
# At the HTTP boundary — Pydantic earns its keep.
class CreateOrderRequest(BaseModel):
    customer_id: CustomerId
    line_items: list[LineItemInput]
    shipping_address: Address
    model_config = ConfigDict(extra="forbid")

# Inside the service — dataclass is correct.
@dataclass(frozen=True, slots=True, kw_only=True)
class Order:
    id: OrderId
    customer_id: CustomerId
    line_items: tuple[LineItem, ...]
    total: Money
```

Parse once at the edge, convert to the internal dataclass, and trust the type downstream. Do not revalidate on every method call.

## Plain `dict` — when the shape really is amorphous

Plain `dict` is the right answer when the data genuinely has no fixed shape: arbitrary metadata, a one-shot script reading CSV into memory, a cache keyed by opaque strings. If you can write down the keys, you are past that point — use a `TypedDict` or a dataclass. "I do not want to name the shape" is not a reason; it is the slop.

## `attrs` — when it still adds value

`attrs` predates `dataclass` and still ships features the stdlib lacks: validators, converters, richer `__init__` hooks, better `slots` ergonomics. Prefer stdlib `@dataclass` by default — one less dependency — and reach for `attrs.define` when you need its extras (especially converters for normalising inputs at construction time).

## `Enum` vs `Literal` vs `Final`

Three ways to constrain a value to a small set. They are not interchangeable.

```python
from enum import Enum
from typing import Final, Literal

class Status(Enum):
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"

StatusLiteral = Literal["pending", "paid", "refunded"]

MAX_RETRIES: Final[int] = 3
```

- **`Enum`** — when the value is a real domain concept with identity. Iterating over `Status` gives you the members; `Status.PENDING.value == "pending"`. Use when the value is serialised (DB, JSON) *and* referred to in code.
- **`Literal[...]`** — when the value is a constrained string/int/bool at the type level but has no behaviour. Cheaper than an `Enum`, interoperates with JSON for free (the value *is* the string), and pattern-matches naturally.
- **`Final`** — not a set, a constant. `Final[int]` means "this name binds once and never rebinds." Use for module-level constants the checker should lock in.

`str + Enum` (`class Status(str, Enum)`) bridges the two — instances *are* strings, so JSON serialisation works, but you still get iteration and identity. Useful when you need both.

## `match`/`case` for algebraic types

Structural pattern matching (3.10+) is how you consume a discriminated union cleanly. A tagged union of dataclasses plus `match` replaces most `isinstance` ladders.

```python
@dataclass(frozen=True)
class Loading: pass

@dataclass(frozen=True)
class Loaded:
    user: User

@dataclass(frozen=True)
class Failed:
    reason: str

State = Loading | Loaded | Failed

def render(state: State) -> str:
    match state:
        case Loading():
            return "..."
        case Loaded(user=user):
            return f"Hi {user.name}"
        case Failed(reason=r):
            return f"error: {r}"
```

The checker knows the narrowing. If you add a fourth variant and forget to handle it, a strict checker with exhaustiveness catches it. Prefer this to `isinstance` cascades; prefer it to a `status: str` with if/elif.

## Comparison

| Container | Mutability | Runtime cost | Validates input | Use when |
|---|---|---|---|---|
| `@dataclass` | Mutable (default) or `frozen=True` | Lightweight — plain class | No | Default for internal records |
| `@dataclass(slots=True, frozen=True, kw_only=True)` | Frozen, hashable | Lighter than default (slots) | No | Value objects inside a service |
| `TypedDict` | Mutable (it is a dict) | Zero — literally a dict | No | Wire format / JSON / kwargs |
| `NamedTuple` | Immutable | Tuple subclass — tiny | No | Tuple-like values; positional interop |
| `pydantic.BaseModel` | Mutable (default); `model_config = ConfigDict(frozen=True)` | Heavy — validation engine | Yes, at construction | Boundary parsing / FastAPI / config loading |
| `attrs.define` | Mutable or `frozen=True` | Comparable to dataclass | Optional via validators | Need converters or richer `__init__` hooks |
| Plain `dict` | Mutable | Zero | No | Truly amorphous data; one-shot scripts |

## Common AI failure modes

**`pydantic-for-a-dict`.** A `BaseModel` subclass with three plain-scalar fields, no validators, never constructed from untrusted input — used as an internal record between two functions the same author wrote. This is pulling the full Pydantic validation engine to hold three strings. Hynek's question is the review prompt: *"Is it really necessary to re-validate all your objects while reading them from a trusted database?"* Replace with `@dataclass(frozen=True, slots=True)` or `attrs.frozen`. Keep Pydantic for boundaries where the value arrives as `object` and leaves as a validated type.

**`pydantic-v1-api-drift`.** Calls to `model.dict()`, `model.json()`, `Model.parse_obj(...)`, `Model.parse_raw(...)`, or `Model.schema()` on Pydantic v2. All deprecated since v2.0 and scheduled for removal in v3.0. The v2 spellings are `model_dump()`, `model_dump_json()`, `Model.model_validate(...)`, `Model.model_validate_json(...)`, `Model.model_json_schema()`. This is the #1 LLM-era Python regression: models trained before mid-2024 emit v1 APIs against v2 runtimes. Pydantic emits `PydanticDeprecatedSince20` warnings; a static AST check catches the rest.

**`validator-decorator-drift`.** `from pydantic import validator` with `@validator("x", always=True, pre=True)` on a v2 `BaseModel`. Pydantic v2 split the decorator into `@field_validator` (with `mode="before"` replacing `pre=True`) and `@model_validator` for cross-field checks. The `always=` flag is gone. Catch at import time (`pydantic.validator` is deprecated) and rewrite to the v2 API.

**`class-config-in-v2`.** Nested `class Config:` block with v1 keys — `orm_mode = True`, `allow_population_by_field_name = True`, `anystr_lower = True` — attached to a v2 `BaseModel`. In v2 the config is a class-level `model_config: ConfigDict = ConfigDict(from_attributes=True, populate_by_name=True)`. The old keys are silently ignored on v2; the code "works" while the intended behaviour is absent.

**`mutable-default-no-factory`.** `tags: list[str] = []` or `metadata: dict[str, str] = {}` as a dataclass field default. Dataclasses raise `ValueError` at class definition for bare `list`/`dict`/`set`, but more exotic mutables (custom classes, `collections.OrderedDict`, third-party containers) slip through and become shared state across instances. Use `field(default_factory=list)`. Ruff `RUF008`, `RUF009`, and `B006` catch the common cases.

**`UserData` / `UserInfo` / `UserDetails` divergence.** Three subtly different dataclasses for the same concept, each born in a different prompt, each with a slightly different field set. The divergence guarantees you eventually pass a `UserInfo` where a `UserDetails` was expected and the checker waves it through because the shapes overlap by 90%. Search for the existing type before inventing a new one; if `User` exists, extend it or alias it. See the shared catalog entry in [../../../anti-patterns/naming-slop.md](../../../anti-patterns/naming-slop.md).

## Avoid

- `BaseModel` for internal records that never cross a validation boundary.
  — Pydantic's validation engine is not free; inside trusted code a dataclass is faster and lighter.
- `model.dict()`, `Model.parse_obj(...)`, or nested `class Config:` on Pydantic v2.
  — These are v1 APIs deprecated since v2.0 and removed in v3. Use `model_dump()`, `model_validate()`, `ConfigDict`.
- `@validator("x", always=True, pre=True)` on a v2 model.
  — v2 uses `@field_validator(..., mode="before")` and `@model_validator`. The `always=` flag is gone.
- `tags: list[str] = []` on a dataclass field.
  — The mutable is shared across instances. Use `field(default_factory=list)`.
- `NamedTuple` for a record you then `._replace()` chain.
  — `NamedTuple` is a tuple with names, not a class. Use `@dataclass(frozen=True)`.
- `status: str` where only four values are legal.
  — Stringly-typed state. Use `Literal["pending", "paid", "refunded", "cancelled"]` or an `Enum`.
- Three near-identical types for one concept (`UserData`, `UserInfo`, `UserDetails`).
  — The 90% overlap defeats the checker. Name the concept once and reuse.
- `Enum` where `Literal[...]` would be lighter.
  — If the value has no behaviour and serialises to its literal, a literal union is cheaper.
- `dict[str, object]` as a public return type.
  — Name the keys in a `TypedDict` or a dataclass. The shape is known; commit to it.
- Parsing the same JSON payload into a Pydantic model at three layers.
  — Validate once at the boundary, convert to an internal dataclass, trust downstream.

→ For the typing-level distinction between `TypedDict`, dataclass, `NamedTuple`, and `Protocol`, see [typing.md](typing.md). For the universal "parse at the boundary, trust the core" posture this extension inherits, see [../../../sublime/references/data-modeling.md](../../../sublime/references/data-modeling.md). The shared divergence catalog entry is in [../../../anti-patterns/naming-slop.md](../../../anti-patterns/naming-slop.md); the gratuitous-abstraction entry covering `pydantic-for-a-dict` is in [../../../anti-patterns/gratuitous-abstraction.md](../../../anti-patterns/gratuitous-abstraction.md). The parent extension frame is [../SKILL.md](../SKILL.md); in-extension anti-patterns live in [../anti-patterns.md](../anti-patterns.md).
