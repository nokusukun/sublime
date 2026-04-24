# Python anti-patterns

Python's LLM slop has three gravitational centers: **pre-PEP-585/604 typing noise** (`List[X]`, `Dict[str, Any]`, `Optional[int]` on 3.9+/3.10+), **async-everywhere cargo-culting** (`async def` wrappers that then call blocking `requests` or `time.sleep`, stalling the event loops the async was supposed to make fast), and **Pydantic v1→v2 API drift** — the biggest regression from the 2022 training cut-off. Beneath these sit the classics: bare `except:`, `raise` without `from e`, manager-classes, decorator stacks larger than the functions they decorate.

---

### `dict-str-any-smell`

**Tags:** `AI-slop` · `Review` · `Lang:Python`

**Pattern.** A public function annotated `dict[str, Any]` when the body returns a dict literal with statically known keys.

**Forbidden example.**
```python
def get_user(user_id: str) -> dict[str, Any]:
    row = db.fetch_one("SELECT ...", user_id)
    return {"id": row[0], "email": row[1], "is_admin": row[2]}
```

**Why it hurts.** The #1 Python type-annotation slop. The model knows the keys at generation time but refuses to commit; `Any` propagates. Mypy `--disallow-any-expr`, pyright `reportAny`.

**Rewrite.**
```python
class User(TypedDict):
    id: str
    email: str
    is_admin: bool

def get_user(user_id: str) -> User: ...
```

**See in `/sublime`:** [SKILL.md#typing-and-mypypyright](SKILL.md#typing-and-mypypyright).

---

### `list-dict-capital`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** `typing.List[int]`, `typing.Dict[str, int]`, `typing.Tuple[...]` on 3.9+ where PEP 585 applies.

**Forbidden example.** `def group(items: List[str]) -> Dict[str, Tuple[int, int]]: ...`.

**Why it hurts.** The #1 visual tell of LLM-written Python. PEP 585 landed in 3.9 (2020); models still emit the pre-585 form. Ruff `UP006` auto-fixes.

**Rewrite.** `def group(items: list[str]) -> dict[str, tuple[int, int]]: ...`.

**See in `/sublime`:** [references/typing.md](references/typing.md).

---

### `optional-on-3-10-plus`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** `typing.Optional[X]` or `typing.Union[A, B]` on 3.10+.

**Forbidden example.** `def find(name: str) -> Optional[User]: ...`, `def coerce(v: Union[int, str]) -> int: ...`.

**Why it hurts.** Co-occurs with `list-dict-capital`. Armin Ronacher: LLMs love "stable ecosystems with little churn" and stick to old typing. Ruff `UP007`, `UP045` auto-fix.

**Rewrite.** `def find(name: str) -> User | None: ...`, `def coerce(v: int | str) -> int: ...`.

**See in `/sublime`:** [references/typing.md](references/typing.md).

---

### `pydantic-v1-api-drift`

**Tags:** `AI-slop` · `Review` · `Lang:Python`

**Pattern.** Pydantic v1 API calls (`model.dict()`, `.json()`, `parse_obj`, `parse_raw`, nested `class Config`, `@validator`) on a project running Pydantic v2.

**Forbidden example.**
```python
class User(BaseModel):
    email: str
    class Config: orm_mode = True
    @validator("email", pre=True)
    def lower(cls, v): return v.lower()

payload = user.dict()
```

**Why it hurts.** The biggest LLM-era Python regression. Simon Willison: *"I've already had two instances of LLM plugins with dependencies that were incompatible with Pydantic 2."* Deprecated in v2.0, removed in v3.0.

**Rewrite.**
```python
class User(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    email: str
    @field_validator("email", mode="before")
    @classmethod
    def lower(cls, v: str) -> str: return v.lower()

payload = user.model_dump()
```

**See in `/sublime`:** [references/data-modeling.md](references/data-modeling.md).

---

### `range-len-loop`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** `for i in range(len(seq)):` followed by `seq[i]` — the C/Java loop shape transliterated.

**Forbidden example.** `for i in range(len(items)): print(i, items[i])`.

**Why it hurts.** The #1 sign a Python author came from Java. Ruff `SIM113`, pylint `C0200`.

**Rewrite.** `for i, item in enumerate(items): print(i, item)`.

**See in `/sublime`:** [references/iteration.md](references/iteration.md).

---

### `diaper-anti-pattern`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** `except Exception: pass` — or the `logger.error(...)` variant that still swallows.

**Forbidden example.**
```python
try: result = risky_operation()
except Exception: pass
```

**Why it hurts.** Ian Bicking: *"all the information about how [the code] failed is lost."* The signature LLM defensive tic. Ruff `BLE001`.

**Rewrite.**
```python
try: result = risky_operation()
except NetworkTimeout as exc:
    logger.warning("retrying", exc_info=exc)
    result = fallback()
```

**See in `/sublime`:** [references/exceptions.md](references/exceptions.md).

---

### `bare-except`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** `try: ... except: ...` with no exception type, catching `BaseException`.

**Forbidden example.**
```python
try: data = load()
except: data = {}
```

**Why it hurts.** PEP 760: *"can make it hard to interrupt the program (e.g., with Ctrl-C) and can disguise other problems."* Ruff `E722`.

**Rewrite.**
```python
try: data = load()
except (OSError, ValueError) as exc:
    logger.warning("load failed", exc_info=exc)
    data = {}
```

**See in `/sublime`:** [references/exceptions.md](references/exceptions.md).

---

### `lost-traceback-raise`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** `except X as e: raise Y("bad")` without `from e`, or `raise e` by name — both truncate the traceback.

**Forbidden example.**
```python
try: user = fetch(id)
except KeyError: raise ValueError("user not found")
```

**Why it hurts.** The caller loses the original traceback — no indication the cause was a missing row. Ruff `B904`.

**Rewrite.**
```python
try: user = fetch(id)
except KeyError as exc: raise ValueError("user not found") from exc
```

**See in `/sublime`:** [references/exceptions.md](references/exceptions.md).

---

### `time-sleep-in-async`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** `time.sleep(n)` inside `async def` — blocks the entire event loop.

**Forbidden example.**
```python
async def retry(fn):
    for attempt in range(3):
        try: return await fn()
        except TransientError: time.sleep(2 ** attempt)
```

**Why it hurts.** Every coroutine on the loop stalls. Classic mistake in retry loops copy-pasted from sync examples. Ruff `ASYNC251`.

**Rewrite.**
```python
async def retry(fn):
    for attempt in range(3):
        try: return await fn()
        except TransientError: await asyncio.sleep(2 ** attempt)
```

**See in `/sublime`:** [references/async.md](references/async.md).

---

### `blocking-http-in-async`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** `requests.get/post`, synchronous `httpx.Client`, `urllib.request.urlopen` inside `async def`.

**Forbidden example.**
```python
async def fetch_user(user_id: str) -> dict:
    return requests.get(f"/users/{user_id}").json()
```

**Why it hurts.** LLMs default to `requests` from muscle memory. Inside `async def`, every call stalls the loop. Persists in frontier models. Ruff `ASYNC210/211/212`.

**Rewrite.**
```python
async def fetch_user(user_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        return (await client.get(f"/users/{user_id}")).json()
```

**See in `/sublime`:** [references/async.md](references/async.md).

---

### `async-everywhere-cargo-cult`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** Every function declared `async def` regardless of body — `async` wrappers with no `await`, `async for`, or `async with` inside.

**Forbidden example.**
```python
async def slugify(s: str) -> str:
    return s.lower().replace(" ", "-")
```

**Why it hurts.** Endemic in FastAPI code — training corpora are saturated with "async def endpoint" examples. Coroutine overhead for no concurrency gain. Ruff `RUF029`.

**Rewrite.**
```python
def slugify(s: str) -> str:
    return s.lower().replace(" ", "-")
```

**See in `/sublime`:** [references/async.md](references/async.md).

---

### `asyncio-run-inside-loop`

**Tags:** `AI-slop` · `Review` · `Lang:Python`

**Pattern.** `asyncio.run(coro)` called from inside a coroutine or a running event loop.

**Forbidden example.**
```python
async def handle_request(req):
    return asyncio.run(fetch_data(req.id))
```

**Why it hurts.** CPython raises `RuntimeError: asyncio.run() cannot be called from a running event loop`. Nested-loop harnesses vary between deadlock and silent double-loop. It's an entry point, not a function call.

**Rewrite.**
```python
async def handle_request(req):
    return await fetch_data(req.id)
```

**See in `/sublime`:** [references/async.md](references/async.md).

---

### `static-method-only-class`

**Tags:** `AI-slop` · `Review` · `Lang:Python`

**Pattern.** A class whose every method is `@staticmethod` — a module masquerading as a class.

**Forbidden example.**
```python
class StringUtils:
    @staticmethod
    def slugify(s): return s.lower().replace(" ", "-")
    @staticmethod
    def titlecase(s): return s.title()
```

**Why it hurts.** Java-in-Python. No state, no inheritance, no protocol. Jack Diederich's "Stop Writing Classes" is the canonical critique. Pylint `R0903`.

**Rewrite.** A module with plain functions — `def slugify(s): ...`, `def titlecase(s): ...`.

**See in `/sublime`:** [../../sublime/SKILL.md#naming](../../sublime/SKILL.md#naming).

---

### `manager-class`

**Tags:** `AI-slop` · `Review` · `Lang:Python`

**Pattern.** `FooManager`, `FooService`, `FooHandler` — a class whose public API is one method, where a function would do.

**Forbidden example.**
```python
class EmailNotificationManager:
    def __init__(self, config): self.config = config
    def send(self, to, subject, body): ...

EmailNotificationManager(config).send("a@b.com", "hi", "hello")
```

**Why it hurts.** Jack Diederich's ["Stop Writing Classes"](https://pyvideo.org/video/880/stop-writing-classes): a class with `__init__` and one public method is a function with extra steps. Common in Claude and Cursor agentic output.

**Rewrite.**
```python
def send_email(config, to, subject, body): ...
send_email(config, "a@b.com", "hi", "hello")
```

**See in `/sublime`:** [../../sublime/SKILL.md#naming](../../sublime/SKILL.md#naming).

---

### `os-path-blindness`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** `os.path.join`, `os.path.exists`, `os.path.dirname` in a codebase that could use `pathlib.Path` (3.4+).

**Forbidden example.**
```python
p = os.path.join(os.path.dirname(__file__), "..", "config", "prod.yaml")
if os.path.exists(p):
    with open(p) as f: data = f.read()
```

**Why it hurts.** Training data predates pathlib dominance. `Path` composes cleanly and carries type information. Ruff `PTH100`–`PTH208` (flake8-use-pathlib) flag nearly every case.

**Rewrite.**
```python
p = Path(__file__).parent.parent / "config" / "prod.yaml"
if p.exists(): data = p.read_text()
```

**See in `/sublime`:** [references/imports-and-packaging.md](references/imports-and-packaging.md).

---

### `observability-stack`

**Tags:** `AI-slop` · `Review` · `Lang:Python`

**Pattern.** Three or more decorators (`@retry @cache @timed @traced @log`) on a five-line function.

**Forbidden example.**
```python
@retry(max_attempts=3)
@cache(ttl=60)
@timed
@traced
@log_calls
def add(a: int, b: int) -> int: return a + b
```

**Why it hurts.** Shape-over-substance. Spikes when the prompt includes "production-grade."

**Rewrite.** `def add(a: int, b: int) -> int: return a + b`.

**See in `/sublime`:** [references/decorators.md](references/decorators.md).

---

### `init-reexport-bloat`

**Tags:** `AI-slop` · `Review` · `Lang:Python`

**Pattern.** `__init__.py` that `from .a import *; from .b import *` to "flatten the API."

**Forbidden example.**
```python
# mypackage/__init__.py
from .models import *
from .services import *
from .utils import *
```

**Why it hurts.** Triggers circular imports, slows startup, surfaces every internal name as public. Ruff `F401`/`F403`.

**Rewrite.**
```python
# mypackage/__init__.py
from .models import User, Order
from .services import create_user, place_order
__all__ = ["User", "Order", "create_user", "place_order"]
```

**See in `/sublime`:** [references/imports-and-packaging.md](references/imports-and-packaging.md).

---

### `mutable-default-no-factory`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** A mutable default on a dataclass, `attrs.define`, or Pydantic field — `tags: list[str] = []`.

**Forbidden example.** `@dataclass class Post: title: str; tags: list[str] = []`.

**Why it hurts.** `dataclass` raises `ValueError: mutable default` for list/dict/set, but subtler mutables slip through and cause shared-state bugs. Ruff `RUF008`, `RUF009`, `B006`.

**Rewrite.** `tags: list[str] = field(default_factory=list)`.

**See in `/sublime`:** [references/data-modeling.md](references/data-modeling.md).

---

### `unittest-in-pytest-project`

**Tags:** `AI-slop` · `Lint` · `Lang:Python`

**Pattern.** `class TestFoo(unittest.TestCase)` with `self.assertEqual` in a repo whose configured runner is pytest.

**Forbidden example.**
```python
class TestSlugify(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(slugify("Hello World"), "hello-world")
```

**Why it hurts.** `TestCase` disables `pytest.fixture` and `parametrize` for its methods, and loses pytest's assertion introspection. Ruff `PT009`, `PT027`.

**Rewrite.**
```python
@pytest.mark.parametrize("given,expected", [("Hello World", "hello-world"), ("", "")])
def test_slugify(given, expected):
    assert slugify(given) == expected
```

**See in `/sublime`:** [../../sublime/SKILL.md#tests](../../sublime/SKILL.md#tests).

---

### `mock-patch-wrong-path`

**Tags:** `AI-slop` · `Review` · `Lang:Python`

**Pattern.** `@patch("package.module.helper")` where the system under test did `from package.module import helper` — patches the definition, not the consuming module's binding.

**Forbidden example.**
```python
# sut.py
from myapp.utils import fetch_user
def greet(user_id): return f"Hello {fetch_user(user_id).name}"

# test_sut.py
@patch("myapp.utils.fetch_user")  # WRONG — sut.fetch_user is a separate binding
def test_greet(mock_fetch): ...
```

**Why it hurts.** `from X import Y` creates a new binding in the consuming module. Patching `X.Y` leaves `sut.Y` pointing at the original. See [cpython#117860](https://github.com/python/cpython/issues/117860). Responsible for a disproportionate share of "passes locally, fails in CI" LLM tests.

**Rewrite.**
```python
@patch("myapp.sut.fetch_user")  # RIGHT — patches the consuming module's binding
def test_greet(mock_fetch): ...
```

**See in `/sublime`:** [../../sublime/SKILL.md#tests](../../sublime/SKILL.md#tests).

---

**Cross-reference targets:** [`../../sublime/SKILL.md`](../../sublime/SKILL.md) for the core skill and universal BANs. [`../../sublime/references/errors.md`](../../sublime/references/errors.md) for core exception discipline. [`../../anti-patterns/`](../../anti-patterns/) for universal catalog entries. In-extension: [`SKILL.md`](SKILL.md) and the seven `references/` files.
