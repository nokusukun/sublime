# Three LLM code slop taxonomies: Python, Go, React

This report delivers three parallel, deeply-researched taxonomies of named LLM code slop patterns — one each for Python, Go, and React — covering ~82 distinct named patterns with code examples, community quotes, lint-rule mappings, and source citations. Each taxonomy is designed to be the seed for a lint-rule catalog and a language/framework-specific Sublime extension.

Three cross-cutting findings emerge before we get into the details. **First**, the Python and Go ecosystems both suffer a "training-corpus lag" — LLMs still default to pre-2021 idioms (`typing.Optional`, `io/ioutil`, `sort.Slice`, `requests` in async code) years after the community moved on, and the Go team explicitly documented this in its December 2024 [go fix announcement](https://go.dev/blog/gofix) ("such tools tended — unsurprisingly — to produce Go code in a style similar to the mass of Go code used during training, even when there were newer, better ways"). **Second**, each ecosystem has a dominant "signature slop pattern" that a single lint rule could eliminate: Python's is `Dict[str, Any]` plus `typing.Optional` (catchable by ruff `UP006/UP007/UP045` + mypy `--disallow-any-expr`); Go's is the naked `if err != nil { return err }` without `%w` wrapping (catchable by `wrapcheck` + `errorlint`); React's is `useEffect` for data fetching + derived state (catchable by `eslint-plugin-react-you-might-not-need-an-effect`). **Third**, frontier models (Claude Sonnet 4.5, GPT-5, Gemini 2.5) have materially reduced surface-level slop (PEP 585 typing, `%w` wrapping, `slices.Contains`) but persist on architectural slop (interface pollution, async-everywhere, provider hell, "Clean Architecture" deep hierarchies), because architectural patterns are not visible in single-file context windows.

Frequency ratings and "Associated LLMs" labels in all three taxonomies are qualitative judgments synthesized from community reporting (Hacker News, Reddit, maintainer blogs, the Go team's own posts), not controlled empirical studies — they should be treated as directional. Where a lint rule code is given, it maps to a real tool (ruff, golangci-lint, eslint plugin) that you can wire straight into CI.

---

## Python slop taxonomy

### Executive summary

Python's LLM slop has three gravitational centers. **Pre-PEP-585/604 typing noise** is the most visible tell — `List[X]`, `Dict[str, Any]`, `Optional[int]`, `Union[str, int]` still dominate generated code years after 3.9/3.10 made them obsolete. **Async-everywhere cargo-culting** from FastAPI-saturated training data produces `async def` wrappers over synchronous bodies that then call blocking `requests` or `time.sleep`, stalling event loops. **Pydantic v1→v2 API drift** (`.dict()` vs `.model_dump()`, `@validator` vs `@field_validator`, nested `class Config` vs `model_config`) is the single biggest regression from the 2022-era training cut-off, confusingly mixed when codebases have both versions in their dependency tree. Beneath this sit classic shape-over-substance patterns: bare `except:` (catches `KeyboardInterrupt`), `raise` without `from e` (truncated tracebacks), `os.path` resistance (vs `pathlib`), `__init__.py` bloat, static-method-only classes, and decorator stacks larger than the functions they decorate. Armin Ronacher summarizes the arc in his June 2025 post: *"already today the code looks nothing like the terrible slop from a few months ago"* — but architectural slop persists.

### The taxonomy

#### 1. Unpythonic idioms

**`range-len-loop`** — `for i in range(len(seq)):` followed by `seq[i]` access. Classic C/Java translation. *"The #1 sign a Python author came from Java."* **Bad:** `for i in range(len(items)): print(i, items[i])`. **Good:** `for i, item in enumerate(items):`. Very common, especially GPT-3.5 and older Copilot; reduced but still present in frontier models on "translate this pseudocode" tasks. **Detectable:** ruff `SIM113`, pylint `C0200`.

**`parallel-indexing-miss`** — iterating with `range(len(a))` then using `a[i], b[i]`. Forces equal-length assumption silently. **Good:** `for name, score in zip(names, scores, strict=True):`. Ruff `B905` flags the missing `strict=` but not the underlying sin. Common in older Copilot completions.

**`try-except-for-dict-get`** — `try: v = d[k] except KeyError: v = default` where `d.get(k, default)` suffices. Verbose, slower, can mask unrelated `KeyError`s raised inside the body. Common across all LLMs. **Detectable:** ruff `SIM401`, `PERF203` (try/except in loop).

**`manual-file-handle`** — `f = open(path); data = f.read(); f.close()` with no `with`. Leaks file descriptors on exceptions. Common in GPT-3.5 and smaller models. **Detectable:** ruff `SIM115`.

**`reinvented-collections`** — hand-rolled `Counter` (`d[k] = d.get(k,0)+1`), manual `chain` double-loops, manual `groupby`. Raymond Hettinger's *"there must be a better way."* Very common. Review-level mostly; partial coverage from refurb/`FURB` rules.

#### 2. Exception handling

**`bare-except`** — `try: ... except:` with no type, catching `BaseException` and swallowing `KeyboardInterrupt`/`SystemExit`. PEP 760 proposes deprecating it: *"can make it hard to interrupt the program (e.g., with Ctrl-C) and can disguise other problems."* Very common, all LLMs. **Detectable:** ruff `E722`, pylint `W0702`.

**`diaper-anti-pattern`** — `except Exception: pass` or `except Exception: log.error(...)` swallowing everything. Ian Bicking: *"all the information about how [the code] failed is lost."* **Very common** — the signature LLM "defensive" tic, aggravated by Claude's helpfulness tendency. **Detectable:** ruff `BLE001`, pylint `W0718`.

**`lost-traceback-raise`** — `except X as e: raise Y("bad")` without `from e`, or `raise e` (by name, truncates traceback). Very common; rarely do LLMs emit `from e` unless prompted. **Detectable:** ruff `B904`, `TRY200`.

**`log-and-reraise-duplication`** — `except X: logger.exception(...); raise`. The exception gets logged again by an outer handler, producing duplicated tracebacks. Common in "enterprise-y" Claude/GPT-4 output. Review-only (no first-class ruff rule; pylint issue #3241 proposed but not merged).

**`exception-class-bloat`** — `class FooError(Exception): pass` × N, one per function, never distinguishing handler behavior. Claude especially loves scaffolding exception hierarchies. Review-only; partial via ruff `N818`.

#### 3. Packaging and imports

**`init-reexport-bloat`** — top-level `__init__.py` that `from .a import *; from .b import *` to "flatten the API," triggering circular imports and slow startup. Common in Claude/GPT-4 output asked to "expose a clean API." Partial: ruff `F401/F403`.

**`star-import`** — `from numpy import *`. Common in notebook-style LLM output. Ruff `F403/F405`.

**`sys-path-hack`** — `sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))`. Very common in multi-file agentic tasks (Claude Code, Cursor) because they work around missing `pyproject.toml` instead of creating one. Review-only; no static rule.

**`setup-py-in-pyproject-era`** — generating `setup.py` + `requirements.txt` when PEP 621 `pyproject.toml` + uv/hatch is the 2024+ standard. Hynek: *"uv has become Python's finest workflow tool."* LLM training data leans pre-2021. Review-only.

**`main-boilerplate-everywhere`** — every module ending with `if __name__ == "__main__": main()` even library modules that will never be executed directly. Very common; noise in library code. Review-only.

#### 4. OOP overreach

**`static-method-only-class`** — `class Utils: @staticmethod def foo(): ...` with no state. Just use a module. Very common; worst in Copilot and Claude OO-biased prompts. Partial: pylint `R0903`.

**`manager-class`** (function-masquerading-as-class) — `class FooManager(cfg).run()` is literally a function with extra steps. Jack Diederich's famous 2012 PyCon talk ["Stop Writing Classes"](https://pyvideo.org/video/880/stop-writing-classes) is the canonical critique. Very common in Claude agentic output.

**`java-getter-setter`** — `get_name()/set_name(v)` where a plain attribute or `@property` would do. Common in Copilot/GPT-4. Review-only.

**`double-underscore-privacy`** — `self.__client`, `self.__config` everywhere (name mangling) when `self._client` (convention) suffices. Name mangling is for avoiding collision in subclasses, not "privacy"; breaks legitimate subclass use. Common; LLMs confuse semantics from Java/C++.

**`inheritance-where-composition`** — deep hierarchies (`BaseHandler → AuthHandler → JSONAuthHandler → ...`) for trivial tasks. Hynek Schlawack's ["Subclassing, Composition, Python, and You"](https://pyvideo.org/speaker/hynek-schlawack.html) is the reference critique. Common in Claude 3.x/4 output. Pylint `R0901`.

#### 5. Dunder and magic

**`repr-str-asymmetry`** — defines `__repr__` without `__str__` or vice-versa, or emits a `__str__` that mimics `__repr__` format. `__repr__` should be unambiguous; `__str__` is for humans. Common across all LLMs; use `attrs`/dataclass auto-repr.

**`missing-slots`** — thousands-of-instance value classes that forgo `__slots__`, wasting memory on `__dict__`. Common. **Detectable:** ruff `SLOT000–SLOT002`.

**`eq-without-hash`** — class defines `__eq__` but not `__hash__`, silently becoming unhashable. Common. **Detectable:** ruff `PLW1641`, pylint `W1641`.

**`hand-rolled-iterator`** — full `class MyIter: __iter__, __next__` with state tracking where a generator function would be 3 lines. Common in GPT-3.5 and Claude when asked "implement an iterator." Review-only.

**`manual-context-manager-class`** — 20-line class with `__enter__/__exit__` for one-shot resource management where `contextlib.contextmanager` + `yield` is shorter. Common in Claude/GPT-4. Review-only.

#### 6. Standard library blindness

**`os-path-blindness`** — `os.path.join`, `os.path.exists`, `os.path.dirname` where `pathlib.Path` is idiomatic (PEP 428, Python 3.4+). **Very common** — training data predates pathlib dominance. **Detectable:** ruff `PTH100–PTH208` (flake8-use-pathlib, a whole rule family).

**`manual-urlencode`** — `"&".join(f"{k}={v}" for k,v in d.items())` where `urllib.parse.urlencode(d)` exists. Common in GPT-3.5. Review-only.

**`reinvented-counter-defaultdict`** — `d[k] = d.get(k,0)+1` and `if k not in d: d[k] = []; d[k].append(v)`. Very common. Review-only; partial refurb `FURB` coverage.

**`manual-flatten`** — nested `for sub in nested: for x in sub: flat.append(x)` instead of `itertools.chain.from_iterable`. Common. Partial: ruff `PERF401`.

**`naive-datetime-math`** — `datetime.now()` without tz; manual `.days * 86400 + .seconds` subtraction. DST/timezone bugs galore. `datetime.now(timezone.utc)` and `.total_seconds()` exist. Very common. **Detectable:** ruff `DTZ001–DTZ012` (flake8-datetimez).

#### 7. Performance anti-patterns

**`string-plus-in-loop`** — `s = ""; for w in words: s += w + ","` is O(n²) in general; `",".join(words)` is canonical. Very common in GPT-3.5/Copilot. Partial: perflint/refurb.

**`append-not-comprehension`** — `out = []; for x in xs: out.append(f(x))` instead of `[f(x) for x in xs]`. Very common. **Detectable:** ruff `PERF401`.

**`materialized-where-generator-works`** — `sum([x*x for x in xs])`, `any([cond(x) for x in xs])`. Short-circuits in `any`/`all` don't work if you materialize first. Common. **Detectable:** ruff `C419`.

**`list-membership-in-loop`** — `if key in big_list:` repeated inside a loop (O(n·m)) instead of converting to a `set` once. Common. Review-only; Perflint has related rules.

**`try-except-in-tight-loop`** — loop body wrapped in `try/except` where hoisting the `try` outside or using `dict.get` / LBYL avoids exception-setup cost. Common. **Detectable:** ruff `PERF203`.

#### 8. Type hint slop

**`dict-str-any-smell`** — public function returning `Dict[str, Any]` / `dict[str, Any]` where the body returns a dict literal with >2 statically known keys. An abdication of typing — the LLM knows the keys at generation time but refuses to commit to a schema. **The single most common type-annotation slop.** All LLMs, worst in GPT-3.5/4-turbo, Llama 3. **Detectable:** custom AST rule for `dict[str, Any]` in return annotations; mypy `--disallow-any-expr`; pyright `reportAny`.

**`list-dict-capital`** — `typing.List[int]`, `typing.Dict[str, int]`, `typing.Tuple[...]` on target-version ≥ 3.9 despite PEP 585 being five years old. **Extremely common — arguably the #1 visual tell of LLM-written Python.** **Detectable:** ruff `UP006`, auto-fixable. Claude 3.5+ mostly fixed this; GPT-4o persists.

**`optional-on-3-10-plus`** — `typing.Optional[int]` / `typing.Union[str, int]` when PEP 604 gives you `X | None` and `str | int`. Extremely common, co-occurs with `list-dict-capital`. Ronacher: LLMs love "stable ecosystems with little churn" — they stick to old typing. **Detectable:** ruff `UP007` (Union), `UP045` (Optional), both auto-fixable.

**`pydantic-for-a-dict`** — `BaseModel` subclass with only plain scalar fields, no validators, never constructed from untrusted input. Hynek / Tin Tvrtković: *"Is it really necessary to re-validate all your objects while reading them from a trusted database?"* High-frequency, especially in FastAPI-adjacent code. **Good:** `@dataclass(slots=True, frozen=True)` or `attrs.frozen`. Review-only; heuristic AST rule.

**`missing-public-return-type`** — public function with typed params but no return annotation. Mypy silently infers `Any`, propagating it. **Detectable:** ruff `ANN201`, `ANN202`; mypy `--disallow-untyped-defs`.

**`typevar-ceremony`** — module defines `T = TypeVar("T")` used in one signature with no real generic variance. Appears when LLMs try to "look professional." Review-only.

**`bare-callable`** — `Callable` or `Callable[..., Any]` with no signature for a non-trivial callback. Defeats caller signature checking. Medium-high frequency. Partial: mypy `--disallow-any-generics`.

**`type-checking-abuse`** — `if TYPE_CHECKING:` importing modules needed at runtime, causing `NameError`; or over-applying the pattern when `from __future__ import annotations` is already active. Vicki Boykis: *"I now no longer trust anything in the Python typing ecosystem."* **Detectable:** ruff `TC001/TC002/TC003`.

**`any-leakage`** — function has typed params but returns `Any` (e.g., from `json.loads`), which propagates. Very high. **Detectable:** mypy `--warn-return-any`; pyright `reportAny` (strict).

#### 9. Async slop

**`time-sleep-in-async`** — `time.sleep(1)` inside `async def`. Blocks the entire event loop. Very high in LLM-generated retry/backoff loops. **Detectable:** ruff `ASYNC251` (also `ASYNC250/220/221/222/230/240` for other blocking primitives).

**`blocking-http-in-async`** — `requests.get/post` or sync `httpx.Client` inside `async def`. LLMs default to `requests` from muscle memory. **Very high — persists even in frontier models.** **Detectable:** ruff `ASYNC210/211/212`.

**`async-everywhere-cargo-cult`** — every FastAPI endpoint declared `async` regardless of body; non-I/O functions declared `async def` with no awaits. Endemic in FastAPI code because training corpora are saturated with "async def endpoint" examples. FastAPI discussion #5227 advice is applied with no nuance. **Detectable:** ruff `RUF029` (unused-async).

**`forgotten-await`** — calling `async def fetch_user(id)` without `await` and using the return value as if resolved. Silent no-op; `RuntimeWarning: coroutine was never awaited` often missed. Medium. **Detectable:** pyright `reportUnusedCoroutine`, ruff `RUF029`.

**`orphan-create-task`** — `asyncio.create_task(coro())` whose return value is discarded. CPython docs: *"A task that isn't referenced elsewhere may get garbage collected at any time, even before it's done."* **High — classic LLM mistake.** **Detectable:** ruff `RUF006`.

**`asyncio-run-inside-loop`** — `asyncio.run(coro)` called from inside an already-running event loop. Raises `RuntimeError`. Medium, common in LLM glue code / CLI wrappers. Runtime-detectable only.

**`serial-await-missing-gather`** — two or more independent `await` calls in sequence with no data dependency, paying latency in series. **Very high.** Leaves the main advantage of async on the table. Review-only; custom AST rule catches many cases.

**`async-wrapping-sync`** — `async def slugify(s): return s.lower()` with no `await`/`async for`/`async with`. Pays coroutine overhead. High. **Detectable:** ruff `RUF029`.

#### 10. Decorator abuse

**`observability-stack`** — ≥3 decorators (`@retry @cache @timed @traced @log`) on a function ≤5 lines. The stack is larger than the function. High when prompt includes "production-ready." Review-only; custom lint heuristic possible.

**`custom-decorator-for-one-use`** — hand-rolled decorator used at exactly one call site where `with contextlib.contextmanager` works. Medium. Review-only.

**`missing-functools-wraps`** — custom decorator whose inner function lacks `@functools.wraps(func)`. Breaks `__name__`, `__doc__`, pytest discovery, FastAPI dependency resolution. Medium-high.

**`class-decorator-where-function-works`** — `class MyDecorator: __init__, __call__` when a closure suffices. Low-medium; GPT-4 OO tendency. Review-only.

**`staticmethod-spam`** — `@staticmethod` methods that don't use `self`/`cls`, only called via instance, where a module function would do. Very high in LLM utility classes.

#### 11. Dataclass and Pydantic confusion

**`pydantic-v1-api-drift`** — calls to `model.dict()`, `.json()`, `Model.parse_obj()`, `.parse_raw()`, `.schema()` on Pydantic ≥2. Deprecated since v2.0, to be removed in v3.0. Simon Willison: *"I've already had two instances of LLM plugins with dependencies that were incompatible with Pydantic 2."* **Extremely high in anything before mid-2024 training cut-off — the #1 LLM-era Python regression.** Runtime: `PydanticDeprecatedSince20` warning; static review/custom AST.

**`validator-decorator-drift`** — `from pydantic import validator` with `@validator("x", always=True, pre=True)` on v2 `BaseModel`. v2 split into `@field_validator` (mode="before") and `@model_validator`; `always=` gone. Very high. Import-level check catchable.

**`class-config-in-v2`** — nested `class Config:` with v1 keys (`orm_mode`, `allow_population_by_field_name`) in a v2 `BaseModel`. v2 uses `model_config: ConfigDict = ConfigDict(from_attributes=True, populate_by_name=True)`. High.

**`mutable-default-no-factory`** — `tags: list[str] = []` on `@dataclass`/`attrs.define`/Pydantic field. Dataclasses raise `ValueError` at class creation for list/dict/set, but subtler mutables slip through. Medium. **Detectable:** ruff `RUF008`, `RUF009`, `B006`.

**`namedtuple-for-record`** — `NamedTuple` used as a record then mutated via `._replace()` chains. Hynek: *"collections.namedtuples are tuples with names, not classes."* Medium. Review-only.

#### 12. Testing slop

**`unittest-in-pytest-project`** — `class TestFoo(unittest.TestCase)` with `self.assertEqual/self.assertTrue` in a repo whose test runner is pytest. Disables `parametrize` + fixtures for that class; loses pytest's assertion introspection. Very high. **Detectable:** ruff `PT009`, `PT027`.

**`xunit-setup-teardown`** — `setUp(self)/tearDown(self)` inside a pytest test class instead of fixtures. Couples shared state to test classes; doesn't compose. High, co-occurs with `unittest-in-pytest-project`.

**`autouse-overreach`** — `@pytest.fixture(autouse=True)` in top-level `conftest.py` applying a global patch (time freeze, env overrides) to every test without narrower scope. Tests become magic; individual tests aren't runnable without conftest chain. Medium.

**`mock-patch-wrong-path`** — `@patch("package.module.helper")` where SUT did `from package.module import helper`. The patch should target the consuming module's binding (`mymod.helper`). Test passes but doesn't actually mock. See [cpython#117860](https://github.com/python/cpython/issues/117860). **Very high — responsible for a huge share of LLM-generated test failures.** Review-only; no static rule catches reliably.

**`mocker-vs-monkeypatch-mix`** — mixing `unittest.mock.patch` decorators, `monkeypatch`, and `mocker.patch` in the same test module; or stacking `@mock.patch` decorators above pytest tests with fragile arg order (`mock_b, mock_a, tmp_path`). High.

**`parametrize-fixture-confusion`** — passing fixture functions directly in `parametrize` values expecting pytest to resolve them (it doesn't — [pytest#349](https://github.com/pytest-dev/pytest/issues/349)). Medium.

### Cross-cutting themes

**Training-corpus lag drives >60% of the catalog.** PEP 585 (3.9, 2020), PEP 604 (3.10, 2021), Pydantic v2 (2023), and the FastAPI async idiom are the four training-cutoff fault lines producing the loudest slop. Running `ruff check --select UP,PTH,ASYNC,DTZ --fix --unsafe-fixes` on any LLM patch catches most surface slop in one pass.

**FastAPI training contamination is the #1 production-latency bug source** in LLM Python services: async-everywhere patterns pair cleanly with blocking stdlib calls, and the `asyncio` docs warnings are not strong enough to overcome the generated-code prior.

**Pydantic v1→v2 drift is the single biggest regression** — LLMs trained in 2022–2023 emit `.dict()` and `@validator` reflexively even when the runtime is v2. Confusion worsens in codebases that have both v1 and v2 in the dependency tree (LangChain-era transitive deps).

**Architectural slop is largely unreduced by frontier models.** Ronacher's observation that newer models produce "code nothing like the terrible slop from a few months ago" applies to surface patterns; static-method-only classes, manager-classes, inheritance chains, and observability decorator stacks persist because they look professional and aren't visible as mistakes in isolation.

### Notable sources

- Armin Ronacher's 2025–2026 blog series on [agentic coding](https://lucumr.pocoo.org/2025/6/12/agentic-coding/) and [90% AI-written code](https://lucumr.pocoo.org/2025/9/29/90-percent/) — the best senior-engineer perspective.
- Hynek Schlawack on [attrs vs Pydantic](https://hynek.me/) and [subclassing vs composition](https://pyvideo.org/speaker/hynek-schlawack.html).
- [Ruff rules documentation](https://docs.astral.sh/ruff/rules/) — the single most actionable reference; many slop patterns already have rule codes (UP, PTH, ASYNC, DTZ, BLE, PERF, RUF).
- [Pydantic v1→v2 migration guide](https://docs.pydantic.dev/latest/migration/) — essential for detecting v1-era LLM patterns.
- Simon Willison's [tag page on Pydantic](https://simonwillison.net/tags/pydantic/) aggregates real-world LLM/plugin breakage.
- Jack Diederich, ["Stop Writing Classes"](https://pyvideo.org/video/880/stop-writing-classes), PyCon 2012 — still canonical.
- FastAPI [async docs](https://fastapi.tiangolo.com/async/) and [discussion #5227](https://github.com/fastapi/fastapi/discussions/5227) — the origin of async-everywhere training signal.

---

## Go slop taxonomy

### Executive summary

Go slop clusters around three failure modes so consistently that r/golang mods [drew an explicit "vibe-coded" line](https://www.clientserver.dev/p/rgolang-draws-a-line-on-ai-generated) in 2025. **Error-handling slop** dominates: naked `if err != nil { return err }` without `%w` wrapping is the single most prolific LLM pattern, followed by swallowed errors, double-reporting (log AND return), and `err == ErrFoo` sentinel comparisons that break under wrapping. **Interface pollution** is the defining architectural sin: single-implementation interfaces declared in the producer package, `NewThing() Thinger` returning an interface, and Repository/Service interfaces that mirror structs 1:1 — all violating Rob Pike's *"The bigger the interface, the weaker the abstraction"* and the community proverb *"Accept interfaces, return structs."* **Training-cutoff stdlib blindness** produces manual `Contains` loops instead of `slices.Contains` (1.21+), `io/ioutil` after its 2021 deprecation, `sort.Slice` where `slices.Sort` works, and manual `strings.Split+index` where `strings.Cut` exists — all documented as a deliberate training-corpus failure in Go's own December 2024 [go fix blog post](https://go.dev/blog/gofix): *"such tools tended to produce Go code in a style similar to the mass of Go code used during training."* Underneath these sit context-propagation bugs (`context.Background()` in request handlers instead of `req.Context()`), `package utils`/`/pkg` cargo cults, defer-in-loops that leak file descriptors, goroutine leaks from the "forgotten sender" pattern, and a general RWMutex-by-default instinct that hurts perf. Frontier models (Claude Sonnet 4, GPT-5, Gemini 2.5) reliably wrap errors and close response bodies when given a 1.22+ context; they do not reliably collapse interface pollution or switch `RWMutex`→`Mutex`.

### The taxonomy

#### 1. Error handling

**`naked-err-return`** — `if err != nil { return err }` without `fmt.Errorf("...: %w", err)` wrapping. Dave Cheney: *"the problem with this code is I cannot tell where the original error came from … all that will be printed is: No such file or directory."* **Very high — the single most common LLM Go error-handling slop.** **Detectable:** `wrapcheck` linter; `errorlint -errorf`.

**`verb-v-instead-of-w`** — `fmt.Errorf("...: %v", err)` instead of `%w`. Breaks `errors.Is`/`errors.As` unwrapping, defeats Go 1.13 error wrapping. Very high, especially in models trained on pre-1.13 code. **Detectable:** `errorlint`.

**`shadowed-err`** — `err := f()` inside a nested block silently shadowing an outer `err`, causing the outer check to see `nil`. Medium-high; LLMs use `:=` reflexively. **Detectable:** staticcheck `SA4006`; `govet` shadow analyzer.

**`err-swallowed-with-underscore`** — `x, _ := someFunc()` discarding an error return. Cheney: *"If you make less than one decision, you're ignoring the error."* Medium. **Detectable:** `errcheck`, `errchkjson`, `gosec G104`.

**`log-and-return`** — function both logs AND returns the error; same error appears 3–5× in logs. Cheney: *"making more than one decision in response to a single error is also problematic."* **High in LLM code** — models aggressively add `log.Printf("error: %v", err)` before every return because it "looks defensive." Review/semgrep only.

**`pointless-custom-error-type`** — one-field struct implementing `Error() string` with no extra behavior. Cheney: *"avoid error types, or at least, avoid making them part of your public API."* Medium; LLMs mimic Java exception hierarchies. Review-only.

**`sentinel-equality-after-wrap`** — `if err == sql.ErrNoRows` comparing with `==` when any caller might have wrapped. Breaks silently the moment a caller adds `%w`. **Very high.** **Detectable:** `errorlint -comparison` (enabled by default).

**`errors-as-type-assertion`** — `myErr, ok := err.(*MyError)` on a possibly-wrapped error. Should use `var me *MyError; errors.As(err, &me)`. Also: passing non-pointer to `errors.As` (panics). High. **Detectable:** `errorlint -asserts`; `go vet` errorsas analyzer.

#### 2. Interface pollution

**`preemptive-single-impl-interface`** — interface in producer package with exactly one implementation in the same package and no external mocks yet. Rob Pike: *"Don't design with interfaces, discover them."* Adds indirection, blocks inlining, escapes to heap. **Extremely high — a defining LLM slop pattern.** **Detectable:** `iface`, `interfacebloat` linters; custom AST.

**`producer-side-interface`** — `func NewServer() Server` where `Server` is an interface defined in the same package. Violates Jack Lindamood's codified proverb *"Accept interfaces, return structs."* Forces dynamic dispatch, heap escape. **Very high.** **Detectable:** `ireturn` linter.

**`interface-any-abuse`** — `interface{}`/`any` parameters and `map[string]any` for structured data when a concrete type or generic would do. High, especially when LLMs port Python/JS code. Review-only.

**`repository-service-mirror`** — `type UserRepository interface { Create; Read; Update; Delete }` with exactly one concrete impl `pgUserRepository` in the same package — interface mirrors struct 1:1, "for testability." Andrei Boar: *"If you abuse interfaces by creating many mocks, you end up testing mocks that are never used in production."* **Endemic in LLM-generated 'clean architecture' scaffolds.** Cursor and Copilot agent mode especially produce this. Review / custom lint.

**`empty-interface-for-json`** — `var out map[string]interface{}` for unmarshalling when a struct with JSON tags would work. High. **Detectable:** `musttag`, `tagliatelle`.

#### 3. Goroutine mismanagement

**`unbounded-go-in-loop`** — `for _, x := range items { go work(x) }` with no concurrency bound and no `sync.WaitGroup`/`errgroup`. Exhausts FDs, DB pool, rate limits. **Very high.** **Fix:** `errgroup.Group` with `g.SetLimit(N)` or buffered semaphore. Review-only.

**`missing-ctx-cancellation`** — long-running goroutine with `for { ... }` that never selects on `ctx.Done()`. *"The for{} plus select has no exit, and the goroutine that owns it is going to outlive the HTTP server, the database pool, and your patience."* **Very high.** **Detectable:** `contextcheck`, `fatcontext`, `noctx`, `lostcancel` (govet); Go 1.26 goroutine leak profile catches at runtime.

**`forgotten-sender-leak`** — unbuffered `chan X`; goroutine sends; parent returns early before receive. Sender blocks forever. [Classic Ardan Labs case.](https://www.ardanlabs.com/blog/2018/11/goroutine-leaks-the-forgotten-sender.html) Fix: `make(chan X, 1)`. **Detectable:** `go.uber.org/goleak` in tests; not caught by `go vet` or `-race`.

**`missing-errgroup`** — `sync.WaitGroup` coordinating fallible tasks with a side-channel `errCh`. No first-error cancellation. Reimplements `errgroup` badly. High.

**`waitgroup-misuse`** — (a) `wg.Add(1)` inside a goroutine after it started (race with `Wait`); (b) passing `sync.WaitGroup` by value; (c) forgetting `defer wg.Done()`. Medium. **Detectable:** `go vet copylocks`, staticcheck `SA2000`.

**`loopvar-capture-pre-1.22`** — `for _, v := range xs { go func() { use(v) }() }` in Go ≤1.21 — all goroutines see the same `v`. LLMs still emit the buggy form. **Detectable:** `copyloopvar`, `loopclosure` (govet), `exportloopref`.

**`directionless-channel-param`** — functions take `chan T` instead of `<-chan T` / `chan<- T`. Loses compile-time producer/consumer enforcement. High. Review / `gocritic`.

#### 4. Channel slop

**`unbuffered-where-buffered-needed`** — `make(chan X)` for a one-shot result where context cancel might cause the receiver to abandon the channel, leading to forgotten-sender leaks. **Very high.**

**`no-close-on-range`** — producer writes to `ch` but never `close(ch)`; `for v := range ch` hangs when producer exits. Medium-high. Review / `goleak`.

**`close-from-receiver`** — receiver side calls `close(ch)`, causing sender to panic with *"send on closed channel."* [Go 101](https://go101.org/article/channel.html): *"we should avoid concurrent send and close operations on the same channel."* Medium.

**`double-close-send-on-closed`** — closing a channel twice, or sending on a closed channel — both panic at runtime. Medium. `-race` partial.

**`nil-channel-in-select`** — `var ch chan T` never initialized; receive blocks forever. Sometimes intentional (to disable a branch) but usually a bug. Low-medium. Partial: staticcheck `SA1017`, `nilness`.

**`channels-where-mutex-works`** — protecting a single counter via channel + goroutine + select when `sync.Mutex` or `atomic.Int64` is simpler. Cargo-culted from "share memory by communicating" without nuance. Medium.

#### 5. Concurrency safety

**`race-missing-mutex`** — multiple goroutines read/write shared map/slice/field with no synchronization. Produces `fatal error: concurrent map read and map write`. High. `go test -race`; no static rule.

**`sync-map-abuse`** — `sync.Map` for balanced read/write workloads or where you need `len`/iteration. [VictoriaMetrics](https://victoriametrics.com/blog/go-sync-map/): *"sync.Map isn't some magic replacement for all concurrent map scenarios. Most of the time, you're probably better off sticking with a native Go map, combined with locking."* Medium-high in LLM code. Review only.

**`atomic-mixed-access`** — `atomic.LoadInt64(&x)` in some places, plain `x++` elsewhere; or atomic for compound read-modify-write without CAS loop. Silent tearing. Medium. **Detectable:** `go vet atomicalign`, staticcheck `SA1032`, `-race`.

**`sync-once-misuse`** — new `sync.Once` per call so `Do` always fires; or copying `sync.Once` by value. Medium. **Detectable:** `go vet copylocks`.

**`rwmutex-premature`** — `sync.RWMutex` for balanced writes or tiny critical sections. [golang/go#17973](https://github.com/golang/go/issues/17973): *"the performance of sync.RWMutex.R{Lock,Unlock} degrades dramatically as GOMAXPROCS increases."* **High in LLM "production-grade" suggestions** — models auto-upgrade to RWMutex without justification.

#### 6. Defer and resource cleanup

**`defer-in-loop`** — `for _, f := range files { file, _ := os.Open(f); defer file.Close(); ... }` — all `Close` calls run at function exit, not each iteration. Andrei Boar: *"you run out of file descriptors."* **Very high.** **Detectable:** `gocritic deferInLoop`; `revive defer`.

**`missing-defer-body-close`** — `http.Get(url)` followed by reading body with no `defer resp.Body.Close()`. [Manish Jain](https://manishrjain.com/must-close-golang-http-response): *"you MUST always read the response.Body and close it, irrespective of whether you need it or not."* Breaks keep-alive reuse. **Very high.** **Detectable:** `bodyclose`, `sqlclosecheck`, `rowserrcheck`, `gosec G307`.

**`defer-before-err-check`** — `resp, err := http.Get(...); defer resp.Body.Close(); if err != nil { return err }` — panics with nil dereference if Get errored. Medium. Review / `nilness`.

**`defer-loopvar-capture`** — `for _, x := range xs { defer cleanup(x) }` — pre-1.22 closure captures loop variable plus loop accumulation. Medium.

**`defer-unlock-in-long-fn`** — `mu.Lock(); defer mu.Unlock()` in a long function that does I/O/HTTP while holding the lock. Classic LLM pattern: defer Unlock "because it's safer," ignoring that the mutex now covers a network call. Peter Bourgon frequently flags this. High. Review only.

#### 7. Context misuse

**`background-in-handler`** — `context.Background()` / `context.TODO()` inside an HTTP handler instead of `r.Context()`. Breaks cancellation + deadline propagation; client disconnects don't stop DB queries. Go blog: *"it can be quite dangerous … your process could backlog and exhaust its resources."* **Very high.** **Detectable:** `contextcheck` linter.

**`context-in-struct-field`** — `type Worker struct { ctx context.Context }`. Violates the `context` godoc directive: *"Do not store Contexts inside a struct type; instead, pass a Context explicitly to each function that needs it."* High — LLMs love it for "stateful clients." **Detectable:** `containedctx` linter.

**`ctx-not-first-param`** — `func Fetch(id string, ctx context.Context)` instead of `func Fetch(ctx context.Context, id string)`. Medium. **Detectable:** `revive context-as-argument`.

**`string-key-context-value`** — `context.WithValue(ctx, "userID", id)` with built-in-type key. `context` godoc: *"key … should not be of type string or any other built-in type to avoid collisions between packages using context."* **Very high.** **Detectable:** staticcheck `SA1029`.

**`lost-cancel`** — `ctx, _ := context.WithTimeout(parent, 5*time.Second)` discarding the cancel function; or nested-context-in-loop "fat context." Goroutine/timer leaks. **High** — Claude frequently drops `cancel`. **Detectable:** `go vet lostcancel`; `fatcontext` linter.

**`context-todo-in-prod`** — `context.TODO()` left in non-stub code paths. Medium. Custom `forbidigo` rule.

#### 8. Struct and type slop

**`mixed-receivers`** — same type has both value and pointer receivers. [Go CodeReviewComments](https://go.dev/wiki/CodeReviewComments#receiver-type): *"Don't mix receiver types."* Confuses interface satisfaction. Very high. **Detectable:** `recvcheck`, `revive receiver-naming`.

**`zero-value-broken`** — struct panics or misbehaves with its zero value; consumers must call `NewX()`. Rob Pike: *"Make the zero value useful."* **High — strongest Java-habit smell.** Review-only.

**`stuttering-type-name`** — `user.UserService`, `http.HTTPClient`. Rob Pike: *"A package's name is part of every name it exports."* **Very high (LLM-canonical when scaffolding CRUD).** **Detectable:** staticcheck `ST1003/ST1016`, revive `exported`.

**`new-returns-interface`** — `func NewStore() Store { return &pgStore{} }`. Violates *"Accept interfaces, return structs."* **Very high.** **Detectable:** `ireturn`.

**`missing-wrong-struct-tags`** — JSON/DB/YAML fields unexported where they need exporting, or tags inconsistent (`json:"userId"` next to `json:"user_name"` in same struct). Silent data loss on marshal. High. **Detectable:** `go vet structtag`; `musttag`, `tagalign`, `tagliatelle`.

#### 9. Package organization

**`utils-common-helpers`** — `package utils`, `util`, `common`, `helpers`, `misc`, `shared`, `base`. Dave Cheney: *"its name doesn't reflect its purpose, only its function in breaking the import cycle. [A little] duplication is far cheaper than the wrong abstraction."* **Very high — LLMs trained on enterprise Go produce it reflexively.** Custom `forbidigo` rule.

**`pkg-cargo-cult`** — scaffolding top-level `/pkg` from `golang-standards/project-layout`. Russ Cox: *"the vast majority of packages in the Go ecosystem do not put the importable packages in a pkg subdirectory. … It is unfortunate that this is being put forth as 'golang-standards' when it really is not."* ([golang-standards/project-layout#117](https://github.com/golang-standards/project-layout/issues/117)) Adds indirection with zero enforcement benefit (unlike `internal/`). **Very high — Claude and GPT-4 consistently propose `cmd/ + pkg/ + internal/`.**

**`init-side-effects`** — `func init()` opens DB connections, parses flags, reads env vars. Peter Bourgon: *"the only job of func init is to initialize package global state, so I think it's best understood as a serious red flag in almost any program."* Medium. **Detectable:** `gochecknoinits`, `gochecknoglobals`.

**`one-file-per-struct`** — Java-style `User.go`, `UserService.go`, `UserRepository.go`. Go organizes by package responsibility, not class; `net/http` groups `client.go`, `server.go`, `transport.go`. High — strongest Java signal.

**`deep-package-hierarchy`** — `internal/domain/services/user/commands/handlers/`. Medium; more common in Clean Architecture prompts.

#### 10. Generics slop

**`generic-for-single-caller`** — `func Do[T any](x T)` with only one concrete instantiation. Ian Lance Taylor: *"If you find yourself writing the exact same code multiple times, where the only difference between the copies is that the code uses different types, consider whether you can use a type parameter."* If it's called once, don't parameterize. High in Claude 3.5/Sonnet-4. Review only.

**`generic-where-interface-works`** — `func Write[W io.Writer](w W, p []byte)` instead of `func Write(w io.Writer, p []byte)`. Taylor: *"if the implementation is different for each type, then use an interface type and write different method implementations, don't use a type parameter."* Medium. Pattern learned from Rust.

**`verbose-type-param-names`** — `TKey, TValue, TypeOfThing` instead of `K, V, T`. Stdlib convention violated. Medium. Review / `varnamelen`.

**`over-constrained-param`** — `[T constraints.Ordered]` using the frozen `golang.org/x/exp/constraints` after stdlib moved to `cmp.Ordered` (1.21+); or `Max[T Ordered]` when built-in `max()` (1.21+) works. Medium. Partial: staticcheck `SA1019`; `modernize` minmax analyzer.

**`generic-method-hallucination`** — `func (c *Cache) Get[T any](k string) (T, bool)` — Go doesn't allow methods with their own type params. LLMs hallucinate this from C#/Kotlin. Compile error — but LLM-generated snippets appear in PRs before compilation. Low-medium.

#### 11. Stdlib blindness

**`manual-contains-loop`** — `for _, x := range s { if x == target { return true } }` instead of `slices.Contains` (1.21+). Go blog explicitly called this out in [go fix](https://go.dev/blog/gofix). **Extremely high — the canonical LLM Go slop pattern.** **Detectable:** `modernize slicescontains` analyzer auto-fixes; Go 1.26 `go fix`.

**`manual-keys-values-loop`** — `keys := []K{}; for k := range m { keys = append(keys, k) }` instead of `slices.Sorted(maps.Keys(m))` (1.23+). Very high. **Detectable:** `modernize mapsloop`.

**`ioutil-post-deprecation`** — `ioutil.ReadAll`/`ReadFile`/`TempDir` after Go 1.16 deprecation. High; shows training cutoff. **Detectable:** staticcheck `SA1019`.

**`split-instead-of-cut`** — `parts := strings.SplitN(s, sep, 2); parts[0], parts[1]` instead of `strings.Cut` (1.18+). Index arithmetic + panic risk. Very high. **Detectable:** `modernize stringscut`.

**`sort-slice-over-slices-sort`** — `sort.Slice(s, func(i, j int) bool { return s[i] < s[j] })` instead of `slices.Sort(s)`. Also `sort.Ints`/`sort.Strings` (deprecated). Very high. **Detectable:** `modernize slicessort`; staticcheck `SA1019`.

#### 12. Testing slop

**`table-test-without-subtests`** — table-driven test with `for _, tc := range tests` but no `t.Run(tc.name, ...)`. Loses targeted `-run`, parallelism, clean failures. Dave Cheney: *"As each sub test now has a name we get that name automatically printed out."* High. **Detectable:** `paralleltest`, `tparallel`.

**`fatal-in-goroutine`** — `t.Fatal`/`t.Fatalf` inside goroutines or helper funcs. Silently fails; subsequent assertions crash the test binary. Medium. **Detectable:** `go vet testinggoroutine`; staticcheck `SA2002`.

**`testify-overuse`** — pulling `stretchr/testify` for small project where stdlib `testing` + `cmp.Diff` suffices. Peter Bourgon: *"TDD/BDD packages bring new, unfamiliar DSLs and control structures, increasing the cognitive burden."* **High — testify dominates training corpus.** **Detectable:** `testifylint`; `depguard` to forbid.

**`missing-t-helper`** — test helper functions calling `t.Error`/`t.Fatal` without `t.Helper()`. Failure line numbers point to the helper, not the caller site. High. **Detectable:** `thelper` linter.

**`reflect-deep-equal-over-cmp-diff`** — `reflect.DeepEqual(got, want)` in tests producing failures with no diff. `reflect.DeepEqual` also has surprising semantics (nil map ≠ empty map, NaN ≠ NaN). Medium. Review / `gocritic reflectDeepEqual`.

#### 13. HTTP and server patterns

**`superfluous-writeheader`** — handler calls `http.Error(w, "bad", 400)` then `w.WriteHeader(400)`, producing runtime log *"http: superfluous response.WriteHeader call."* Header silently ignored. High. Runtime log only; no static linter.

**`missing-body-close`** — (covered under defer section 6.2) the single most common LLM footgun in HTTP client code. **Detectable:** `bodyclose`.

**`no-graceful-shutdown`** — `http.ListenAndServe(":8080", mux)` with no `http.Server{}`, no signal handling, no `srv.Shutdown(ctx)`. [Mat Ryer](https://grafana.com/blog/2024/02/09/how-i-write-http-services-in-go-after-13-years/) idiom: wrap with `signal.NotifyContext` + `srv.Shutdown`. High in one-shot toy servers. Review only.

**`no-server-timeouts`** — `http.Server{}` with no `ReadHeaderTimeout`/`ReadTimeout`/`WriteTimeout`/`IdleTimeout`; default is zero = infinite → slowloris. [Cloudflare's guide](https://blog.cloudflare.com/the-complete-guide-to-golang-net-http-timeouts/) is canonical. High. **Detectable:** `gosec G112`.

**`no-return-after-error`** — `if err != nil { http.Error(w, err.Error(), 500) } w.Write(payload)` — writes both error and body. **Very high in Copilot "add error handling" completions.** Custom `ruleguard` / semgrep.

### Cross-cutting themes

**The Go team has officially acknowledged LLM training-corpus lag** in its [go fix blog post](https://go.dev/blog/gofix), describing LLMs that *"refused to use the newer ways even when directed to do so in general terms such as 'always use the latest idioms of Go 1.25.'"* Pinning Go version in a `CLAUDE.md`/`.cursor-rules` with an explicit modernize rule list is the only reliable mitigation.

**r/golang has drawn a moderation line.** The subreddit's 2025 policy explicitly flags "vibe-coded" projects as removable, making Go the first major language community to formalize anti-LLM-slop moderation.

**"Accept interfaces, return structs" is the most-violated Go proverb.** Patterns 2.1, 2.2, 2.4, and 8.4 are all instances of the same root cause: LLMs produce Java/C#-style producer-side interfaces, against explicit Rob Pike and Jack Lindamood guidance. This is NOT fixed by newer models because the pattern looks professional in isolation.

**A practical lint stack catches ~18 of 25+ patterns automatically:** `golangci-lint` with `staticcheck, govet, containedctx, contextcheck, fatcontext, bodyclose, gosec, ireturn, recvcheck, testifylint, thelper, paralleltest, gochecknoinits, forbidigo, depguard, wrapcheck, errorlint` + `go fix` / `modernize` on CI. The residual (zero-value, one-file-per-struct, /pkg cargo cult, generic-for-single-caller, log-and-return, repository-service-mirror) require review or custom `ruleguard`/semgrep rules.

**Frontier-model improvements are uneven.** Claude Sonnet 4/4.5, GPT-5, Gemini 2.5 now reliably use `%w`, `errors.Is`/`errors.As`, `defer resp.Body.Close()`, and loopvar-1.22 semantics. They still regress on interface pollution (2.1, 2.4), RWMutex-by-default (5.5), context cancellation in long-running goroutines (3.2), Forgotten Sender leaks (3.3), defer-in-loop (6.1), and package utils/cargo cult layout (9.1, 9.2).

### Notable sources

- Go team, ["What's in a name? Go 'fix's your code with the help of LLMs"](https://go.dev/blog/gofix) — official acknowledgment of training-corpus lag.
- Dave Cheney, ["Don't just check errors, handle them gracefully"](https://dave.cheney.net/2016/04/27/dont-just-check-errors-handle-them-gracefully) and ["Avoid package names like base, util, or common"](https://dave.cheney.net/2019/01/08/avoid-package-names-like-base-util-or-common) — foundational critiques.
- Jack Lindamood, ["Preemptive Interface Anti-pattern in Go"](https://medium.com/@cep21/preemptive-interface-anti-pattern-in-go-54c18ac0668a) — the canonical "accept interfaces, return structs" article.
- Teiva Harsanyi, [100 Go Mistakes](https://100go.co/), especially [#5 Interface pollution](https://100go.co/5-interface-pollution/).
- Ardan Labs, ["Goroutine Leaks - The Forgotten Sender"](https://www.ardanlabs.com/blog/2018/11/goroutine-leaks-the-forgotten-sender.html) — the single most important leak pattern reference.
- Russ Cox in [golang-standards/project-layout#117](https://github.com/golang-standards/project-layout/issues/117) — the authoritative `/pkg` critique.
- Mat Ryer, ["How I write HTTP services in Go after 13 years"](https://grafana.com/blog/2024/02/09/how-i-write-http-services-in-go-after-13-years/) — HTTP idioms, graceful shutdown.
- Peter Bourgon, ["Go for Industrial Programming"](https://peter.bourgon.org/go-for-industrial-programming/) and ["Go Best Practices 2016"](https://peter.bourgon.org/go-best-practices-2016/).
- [Dominik Honnef's staticcheck documentation](https://staticcheck.dev/docs/checks/) — the authoritative SA-code reference.
- [golangci-lint docs](https://golangci-lint.run/docs/linters/) — the canonical linter aggregator.
- [r/golang AI policy announcement](https://www.clientserver.dev/p/rgolang-draws-a-line-on-ai-generated).

---

## React slop taxonomy

### Executive summary

React slop has one overwhelming center of gravity: **useEffect abuse**. Dan Abramov's informal audit — *"I spot-checked random 128 useEffect calls in the Meta codebase, classified them into several groups, and 59 out of 128 were unnecessary"* — applies at 10× intensity to LLM-generated code. LLMs reach for `useEffect` reflexively for derived state, event responses, data fetching, and prop-to-state synchronization — every one of which has a better alternative in the React 18+/19 idiom set, and every one of which is explicitly documented at [react.dev/learn/you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect). Beyond effects, Nadia Makarevich's *"You can probably remove 90% of all useMemo and useCallbacks in your app right now"* is the defining quote for the **memo cargo cult** — Claude especially wraps primitive-returning expressions in `useMemo`. **Component architecture slop** is the third axis: 500+ line god components from one-shot generators (Bolt, Lovable), provider hell (5+ nested context providers), prop explosion with mutually-exclusive boolean flags, premature extraction into 5 tiny files for "clean architecture" aesthetics. The **Next.js App Router / React Server Components** era added its own failure mode: `"use client"` sprinkled on every file because LLMs trained on the Pages Router don't understand the server-first default — so egregious that Vercel's own [react-best-practices skill](https://vercel.com/blog/introducing-react-best-practices) exists specifically to correct it, and `create-next-app` now ships an `AGENTS.md`. Underneath these sit the classic surface sins: `key={index}`, fetch-in-useEffect without AbortController, `NEXT_PUBLIC_API_KEY` leaks, Tailwind class vomit (300+ char className strings), `getByTestId` over `getByRole`, and `<div onClick>` where `<button>` belongs. Frontier models have slightly improved but the [December 2025 React RSC Shell CVE-2025-55182](https://react.dev/blog) — an unauthenticated CVSS-10.0 RCE in the RSC Flight protocol, actively exploited two days after disclosure — is a sobering reminder that the ecosystem itself is still maturing underneath the slop.

### The taxonomy

#### 1. Hook misuse

**`useeffect-for-derived-state`** — `const [full, setFull] = useState(""); useEffect(() => setFull(first + " " + last), [first, last])`. Abramov: *"If you can calculate [something] during rendering, you don't need an Effect."* Causes a second render with stale intermediate value. **Extremely high — one of the top 2 LLM slop patterns.** **Detectable:** `eslint-plugin-react-you-might-not-need-an-effect` (YMNNAE), `react-doctor/no-derived-state-effect`.

**`useeffect-for-event-response`** — effect body runs logic that should trigger from user interaction (POST on "submitted" flag flipping true). Abramov: *"If this logic is caused by a particular interaction, keep it in the event handler."* Very high. **Detectable:** `YMNNAE/no-event-handler`.

**`stale-closure-deps`** — effect reads reactive value not in dep array, or `[]` used as componentDidMount while body references props/state. The canonical bug class that motivated React 19.2 `useEffectEvent`. **Detectable:** `react-hooks/exhaustive-deps` (autofix).

**`memo-cargo-cult`** — `useMemo`/`useCallback` on primitive-returning expressions; wrapping functions not passed to memoized children; already-stable deps. Makarevich: *"You can probably remove 90% of all useMemo and useCallbacks in your app right now."* **Extremely high — Claude's strongest React tic.** React Compiler (v1.0, October 2025) obsoletes ~95% of these. Detectable only via manual review pre-compiler.

**`usestate-for-derived-value`** — `const [total, setTotal] = useState(items.reduce(...))` where `total` never updates independently. Introduces a second source of truth. High, usually paired with `useeffect-for-derived-state`.

**`useref-as-state`** — `useRef` holding values that affect rendering, updated during render or events, UI reads `ref.current` directly. Breaks reactivity. Moderate; spikes when LLMs iterate to silence `exhaustive-deps` warnings.

**`custom-hook-that-should-be-function`** — `useFormattedPrice(n)` that just returns `n.toFixed(2)` with no hook calls inside. Pays React hook call overhead; misleads readers about side effects. Moderate-high — LLMs name everything `useX`.

**`uselayouteffect-miscalibration`** — `useLayoutEffect` for non-layout work (data fetch, analytics), blocking paint; or `useEffect` for measurement causing flicker. Moderate. Partial: `react-hooks/require-use-layout-effect-ssr-warning`.

**`conditional-hook-call`** — `useState`/`useEffect` inside `if`, loop, or after early `return`. Crashes on toggle. Low (lint catches most) but appears when LLMs refactor. **Detectable:** `react-hooks/rules-of-hooks`.

#### 2. State management

**`redux-for-toggle`** — global store + slice + actions + reducers for `isModalOpen`. Mark Erikson's ["When (and when not) to reach for Redux"](https://blog.isquaredsoftware.com/) is the reference critique. High in enterprise scaffolds. Review only.

**`context-provider-for-one-value`** — Context + Provider + custom hook for a single value consumed one or two levels down. Erikson: [*"Why React Context is Not a 'State Management' Tool."*](https://blog.isquaredsoftware.com/2021/01/context-redux-differences/) Re-renders all consumers. Very high. Review only.

**`provider-hell`** — 5+ nested `<XProvider>`s at root. Each adds subscription cost and a re-render boundary. Very high in Bolt/Lovable full-stack scaffolds. Custom AST rule counting sibling providers.

**`prop-drilling-epic`** — passing a prop through 4+ intermediary components that don't use it, when `children`/slot composition eliminates the drill. Makarevich: *"Wrapping state down and wrapping state around children are the most important tools in your fight against unnecessary re-renders."* High — LLMs think linearly, no composition instinct.

**`lifted-too-high`** — state hoisted to root/app level though only one subtree consumes it. Kent C. Dodds: colocate state as close to where it's used. High.

**`url-state-in-local-state`** — filters/tabs/pagination/search stored in `useState`, not URL. Ryan Florence / Remix team: "URL is the original state manager." Page refresh loses state; no shareable links. **Very high — LLMs default to `useState`.**

**`server-state-in-client-store`** — fetched API data in Redux/Zustand/Context with manual loading/error/stale flags instead of TanStack Query/SWR/RTK Query. Vercel's react-best-practices: *"Use TanStack Query to fetch and mutate data asynchronously instead of useEffect and useCallback."* **Extremely high — probably #1 LLM pattern for data.**

**`useselector-new-object`** — `useSelector(state => ({ a: state.a, b: state.b }))` returns new object each render, bypasses `===`, re-renders always. Moderate. Fix: two separate `useSelector`s, `shallowEqual`, or `createSelector`.

**`zustand-jotai-boilerplate`** — Zustand store for one component's transient state, or Redux-style action/reducer patterns in Zustand. Moderate.

#### 3. Component architecture

**`god-component`** — single file with 10+ `useState`, 5+ `useEffect`, mixed concerns (data + form + modal + rendering). **Very high in LLM full apps (Bolt worst — sometimes entire app in one file).** **Detectable:** line-count + hook-count custom lint.

**`premature-extraction`** — splitting into 5 tiny files before there's a real reuse case — "clean architecture" aesthetic. Abramov ["The WET Codebase"](https://overreacted.io/): abstraction before duplication is worse than duplication. Moderate, spikes under "best practices" prompts.

**`prop-explosion`** — component with 10–30 props, many optional variants. Signals missing composition or discriminated union. High. **Detectable:** custom rule counting prop declarations.

**`boolean-flag-variants`** — `<Alert isError isWarning isInfo isSuccess />` — mutually exclusive booleans that should be an enum/union. Martin Fowler's flag-argument anti-pattern. Enables invalid combinations like `isLoading && isError`. Very high. Custom rule: ≥2 `is*`/`has*` booleans with mutually exclusive semantics.

**`render-prop-where-children-work`** — `<X render={data => <Y data={data} />} />` when children work. Low-moderate; GPT on older training.

**`hoc-where-hook-works`** — `withAuth(Component)`, `withTheme(Component)`, `connect(mapState)(Component)` where `useAuth`, `useTheme` do the job. Erikson's ["Hooks, HOCs, and Tradeoffs"](https://blog.isquaredsoftware.com/) critique. Moderate.

**`wrapper-component-disease`** — `StyledContainer` wrapping `Container` wrapping `Box` wrapping `div` for no behavior reason. DevTools tree 15 levels deep for a button. High in Lovable/Bolt shadcn output.

**`forwardref-cargo-cult`** — wrapping components in `forwardRef` that never receive a ref, or doing so in React 19 where `ref` is a plain prop. [Mudssrali: *"Stop using forwardRef() in your custom components in React."*](https://mudssrali.com/blog/stop-using-forward-ref-in-your-custom-components-in-react) Moderate; Claude/Copilot still emit because training data predates React 19. Lint rule: `forwardRef` whose `ref` arg is unused.

#### 4. Rendering and performance

**`key-is-index`** — `{items.map((x, i) => <Li key={i} />)}` where list can reorder/insert/remove. Comeau: *"React will actually delete the DOM nodes associated with the last item... and will then have to do a bunch of work on all the other DOM nodes."* State leaks across items (form inputs keep old values). **Extremely high.** **Detectable:** `react/no-array-index-key`.

**`key-is-random`** — `key={Math.random()}` or `key={crypto.randomUUID()}` inside `.map()`. New key every render → destroys and remounts every list item → state loss + layout thrash. Often added to silence the "unique key" warning. Moderate (junior/LLM "fix"). Custom rule combining `react/jsx-key` + `Math.random`/`uuid()` detection.

**`inline-object-function-props`** — `<MemoizedChild style={{color:'red'}} onClick={() => x()} />` — new object/function each render defeats `React.memo`. Very high. **Detectable:** `react-perf/jsx-no-new-object-as-prop`, `react-perf/jsx-no-new-function-as-prop`.

**`memo-useless`** — `React.memo(Comp)` where every parent render still changes props (inline objects/functions). The memo is cosmetic. Makarevich: *"If you're not using useMemo and useCallbacks the correct way … they become useless."* Very high.

**`suspense-misplaced`** — `<Suspense>` wrapping entire app or tiny leaf; boundary doesn't match actual async unit → whole screen flashes or fallback never shows. Moderate; rising with RSC.

**`starttransition-forgotten`** — heavy filter/search on every keystroke without `useTransition` / `startTransition`. High underuse. Review / profile only.

**`missing-keys-on-lists`** — `.map()` producing elements with no `key`. Moderate (LLMs usually index-key rather than omit). **Detectable:** `react/jsx-key`.

#### 5. useEffect deep-dive slop

**`useeffect-data-fetching`** — `useEffect(() => { fetch(url).then(setData); }, [url])` with no cancellation, dedup, cache, or race protection. Race conditions + waterfalls. *"Spinning spinner on top of a spinning spinner."* **Extremely high — probably the single most-produced slop by LLMs. Vercel wrote react-best-practices Agent Skills specifically to stop this.** Heuristic rule: `useEffect` containing `fetch`/`axios` + `setState`.

**`useeffect-syncs-props-to-state`** — `useEffect(() => setLocal(propValue), [propValue])` pushing parent props into local state. [Old React blog: *"You Probably Don't Need Derived State."*](https://legacy.reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html) Very high. **Detectable:** `YMNNAE/no-adjust-state-on-prop-change`.

**`useeffect-chains`** — Effect A sets state X; Effect B depends on X, sets Y; Effect C on Y. Cascading commit phases. Abramov: *"Sometimes you might feel tempted to chain Effects that each adjust a piece of state based on other state"* — resolve in one function. High in Bolt/Lovable. **Detectable:** `YMNNAE/no-chain-state-updates`.

**`missing-cleanup`** — `useEffect` subscribes (listener/socket/interval/timeout) without returning cleanup. Memory leaks; StrictMode double-fire surfaces. High.

**`race-without-abort`** — async fetch in effect without `AbortController` or ignore-flag; rapid dep changes → out-of-order `setData`. High. Review only.

**`infinite-loop-object-deps`** — object/array literal in dep array: `useEffect(fn, [{a:1}])`. New reference every render → effect re-runs → infinite loop. Classic LLM fix-loop bug. Moderate. **Detectable:** `react-hooks/exhaustive-deps` warns; custom rule for literal in deps.

**`componentdidmount-mimicry`** — `useEffect(fn, [])` as "run once on mount" while body references props/state. StrictMode surfaces it. Abramov: *"In general, your components should be resilient to being remounted."* **Extremely high.**

#### 6. Next.js App Router slop

**`use-client-everywhere`** — `"use client"` directive sprinkled on every file because LLMs trained on Pages Router don't understand the server-first default. So common that Vercel's discussion [#81291](https://github.com/vercel/next.js/discussions/81291) proposed official `nextjs-best-practices.md` files noting LLMs *"often provide code that is outdated or suboptimal… using the Pages Router instead of App Router, misusing useEffect for data fetching in Server Components."* `create-next-app` now ships `AGENTS.md`. **Very high.** Detectable via grep/custom rule on directive usage density.

**`server-in-client-contamination`** — passing server-only imports (DB client, secrets) through client components by accident. Build-time error in Next.js, but often left unfixed or shimmed incorrectly. High.

**`client-in-server-hooks`** — `useState`/`useEffect` in a file that's a Server Component (no `"use client"`). Next.js build error. High from LLMs that can't tell which side they're generating for.

**`function-as-prop-rsc-error`** — passing functions as props from Server to Client Components. Triggers *"Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with 'use server'."* Multiple dev.to/Medium articles document LLMs reflexively generating this. High.

**`date-map-serialization-error`** — passing `Date`, `Map`, `Set`, class instances from Server to Client. Same serialization boundary. Medium-high.

**`fetch-waterfall-in-rsc`** — improperly nested RSC data fetching producing sequential waterfalls when `Promise.all`/parallel fetches should work. Medium.

**`missing-loading-error-tsx`** — route segments without `loading.tsx`/`error.tsx`. UX regresses silently. High.

**`cookies-headers-wrong-scope`** — `cookies()`/`headers()` called outside a server context, or in client component. Moderate.

**`server-action-misuse`** — `"use server"` on non-exported functions, or passing closures to client. Moderate.

#### 7. Forms and validation

**`controlled-uncontrolled-confusion`** — `<input value={x} />` without `onChange`, triggering React's "changing an uncontrolled input to be controlled" warning. High.

**`validation-everywhere`** — paranoid re-validation on every keystroke in every component. High.

**`form-state-in-context`** — single form's state lifted into Context. Re-renders the entire subtree on each keystroke. Moderate.

**`missing-form-action`** — Next.js 14+ project using `onSubmit` + `fetch` instead of `action={serverAction}`. High.

**`onchange-per-field-boilerplate`** — 10 fields, 10 `useState`s, 10 `onChange` handlers, instead of single object state + `name` attribute or `useReducer`/react-hook-form. Very high.

#### 8. TypeScript + React

**`fc-zombie`** — `React.FC<Props>` with implicit `children` (pre-React 18 assumption). High in models trained pre-2022. Matt Pocock (Total TypeScript) notes `FC` is "now fine" as of TS 5.1 but still recommends annotating props directly. Lint: custom rule on `React.FC`.

**`wrong-event-types`** — `React.MouseEvent` vs `MouseEvent`, `React.ChangeEvent<HTMLInputElement>` typos, wrong generic element type. High.

**`redundant-generic-hooks`** — `useState<string>("")` when inferrable. Medium. Custom rule.

**`as-react-reactnode-cast`** — `as React.ReactNode` / `as any` to paper over type issues. High. Partial: `@typescript-eslint/no-explicit-any`.

**`propswithchildren-abuse`** — `PropsWithChildren<{...}>` on every component whether it takes children or not. Moderate.

**`children-jsx-element-vs-reactnode`** — `children: JSX.Element` instead of `ReactNode` (too narrow — excludes strings, numbers, arrays). Moderate.

#### 9. Styling

**`tailwind-class-vomit`** — `className` strings of 300+ characters with fifteen utilities repeated across four places. From dev.to/avery_code: Copilot *"has no memory… So it inlines everything. Every time. The same combination of fifteen utilities scattered across four different places."* **Very high.** Review / custom rule on className string length.

**`arbitrary-values-everywhere`** — `w-[427px]`, `bg-[#3b82f6]`, `text-[13.5px]` pervasively, often with dynamic template strings that silently fail (Tailwind's JIT compiler only sees static class names). Very high.

**`missing-cn-clsx-helper`** — string-interpolation for conditional classes instead of `cn()`/`clsx`/`tailwind-merge`, producing duplicate/conflicting utilities. High.

**`inline-style-props`** — `style={{ ... }}` pervasively instead of the project's styling system. Medium-high.

**`css-in-js-in-tailwind-project`** — `styled-components` or `emotion` in a project that's already committed to Tailwind. Moderate; LLMs default to whichever pattern they saw first.

**`tailwind-v4-as-v3`** — HN comment: *"people daily asking for help with their broken Tailwind setups, almost always it was them trying to use Tailwind v4 the v3 way because some AI told them so."* Moderate, rising.

#### 10. Testing (React-specific)

**`getbytestid-over-getbyrole`** — default reach for `getByTestId` when Kent C. Dodds's [RTL priority order](https://testing-library.com/docs/queries/about/#priority) is `getByRole > getByLabelText > getByPlaceholderText > getByText > getByDisplayValue > getByAltText > getByTitle > getByTestId` (last resort). Very high. **Detectable:** `testing-library/prefer-explicit-assert`, custom priority rule.

**`fireevent-over-userevent`** — `fireEvent.change`/`fireEvent.click` when test needs full interaction (focus + keydown + input + change). Kent C. Dodds: `userEvent` is the default. High. **Detectable:** `testing-library/prefer-user-event`.

**`shallow-render-in-rtl`** — enzyme-style shallow rendering and instance checks in a React Testing Library project. Moderate; inherited from older training.

**`snapshot-bloat`** — massive unreadable snapshots of entire component trees. High.

**`act-warning-ignored`** — `Warning: An update to X inside a test was not wrapped in act(...)` ignored or suppressed rather than fixed with `waitFor`/`findBy`. High.

**`findby-vs-getby-race`** — using `getBy*` for elements that appear async, causing flaky tests. Correct: `findBy*` or `waitFor`. High.

#### 11. Accessibility

**`div-as-button`** — `<div onClick={...}>` without `role="button"`, `tabIndex="0"`, `onKeyDown` for Enter/Space, `preventDefault`. Native `<button>` gets all of this free. Very high. **Detectable:** `jsx-a11y/no-static-element-interactions`, `jsx-a11y/click-events-have-key-events`.

**`missing-aria-label-icon-button`** — icon-only buttons with no `aria-label`. Very high. **Detectable:** `jsx-a11y/accessible-emoji` adjacent.

**`img-without-alt`** — `<img src={...} />` with no `alt`. High. **Detectable:** `jsx-a11y/alt-text`.

**`onclick-on-div-no-keyboard`** — covered by `div-as-button` in part — the keyboard-handler subset.

**`form-without-labels`** — `<input type="text" placeholder="Name" />` with no `<label>` / `aria-label` / `aria-labelledby`. High. **Detectable:** `jsx-a11y/label-has-associated-control`.

#### 12. Client/server boundary

**`next-public-leak`** — API keys, secrets prefixed `NEXT_PUBLIC_` and shipped to browser bundles. A February 2026 medium.com case: *$82,000 bill after a client-side Google API key was stolen (Google enabled Generative Language API on an existing maps key).* Cyble found 5,000+ GitHub repos and 3,000+ live sites leaking ChatGPT API keys via client-side JS. **Very high — LLMs regularly hardcode keys in client components, misprefix secrets with `NEXT_PUBLIC_`, and commit to `.env` instead of `.env.local`.** Detectable: secret scanning in CI; `next/no-public-env-leak` custom rule.

**`hydration-mismatch`** — `Math.random()`, `Date.now()`, `new Date().toLocaleTimeString()`, `navigator.userAgent`, `typeof window !== 'undefined'` branches directly in JSX. React's hydration-mismatch error explicitly enumerates these five as top causes. Very high. Runtime-detectable.

**`double-fetch`** — RSC fetches server-side, then client component refetches the same data on mount. Waterfall + wasted round trip. High.

**`api-route-when-rsc-would-do`** — using `/api` routes for data that an RSC could fetch directly. High, inherited from Pages Router training.

**`session-in-wrong-layer`** — reading auth/session cookies from client components via API fetch when server-side cookies() would work. Moderate.

### Cross-cutting themes

**useEffect is the single biggest slop concentration in React.** Seven out of ~34 named patterns above are `useEffect` pathologies, and they compose multiplicatively: `useeffect-data-fetching` + `race-without-abort` + `missing-cleanup` + `useeffect-chains` produces code that works in dev, breaks in StrictMode, and leaks in production. Installing `eslint-plugin-react-you-might-not-need-an-effect` + Vercel's [react-best-practices Agent Skills](https://vercel.com/blog/introducing-react-best-practices) catches most at author-time.

**LLM worst-offender ranking (qualitative):** **Bolt** produces the messiest React (god components, provider hell, `key={index}`, spaghetti that "needed a complete rewrite"). **Copilot** and **Cursor** produce the most in-the-wild slop because they're embedded in IDEs at scale, with `useEffect` fetching + Redux boilerplate dominating. **Claude/Claude Code** specialize in `forwardRef` cargo cult + reflexive memoization + derived-state-via-effect. **GPT-4/5** shows HOCs, render props, and `useEffect`-for-events from older training weighting. **v0 (Vercel)** produces the cleanest UI — owner-optimized; **Lovable** is the cleanest for full-stack scaffolds though prone to provider hell and wrapper-component disease with shadcn. Neciu Dan summarizes: *"AI models have a strong predisposition toward useEffect. It's one of the most common patterns in training data, and when in doubt, the model will reach for it the same way a junior developer would."*

**React 19/19.2 partially mitigates.** React Compiler v1.0 (October 2025) obsoletes ~95% of `useMemo`/`useCallback`/`React.memo` — killing `memo-cargo-cult`, `inline-object-function-props`, `memo-useless` in one stroke **when enabled**. `useEffectEvent` (19.2) directly addresses `useeffect-for-event-response`, `stale-closure-deps`, `componentdidmount-mimicry`. `use()` + RSC eliminates `useeffect-data-fetching` on the server side. Makarevich's caveat: the compiler silently bails on rule-breaking components, so non-compliant LLM code gets zero benefit and nobody tells you.

**The RSC ecosystem is still maturing underneath the slop.** [CVE-2025-55182](https://react.dev/blog) ("React2Shell") was an unauthenticated CVSS-10.0 RCE in the RSC Flight protocol, affecting Next.js 14.3.0-canary.77 through 16.x and React 19.x. Active exploitation began December 5, 2025, two days after patches. Follow-ups CVE-2025-55183, 55184, and 67779 disclosed December 11. This is material context for skepticism about LLM-generated Server Component code: the surface area itself is still being hardened, and LLMs trained on pre-CVE RSC patterns will emit them confidently.

### Notable sources

- [Dan Abramov, "You Might Not Need an Effect"](https://react.dev/learn/you-might-not-need-an-effect) — the single most actionable React anti-slop reference. The "59/128 effects unnecessary" spot-check is the defining quote.
- [Nadia Makarevich on useMemo/useCallback](https://www.developerway.com/posts/how-to-use-memo-use-callback) — the "90% removable" thesis and the cascading-render visualization.
- [Mark Erikson, "Why React Context is Not a 'State Management' Tool"](https://blog.isquaredsoftware.com/2021/01/context-redux-differences/) — canonical critique of Context overuse by the Redux maintainer.
- [Josh Comeau on hooks and keys](https://www.joshwcomeau.com/react/the-importance-of-keys/) — the most intuitive explanation of why `key={index}` is broken.
- [Kent C. Dodds / Testing Library priority](https://testing-library.com/docs/queries/about/#priority) — the authoritative query-priority ladder.
- [Vercel, "Introducing React Best Practices"](https://vercel.com/blog/introducing-react-best-practices) — a Vercel-maintained Agent Skills package specifically optimized for LLMs, with prescriptive patterns covering `useEffect` data fetching and `useCallback` overuse.
- Armin Ronacher's [2025–2026 blog series](https://lucumr.pocoo.org/) on agentic coding — senior-engineer perspective on RSC and agent-generated code more broadly (though his focus is Go/TypeScript infrastructure more than React specifically).
- [React 19 Security CVE-2025-55182 disclosure](https://react.dev/blog) and the [Next.js 2025-12-11 security update](https://nextjs.org/blog) — essential ecosystem context.
- [eslint-plugin-react-you-might-not-need-an-effect](https://github.com/nickjvandyke/eslint-plugin-react-you-might-not-need-an-effect) — codifies most of Abramov's rules as lint checks.
- [millionco/react-doctor](https://github.com/millionco/react-doctor) — the broader "React code health" plugin.
- [jsx-a11y plugin](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) — authoritative a11y slop detection.
- Theo Browne's YouTube channel (t3.gg) — extensive video-essay critique of AI-generated React/Next.js.

---

## Summary: building three lint catalogs

Each taxonomy maps directly to a lint-rule catalog:

- **Python catalog**: ~35 patterns, of which roughly 25 are covered by existing ruff rules (UP, PTH, ASYNC, DTZ, BLE, PERF, SIM, RUF, TC, PT, ANN, SLOT, FA categories). The residual 10 (Pydantic v1→v2 drift, log-and-reraise, `pydantic-for-a-dict`, observability decorator stacks, manager-classes, `mock.patch` wrong path) need custom AST rules or LibCST codemods.
- **Go catalog**: ~45 patterns, of which roughly 30 are covered by `golangci-lint` meta-linter (staticcheck, govet, wrapcheck, errorlint, bodyclose, ireturn, recvcheck, contextcheck, fatcontext, testifylint, thelper, paralleltest, gochecknoinits, forbidigo, depguard, gosec, gocritic) plus `go fix` / `modernize`. The residual 15 (repository-service-mirror, log-and-return, zero-value-broken, one-file-per-struct, /pkg cargo cult, generic-for-single-caller, rwmutex-premature, unbounded-go-in-loop, defer-unlock-in-long-fn, no-return-after-error) require ruleguard or semgrep.
- **React catalog**: ~34 patterns, of which roughly 20 are covered by ESLint plugins (react-hooks, react, react-perf, jsx-a11y, testing-library, react-compiler, react-you-might-not-need-an-effect, react-doctor). The residual 14 (provider-hell, god-component, prop-explosion, boolean-flag-variants, server-state-in-client-store, url-state-in-local-state, tailwind-class-vomit, `use client` everywhere, double-fetch, forwardref-cargo-cult) need custom AST rules or heuristic checks.

For Sublime extensions, the priority order is: **(1)** surface the most common patterns inline (Python: `Dict[str, Any]` + `Optional[X]`; Go: naked `err` return + `/pkg` cargo; React: `useEffect` fetch + `key={index}`); **(2)** offer one-click autofix where the underlying tool supports it (ruff --fix, go fix / modernize, react-hooks exhaustive-deps --fix); **(3)** link each inline warning to the primary source (Abramov for useEffect, Cheney for error handling, Ronacher for typing). This turns the catalog from a static document into an in-editor teaching tool that directly addresses the training-corpus-lag root cause.