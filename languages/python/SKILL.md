---
name: python
description: "Python-specific extension of the Sublime code-craft skill. Adds Python-scoped positions on typing discipline, data modeling (dataclass/TypedDict/NamedTuple/Pydantic), EAFP vs LBYL exception handling, async correctness, decorator restraint, packaging and imports, and idiomatic iteration. Loads with or without the Sublime core. Use when writing, reviewing, or refactoring Python — including FastAPI, Flask, Django, data-science notebooks, and CLI tools."
license: MIT. Extension of the Sublime skill. See NOTICE.md for attribution.
user-invocable: true
---

# Sublime — Python

Python rewards code that reads like prose and punishes code that imitates another language. Most slop is Java-in-Python: classes for functions, boilerplate for data, exception ceremony for control flow, and typing imports three years behind the interpreter.

---

## Context Gathering Protocol (Python)

Python is a moving target. `typing.Optional[int]` is correct at one version and obsolete at the next. You MUST resolve the runtime and tooling before you write code.

**Required context — read from the project, then confirm:**

- **Python version.** Check `pyproject.toml`, `.python-version`, or `tox.ini`. 3.9 unlocks PEP 585. 3.10 unlocks `match`/`case` and `X | None`. 3.11 unlocks `Self`, `TaskGroup`, `asyncio.timeout`. 3.12 unlocks PEP 695 generics.
- **Package manager.** `uv`, `poetry`, `hatch`, `pdm`, or bare `pip`. Different lockfiles, different install commands.
- **Type checker.** `mypy`, `pyright`, or neither. Check `[tool.mypy]` or `pyrightconfig.json` for strictness.
- **Framework and runtime.** FastAPI, Flask, Django, `click`/`typer` CLI, library, notebook. Each has incompatible idioms for routing, data modeling, and async.
- **Pydantic version.** v1 and v2 are not API-compatible (`.dict()` vs `.model_dump()`, `@validator` vs `@field_validator`, `class Config` vs `model_config`). Check the lockfile before writing a single model.
- **Test runner.** `pytest` or `unittest`. They do not compose.
- **Async or sync codebase.** Function color propagates. Mixed-color modules are the worst of both worlds.

**Gathering order:**
1. If loaded instructions contain a **Code Context** section, proceed.
2. Otherwise read `.sublime.md` at the project root.
3. If neither exists and the work is non-trivial, run `sublime teach` first. For one-liners, infer and state assumptions up top.

**CRITICAL:** Do not swap Pydantic versions, flip `async def` to `def`, or tighten mypy strictness mid-PR without asking.

---

## Python Direction

Before writing non-trivial Python, commit to a posture:

- **Target version.** The oldest interpreter the code must run on sets the syntax ceiling. 3.9 means `list[int]` but no `match`; 3.11 means `Self` and `TaskGroup`.
- **Typing strictness.** Gradual (public signatures typed, locals inferred), strict (`--disallow-untyped-defs`, `--warn-return-any`), or off. Default: gradual on services, strict on libraries, off on notebook cells.
- **Async posture.** Sync or async. Pick one per module. Mixed-color is the worst of both worlds and the posture most LLMs default to.
- **Validation posture.** Parse untrusted input with Pydantic or `attrs` at the boundary, once. Do not re-validate the same record at every method call.
- **The one thing.** What should a reader notice first — tight types, a three-line happy path, a parsed boundary with a trusting interior?

Match the intensity of craft to the posture. A throwaway script does not need `Protocol` hierarchies. A public PyPI package cannot afford `dict[str, Any]` at its edges.

---

## Craft Guidelines

### Typing and mypy/pyright

→ *Consult [references/typing.md](references/typing.md) for the `Any`/`object`/`Unknown` distinction and migration paths from pre-PEP-585 typing.*

Type hints are documentation the computer can check. Every `Any` is a hole in the checker; every `typing.List` on a 3.9+ codebase is a tell.

<sublime_python_typing_hints_principles>
**Always apply these — no reference needed:**

- On 3.9+, write `list[int]`, `dict[str, int]`, `tuple[str, ...]`. Do not import `List`, `Dict`, `Tuple` from `typing`.
- On 3.10+, write `X | None` and `str | int`. Do not import `Optional` or `Union`.
- Annotate public functions, class attributes, module-level callables. Skip obvious locals.
- `Any` is forbidden in public signatures. Use `object` when you mean "any value, I'll narrow."
- Return types on public functions are required. Without them, mypy and pyright infer `Any`, which propagates.
</sublime_python_typing_hints_principles>

<sublime_python_typing_hints_rules>
**DO** parse untrusted input at the boundary so the inside of the module sees concrete types.
**DO** use `TypedDict` for wire shapes and `dataclass`/`attrs` for records you construct.
**DO** reach for `Self` (3.11+) on fluent builders and alternate constructors.
**DO** leave a one-line comment when you `cast` — "parsed upstream by X" — so the next reader knows the lie was deliberate.

**DO NOT** annotate a return as `dict[str, Any]` when you know the keys at write time.
  — You're telling the checker to stop working for you. Model the shape.
**DO NOT** sprinkle `# type: ignore` to silence errors. Those are the errors that matter.
**DO NOT** define a one-use `TypeVar` to make a signature "look generic." Inline the concrete type.
</sublime_python_typing_hints_rules>

---

### Data modeling (dataclass / TypedDict / NamedTuple / Pydantic)

→ *Consult [references/data-modeling.md](references/data-modeling.md) for the container-by-container comparison and the rules for when Pydantic earns its runtime cost.*

Pick the right container for the data's lifecycle. Reaching for Pydantic by reflex is the Python analog of wrapping every string in a class.

<sublime_python_data_modeling_principles>
**Always apply these — no reference needed:**

- `dataclass(slots=True, frozen=True)` is the default for internal records. Saves memory; prevents the "who mutated my record" bug.
- `TypedDict` for JSON/wire shapes you don't own.
- `NamedTuple` when tuple unpacking is the point and immutability is intrinsic.
- Pydantic v2 at untrusted boundaries: HTTP bodies, environment config, file loaders. Not at every internal method call.
- Stringly-typed state is forbidden. `status: str` becomes `Literal["pending", "done", "error"]` or an `Enum`.
</sublime_python_data_modeling_principles>

<sublime_python_data_modeling_rules>
**DO** use `field(default_factory=list)` for mutable defaults on dataclasses.
**DO** use `match`/`case` on tagged-union dataclasses (3.10+).
**DO** let dataclasses generate `__repr__`, `__eq__`, `__hash__`. Do not hand-roll them.
**DO** model illegal states as unrepresentable. `Ok | Err` beats `{data, error, status}` with silent invariants.

**DO NOT** use `BaseModel` for a three-field internal record read once and discarded.
  — Validation cost on every construction for no benefit. Use a `dataclass` or `NamedTuple`.
**DO NOT** call `.dict()`, `.json()`, `parse_obj`, `parse_raw`, or define `class Config` on Pydantic v2. The v2 names are `model_dump`, `model_dump_json`, `model_validate`, `model_validate_json`, `model_config: ConfigDict`.
**DO NOT** define `User`, `UserInfo`, `UserDetails` for the same concept. One model with optional fields, or a discriminated union.
**DO NOT** mutate a `NamedTuple` through chained `._replace()`. If it mutates, it's a dataclass.
</sublime_python_data_modeling_rules>

---

### Exceptions and EAFP

→ *Consult [references/exceptions.md](references/exceptions.md) for the EAFP-vs-LBYL decision tree, exception chaining, and `contextlib` patterns.*

EAFP — easier to ask forgiveness than permission — is the Pythonic default. Swallowing `Exception` to "be safe" is not defensive programming; it's the single most common way production Python rots.

<sublime_python_exceptions_principles>
**Always apply these — no reference needed:**

- Catch the narrowest exception the code can actually raise. `except KeyError` beats `except LookupError` beats `except Exception`.
- `raise ... from e` when you wrap one exception in another. Breaking the cause chain destroys the traceback.
- `try/except/else/finally` has four clauses for a reason. Put the happy-path continuation in `else`, not inside `try`.
- `contextlib.suppress(KeyError)` over an empty except block.
- `assert` is for invariants, not runtime validation. `python -O` strips it.
</sublime_python_exceptions_principles>

<sublime_python_exceptions_rules>
**DO** use `dict.get(key, default)` instead of `try: d[key] except KeyError`. The dict method is EAFP already.
**DO** define a custom exception hierarchy at library boundaries so callers catch `MyLibError` once. Do not scaffold a class per internal function.
**DO** log-or-raise, never both. Double-reporting fills logs with duplicate tracebacks.
**DO** use `logger.exception(...)` inside the handler — it captures the traceback.

**DO NOT** write `except:` with no type. It swallows `KeyboardInterrupt` and `SystemExit`.
**DO NOT** write `except Exception: pass`. The error is there for a reason.
**DO NOT** `raise e` or `raise RuntimeError("bad")` inside an `except` without `from e`. The original traceback is the debugging information.
**DO NOT** wrap every call site in `try/except` "just in case." Paranoia hides the real failures.
</sublime_python_exceptions_rules>

---

### Async patterns

→ *Consult [references/async.md](references/async.md) for the asyncio/trio/anyio landscape, `TaskGroup` vs `gather`, and sync-async bridging.*

Async is viral. `async def` on a body with no `await` is a sync function paying coroutine overhead; `time.sleep` in a coroutine blocks the loop; `requests.get` in an `async def` stalls a FastAPI process. These are the modal LLM async mistakes.

<sublime_python_async_principles>
**Always apply these — no reference needed:**

- `async def` is for functions that actually await. No `await`, `async for`, or `async with` means it is a `def`.
- `asyncio.run` is an entry point. Never call it inside a coroutine or a running loop.
- Hold references to tasks you create. A discarded `create_task` return value can be garbage-collected mid-flight.
- On 3.11+, prefer `asyncio.TaskGroup` over `gather` for structured concurrency and first-error cancellation.
- `asyncio.timeout` (3.11+) over `wait_for` for new code — it composes with `TaskGroup` and propagates cancellation correctly.
</sublime_python_async_principles>

<sublime_python_async_rules>
**DO** use `asyncio.sleep` in coroutines. `time.sleep` blocks every task on the loop.
**DO** use `httpx.AsyncClient` or `aiohttp` for network I/O inside `async def`. Never `requests`.
**DO** bridge sync into async with `asyncio.to_thread(blocking_fn, ...)`, not a direct call and hope.
**DO** bound concurrency with a semaphore or `TaskGroup`. Unbounded `create_task` in a loop exhausts connections.

**DO NOT** call `asyncio.run` from inside a running loop.
  — `RuntimeError` on CPython; deadlocks on some harnesses.
**DO NOT** declare every FastAPI endpoint `async def` out of reflex. If the body is sync, `def` runs on a threadpool without blocking the loop.
**DO NOT** chain independent `await`s in series when they could run concurrently. Two sequential awaits with no data dependency should be `gather` or `TaskGroup`.
**DO NOT** forget `await`. A bare call on an `async def` returns a coroutine object and silently does nothing.
</sublime_python_async_rules>

---

### Decorators

→ *Consult [references/decorators.md](references/decorators.md) for the stack anti-pattern, `functools.wraps` rules, and when a context manager beats a decorator.*

Decorators separate cross-cutting concerns from business logic. A decorator used once is a function in disguise. A three-deep stack on a five-line function is slop that looks professional. Without `@functools.wraps`, pytest, FastAPI DI, and Sphinx all break.

<sublime_python_decorators_principles>
**Always apply these — no reference needed:**

- A decorator earns its keep when a cross-cutting concern applies to many call sites.
- `@functools.wraps(func)` on the inner function of every custom decorator. Always.
- `@property`, `@classmethod`, `@staticmethod`, `@cached_property`, `@contextmanager` — the standard five. Do not reinvent them.
- Parameterized decorators are a three-function dance. Write the non-parameterized version first; add the outer layer when a second caller demands configuration.
</sublime_python_decorators_principles>

<sublime_python_decorators_rules>
**DO** reach for `contextlib.contextmanager` over a class with `__enter__`/`__exit__` for one-shot resources.
**DO** measure before adding `@cache`/`@lru_cache`. A cache on a function called once is pure cost.
**DO** put cross-cutting concerns in framework middleware (FastAPI, Starlette, Django). Decorator-per-endpoint is a reinvention.
**DO** keep the stack shallow. Two is normal; three is a smell; four is almost always wrong.

**DO NOT** stack `@retry @cache @timed @traced @log` on a three-line function.
  — The stack is larger than the function. The function is the telemetry, not the business logic.
**DO NOT** write a class-based decorator when a closure works. The closure is half the lines.
**DO NOT** omit `@functools.wraps`. The function's identity is part of its contract.
**DO NOT** use `@staticmethod` as a way to put a function inside a class. Put the function at module scope.
</sublime_python_decorators_rules>

---

### Imports and packaging

→ *Consult [references/imports-and-packaging.md](references/imports-and-packaging.md) for absolute-vs-relative rules, `__init__.py` discipline, and the `pyproject.toml` build-backend landscape.*

Imports are the shape of your module graph. Wildcards, `__init__.py` doing the package's work, and `sys.path` hacks all say the graph is wrong. Emitting `setup.py` + `requirements.txt` is a training-data tell.

<sublime_python_imports_packaging_principles>
**Always apply these — no reference needed:**

- Absolute imports by default. Relative (`from .x import y`) only inside a tight package.
- `__init__.py` declares the public surface. Logic belongs in sibling modules.
- `if __name__ == "__main__":` belongs on entry-point scripts, not every library module.
- One build backend per project — `hatchling`, `setuptools`, `pdm-backend`, or `flit-core`. Do not mix.
- `pyproject.toml` is the source of truth. `requirements.txt` is a compiled artifact at best.
</sublime_python_imports_packaging_principles>

<sublime_python_imports_packaging_rules>
**DO** use `from __future__ import annotations` on 3.9/3.10 to side-step forward-reference headaches.
**DO** declare `__all__` when the public surface is narrower than the top-level names; otherwise omit it.
**DO** run packages as `python -m mypackage` when they have a `__main__.py`. Entry points in `pyproject.toml` are for CLIs.
**DO** keep test imports absolute. Relative imports break when the runner's working directory changes.

**DO NOT** write `from foo import *` in library code.
  — Pollutes the namespace, breaks static analysis, surfaces every internal name as public.
**DO NOT** put business logic in `__init__.py`. It runs on first import; heavy work there slows startup for every dependent.
**DO NOT** hack `sys.path` to find your own package.
  — It's always a missing `pyproject.toml` or a missing `-e` install. Fix the install, not the path.
**DO NOT** emit `setup.py` + `requirements.txt` on a project that has `pyproject.toml`.
</sublime_python_imports_packaging_rules>

---

### Iteration and comprehensions

→ *Consult [references/iteration.md](references/iteration.md) for the comprehension-vs-loop decision, the `itertools` cookbook, and the walrus operator's narrow use cases.*

`enumerate`, `zip`, `itertools`, and comprehensions mean 90% of what would be a loop elsewhere is a one-liner. `for i in range(len(x))` means the writer is translating, not writing Python.

<sublime_python_iteration_principles>
**Always apply these — no reference needed:**

- `for item in items` over `for i in range(len(items)):`. If you need the index, `for i, item in enumerate(items):`.
- `zip(a, b, strict=True)` (3.10+) for parallel iteration. `strict=True` catches length mismatches.
- Comprehensions when the loop body is a single expression. A `for` loop with `.append` is usually a comprehension in disguise.
- Generator expressions over materialized lists when the result is consumed once.
- `collections.Counter`, `defaultdict`, `deque` exist. Hand-rolling them is slop.
</sublime_python_iteration_principles>

<sublime_python_iteration_rules>
**DO** reach for `itertools.chain.from_iterable` to flatten. Hand-rolled nested loops with `.append` are verbose and slow.
**DO** use the walrus `:=` only when it shortens a comprehension or avoids a redundant call.
**DO** prefer `str.join` over `+=` in a loop. The `+=` pattern is O(n²) and signals C transliteration.
**DO** copy with `list(items)` before mutating during iteration.

**DO NOT** write `filter(lambda ...)` or `map(lambda ...)` when a comprehension reads better.
  — `[x for x in xs if cond(x)]` is the Python idiom.
**DO NOT** materialize a list to pass to `any`, `all`, or `sum`. They short-circuit on generators.
**DO NOT** iterate with manual indices when `enumerate` exists. `range(len(x))` is the single loudest "AI wrote this" tell in Python.
**DO NOT** reimplement `Counter` with `d[k] = d.get(k, 0) + 1`. Use the stdlib.
</sublime_python_iteration_rules>

---

## Hard BANs (Python)

<absolute_bans>

**BAN 1: Bare `except:`**
- PATTERN: `try: ... except: ...` with no exception type
- FORBIDDEN: any `except:` that catches `BaseException`
- WHY: catches `KeyboardInterrupt` and `SystemExit`, making the program un-interruptible. PEP 760 proposes deprecating the form.
- REWRITE: catch the specific type — `except KeyError:`, `except (OSError, ValueError):`. If you truly need a supervisor-loop catch-all, `except Exception:` with logging and a re-raise is the ceiling.

**BAN 2: `except Exception: pass`**
- PATTERN: `try: risky() except Exception: pass` — or the `log.error(...)` variant that still swallows
- FORBIDDEN: any handler that silently swallows every error
- WHY: the "diaper anti-pattern" — the signature defensive tic, the single most common reason Python bugs have no traceback in production.
- REWRITE: catch the specific exception and handle it with intent, or let it propagate. For one known failure, `with contextlib.suppress(SpecificError):` narrows it.

**BAN 3: Mutable default arguments**
- PATTERN: `def f(x=[]):` or `def f(x={}):`
- FORBIDDEN: any mutable (list, dict, set) as a function parameter default
- WHY: the default is evaluated once at definition and shared across every call. Two callers mutating "their" list find themselves sharing state. Ruff `B006`.
- REWRITE: `def f(x: list[str] | None = None): x = x if x is not None else []`. For dataclasses, `field(default_factory=list)`.

**BAN 4: `eval`/`exec` on user-controllable input**
- PATTERN: `eval(request_body)`, `exec(config_string)`, `eval(f"func_{name}()")`
- FORBIDDEN: passing any user-, file-, or network-influenced string to `eval` or `exec`
- WHY: arbitrary code execution — `eval(input())` is a tutorial for RCE.
- REWRITE: `ast.literal_eval` for literals, a dispatch dict for function lookup, `json.loads` for data, a real parser for a DSL.

**BAN 5: `pickle.load` on untrusted data**
- PATTERN: `pickle.loads(response.content)`, `pickle.load(user_upload)`
- FORBIDDEN: deserializing pickle from any source you do not fully control
- WHY: pickle is a code-execution format — `__reduce__` runs arbitrary Python at load time.
- REWRITE: `json`, `msgpack`, `cbor2`, or Pydantic for interchange. Reserve pickle for local caches between your own processes.

**BAN 6: Wildcard imports in library modules**
- PATTERN: `from foo import *` at the top of a package-surface module
- FORBIDDEN: any `from X import *` outside a REPL or notebook cell
- WHY: pollutes the namespace, breaks static analysis, makes refactors unsafe.
- REWRITE: import names explicitly. If the ergonomics are bad, fix `__init__.py`.

**BAN 7: `os.system` / `subprocess(shell=True)` with interpolated input**
- PATTERN: `os.system(f"ls {path}")`, `subprocess.run(f"grep {term} log", shell=True)`
- FORBIDDEN: any shell invocation with user-influenced values in the command string
- WHY: shell injection. `path = "; rm -rf /"` does what it says.
- REWRITE: `subprocess.run(["grep", term, "log"], shell=False, check=True)`. Pass the argv list.

**BAN 8: `asyncio.run()` inside a running event loop**
- PATTERN: `async def handler(): return asyncio.run(do_work())`
- FORBIDDEN: calling `asyncio.run` from anywhere a loop already runs
- WHY: `RuntimeError: asyncio.run() cannot be called from a running event loop` on CPython; harness-dependent deadlocks elsewhere. It's an entry point, not a function call.
- REWRITE: `await do_work()`. For sync-from-async, `asyncio.to_thread(sync_fn)`.

**BAN 9: Mutable class attribute where an instance attribute was meant**
- PATTERN: `class C: items = []` with per-instance `self.items.append(...)` expected
- FORBIDDEN: any mutable bound at class scope that instances modify independently
- WHY: shared across every instance. `C().items.append(1); C().items` returns `[1]`. Class-level BAN 3.
- REWRITE: initialize in `__init__`, or use a `dataclass` with `field(default_factory=list)`.

**BAN 10: `time.sleep` inside `async def`**
- PATTERN: `async def retry(): time.sleep(1); ...`
- FORBIDDEN: any blocking call (`time.sleep`, `requests.get`, blocking `open`, CPU-bound work) inside a coroutine
- WHY: blocks the event loop for every task on it. One `time.sleep(1)` in a FastAPI handler blocks every concurrent request. Ruff `ASYNC251`.
- REWRITE: `await asyncio.sleep(1)`. For HTTP, `httpx.AsyncClient` or `aiohttp`. For CPU-bound, `asyncio.to_thread` or a process pool.

</absolute_bans>

---

## AI Slop Test (Python)

If an experienced Python reviewer read this diff and said "an AI wrote this," would they be right on sight? These are the tells:

<sublime_python_slop_tells>

- `from typing import List, Dict, Tuple, Optional` on a 3.9+ codebase.
- `Optional[X]` on 3.10+ where `X | None` reads.
- `dict[str, Any]` as a public return type when the keys are statically known.
- A `class` wrapping three functions that share no state — `class Utils: @staticmethod def foo(): ...`
- `FooManager`, `FooService`, `FooHandler` where `foo()` would do.
- `getattr(obj, "x", None)` cascades on a typed object where `obj.x` would read.
- `if isinstance(x, int): ... elif isinstance(x, str): ...` dispatch instead of `singledispatch` or `match`.
- `try: v = d["k"] except KeyError: v = None` where `d.get("k")` would do.
- `for i in range(len(items)): item = items[i]` where `for item in items` would do.
- Six `dict.get` calls instead of a `TypedDict` or Pydantic model.
- A three-field `BaseModel` used once for an internal record. Pydantic-for-a-dict.
- Pydantic v1 API (`.dict()`, `@validator`, `class Config`) on a v2 project.
- `if __name__ == "__main__":` on every library module.
- A `@retry @timeout @validate @observe @cache` stack on a five-line function.
- `logger.info("Entering foo")` / `logger.info("Leaving foo")` everywhere.
- `asyncio.run(...)` inside an already-async function.
- `async def` on a body with no `await`. `time.sleep` or `requests.get` inside a coroutine.
- `os.path.join`, `os.path.exists`, `os.path.dirname` where `pathlib.Path` reads.
- `sys.path.insert(0, ...)` at the top of a module.
- `from .a import *; from .b import *` in `__init__.py`.
- `class TestFoo(unittest.TestCase)` with `self.assertEqual` in a pytest project.
- `@patch("mymodule.helper")` where the SUT did `from mymodule import helper`.
- `T = TypeVar("T")` used in exactly one signature.

</sublime_python_slop_tells>

Good Python is distinctive to its domain. Slop Python is distinctive to the model that wrote it.

---

## Implementation Principles (Python)

Types are documentation the checker enforces; use them on public surfaces and skip obvious inference. Reach for the narrowest container the data's lifecycle demands — dataclass for internal records, TypedDict for wire shapes, Pydantic at untrusted boundaries, plain dict for one-offs. Prefer EAFP; catch the specific exception; never swallow `Exception`. Pick an async posture per module and keep it — `async def` without `await` is a mistake, `time.sleep` in a coroutine is a bug. Keep decorator stacks shallow, `__init__.py` thin, imports absolute, and loops replaced by comprehensions when the body is a single expression. Remember: {{model}} is capable of writing Python that Guido would recognize as Python. Don't hold back — but don't write Java either.

---

## Deeper reference

- [references/typing.md](references/typing.md) — type hints, `Any`/`object`/`Unknown`, mypy vs pyright.
- [references/data-modeling.md](references/data-modeling.md) — dataclass, TypedDict, NamedTuple, Pydantic v2, `match`/`case`.
- [references/exceptions.md](references/exceptions.md) — EAFP vs LBYL, exception chaining, `contextlib`.
- [references/async.md](references/async.md) — asyncio/trio/anyio, `TaskGroup`, `timeout`, sync-async bridging.
- [references/decorators.md](references/decorators.md) — `functools.wraps`, stack depth, parameterized decorators.
- [references/imports-and-packaging.md](references/imports-and-packaging.md) — absolute vs relative, `pyproject.toml`, build backends.
- [references/iteration.md](references/iteration.md) — comprehensions, `itertools`, walrus operator.

Python-specific anti-patterns: [anti-patterns.md](anti-patterns.md)

Core foundation: [../../sublime/SKILL.md](../../sublime/SKILL.md)
