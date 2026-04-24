# Exceptions and EAFP

EAFP is Pythonic; LBYL is not — raise the right exception type, preserve the chain, and never catch `Exception` to "be safe."

Python's exception system is a control-flow feature, not a damage-control one. Most AI-generated exception code inverts that: every expression wrapped in `try`, `Exception` caught at every layer, the error logged, and execution continues as if nothing happened. The result looks defensive and is hollow — every failure is caught, none are handled, and the real bug surfaces three layers downstream as corrupted state. The discipline: pick the narrowest catch you can act on, preserve the cause chain, let everything else travel up to a handler that can do something about it.

## EAFP versus LBYL

**EAFP** — *easier to ask forgiveness than permission* — is the default stance. Try the operation; handle the specific exception if it fails. **LBYL** — *look before you leap* — checks preconditions before acting. Python favours EAFP because it is race-free (state cannot change between the check and the use), faster on the happy path, and the failure carries structured information about what went wrong.

```python
# LBYL — three reads, a race, and a weaker failure mode
if "email" in user and user["email"] and "@" in user["email"]:
    send(user["email"])

# EAFP — one attempt, narrow catch, honest failure
try:
    send(user["email"])
except KeyError:
    raise MissingField("email") from None
```

Use LBYL when the check is cheaper than the attempt (a network call you would skip if a local field is missing), when the operation has side effects hard to undo, or when the precondition is a boolean you can answer without touching the resource. Use EAFP everywhere else — especially dict lookups, attribute access, and integer parsing, where the attempt is trivial and the exception type names the failure.

## Custom exception hierarchies — when

A custom exception class earns its keep when callers across modules branch on it differently. A library exposing `TransientError` and `PermanentError` lets every client implement retry logic without parsing error messages. A script that raises `FooConfigError` in one function and catches it in one place is scaffolding. The test: if two handlers in two different files would both `except MyError`, the class is doing work. If only one call site references it, a built-in exception with a message is enough.

```python
# Good — domain has real branches
class BillingError(Exception): ...
class CardDeclined(BillingError): ...
class InsufficientFunds(BillingError): ...
class NetworkTimeout(BillingError): ...

# Slop — one field, one call site, one handler
class UserNotFoundInDatabaseByEmailError(Exception):
    pass
```

Name the category, not the incident. Inherit from `Exception` (never `BaseException`) and suffix with `Error` — Ruff `N818` flags classes that do not.

## `raise ... from ...`

When you translate one exception into another, the cause chain is the most valuable thing in the traceback. `raise NewError(...) from original` preserves the original as `__cause__` — Python prints *"The above exception was the direct cause of the following exception"* and the reader sees both stacks. A plain `raise NewError(...)` inside `except` chains implicitly via `__context__`, which reads as an accident rather than a translation. `raise NewError(...) from None` suppresses the chain; use it when the original is an implementation detail the caller should not see.

```python
try:
    raw = json.loads(blob)
except json.JSONDecodeError as e:
    raise ConfigParseError(path) from e   # translate, keep cause

try:
    raw = json.loads(blob)
except json.JSONDecodeError:
    raise ConfigParseError(path) from None  # translate, hide cause
```

Ruff `B904` catches the missing `from`. Never write `raise e` by name inside `except ... as e`; it truncates the traceback to the re-raise site. A bare `raise` re-raises without damage.

## `try / except / else / finally`

The four-clause form is underused. The `else` clause is what makes EAFP readable.

- `try` — the expression that might fail.
- `except` — one or more specific handlers.
- `else` — runs only if `try` did not raise; *not* protected by the handlers above.
- `finally` — runs on every exit path, including uncaught exceptions.

```python
try:
    row = cursor.fetchone()
except DatabaseError:
    raise StorageUnavailable() from None
else:
    if row is None:
        raise NotFound(id)
    return User(**row)
finally:
    cursor.close()
```

The `else` clause keeps the non-exceptional path out of the `try` block, so a `NotFound` raised from a clean fetch is not accidentally caught by the `DatabaseError` handler above. Oversized `try` blocks — one of the commonest shapes of bad exception code — silently swallow unrelated failures. Keep `try` surgical: the one expression that can raise the exception you are handling.

## `contextlib` — `suppress`, `contextmanager`, `ExitStack`, `closing`

`contextlib` replaces most of the `try/finally` scaffolding you would otherwise write by hand.

```python
from contextlib import suppress, contextmanager, ExitStack, closing

# suppress — the only legitimate "swallow" shape, because it is explicit
with suppress(FileNotFoundError):
    os.remove(tmp_path)

# contextmanager — turn a setup/teardown pair into a with-block
@contextmanager
def timed(label):
    start = time.monotonic()
    try:
        yield
    finally:
        log.info("%s took %.3fs", label, time.monotonic() - start)

# ExitStack — variadic resource management
with ExitStack() as stack:
    files = [stack.enter_context(open(p)) for p in paths]
    process(files)

# closing — wrap objects with a .close() method that do not implement __exit__
with closing(urllib.request.urlopen(url)) as resp:
    body = resp.read()
```

`suppress` is the one shape where silently ignoring an exception is acceptable — because the suppression is visible code the reader can review. `except FileNotFoundError: pass` is the unreviewable equivalent.

## `BaseException` vs `Exception` vs specific types

`BaseException` is the root. Below it sit `SystemExit`, `KeyboardInterrupt`, `GeneratorExit`, and `Exception`. Catching `BaseException` or a bare `except:` captures Ctrl-C, `sys.exit()`, and the generator shutdown protocol — none of which you want to silence. PEP 760 proposes deprecating the bare form: it *"can make it hard to interrupt the program and can disguise other problems."*

`Exception` is the widest net you should ever cast, and even that is rare. Reach for it only at the top of a worker loop, request handler, or async task, where the alternative is the process dying and the one thing you can do is log with context and re-raise.

```python
# at the top of a request handler — legitimate
try:
    return await handler(request)
except HTTPException:
    raise
except Exception:
    logger.exception("unhandled in %s", handler.__qualname__)
    raise

# inside business logic — almost never legitimate
try:
    total = sum(line.amount for line in invoice.lines)
except Exception:
    total = 0   # the diaper anti-pattern — now the invoice is silently wrong
```

Specific types are the default. `except KeyError`, `except FileNotFoundError`, `except httpx.TimeoutException`. The narrower the catch, the less room for accidentally swallowing a bug.

## `__cause__` vs `__context__`

Every exception carries both. `__cause__` is set when you use `from` — deliberate translation. `__context__` is set implicitly when one exception is raised during handling of another — an accident. `raise X from None` sets `__cause__` to `None` and suppresses the chain.

When debugging: a `__cause__` says the author translated on purpose; a `__context__` says a handler failed while handling another failure. Long chains of `__context__` with no `__cause__` mean your translation discipline is missing.

## `assert` as a precondition check

`assert` is for invariants the program's own logic guarantees — never for validating user input, arguments from untrusted callers, or runtime conditions. Python run with `-O` strips every `assert`; any check that must survive production cannot live inside one.

```python
# Acceptable — invariant that a bug would violate
def split_even(xs: list[int]) -> tuple[list[int], list[int]]:
    assert len(xs) % 2 == 0, "caller contract: even length"
    mid = len(xs) // 2
    return xs[:mid], xs[mid:]

# Wrong — validation that -O will silently delete
def charge(amount: Decimal) -> None:
    assert amount > 0, "amount must be positive"   # gone under -O
    ...

# Right — explicit check that survives optimization
def charge(amount: Decimal) -> None:
    if amount <= 0:
        raise ValueError("amount must be positive")
    ...
```

## Shape table

| Shape | When to use | Principle it enforces |
|---|---|---|
| `try/except SpecificError` | You can act on this failure | Narrow to what you can handle |
| `try/except/else` | Non-exception logic follows | Keep `try` blocks surgical |
| `try/except/finally` | Cleanup on every path | Separate cleanup from handling |
| `raise New(...) from e` | Translating at a boundary | Preserve the cause chain |
| `raise New(...) from None` | Original is internal detail | Hide irrelevant chains |
| `contextlib.suppress(Err)` | Known harmless failure | Make silent handling reviewable |
| `@contextmanager` | Setup/teardown pair | Replace hand-rolled `try/finally` |
| `ExitStack` | Variable resource count | Compose context managers dynamically |
| `except Exception:` at top-level | Last-resort log before re-raise | Never let a worker die silently |
| `assert` | Internal invariants only | Distinguish bugs from expected failures |

## Common AI failure modes

- **`bare-except`** — `try: ... except:` with no type. Catches `BaseException`, swallowing `KeyboardInterrupt` and `SystemExit`; PEP 760 proposes deprecating it. Ruff `E722`, pylint `W0702`. The model reaches for it because "catching everything" feels safe; it is the opposite — you lose Ctrl-C and hide every bug. Replace with the narrowest class you can actually handle.
- **`diaper-anti-pattern`** — `except Exception: pass`, or dressed up as `except Exception: log.error(...)`. Ian Bicking: *"all the information about how it failed is lost."* Ruff `BLE001`, pylint `W0718`. The signature LLM "defensive" tic; code looks handled and is not. If you cannot name the specific failures the catch absorbs, delete it.
- **`lost-traceback-raise`** — `except X as e: raise Y("bad")` with no `from e`. The chain is implicit via `__context__` ("during handling of the above"), which reads as an accident; `raise e` by name truncates the traceback at the re-raise site. Ruff `B904`, `TRY200`. Always write `from e` when translating, or `from None` when the original is internal; never `raise e` by name.
- **`log-and-reraise-duplication`** — `except X: logger.exception(...); raise`. The outer handler logs it again, producing two entries at two sites for one event. Pick one: log or rethrow. If the inner layer has context the outer does not, log a message and re-raise; do not call `logger.exception` twice. Review-only.
- **`exception-class-bloat`** — a fresh `class FooError(Exception): pass` per function, none branched on differently. A catch-all handler ends up with `except (FooError, BarError, BazError):` treating them identically — the hierarchy is decorative. If two handlers in two files will not branch on it, use a built-in with a structured message or consolidate. Ruff `N818` partially helps.

### Avoid

- Bare `except:` anywhere.
  — Catches `KeyboardInterrupt` and `SystemExit`; hides every bug under the sun.
- `except Exception:` inside business logic.
  — Too wide to act on, too vague to log meaningfully; the caller now cannot trust any state the function touched.
- `except Exception: pass` or `except Exception: log.error(...)` with no re-raise.
  — The diaper anti-pattern; all information about the failure is lost and the function returns as if it succeeded.
- `raise Y(...)` inside `except X as e:` with no `from e` or `from None`.
  — The cause chain is implicit via `__context__`, which reads as an accident; Ruff `B904` catches this.
- `raise e` by name to re-raise.
  — Truncates the traceback at the re-raise site; use bare `raise`.
- `except` blocks that log the exception and re-raise.
  — Duplicates log entries; pick one or the other.
- One-field `class FooError(Exception): pass` per function.
  — Decorative hierarchy; no handler branches on it.
- `assert` used to validate user input or runtime data.
  — `-O` strips assertions; the validation disappears in production.
- `try` blocks wrapping more than the one expression that can raise.
  — Handlers catch code they were not meant to guard, silencing unrelated bugs.
- Catching a specific error only to replace it with a generic `Exception("something went wrong")`.
  — Throws away structured information the caller could have branched on.

→ For the layer-of-recovery framing, see [../../../sublime/references/errors.md](../../../sublime/references/errors.md). For inherited BANs — `Bare except:`, `except Exception: pass` — see [../SKILL.md](../SKILL.md) and [../../../sublime/SKILL.md](../../../sublime/SKILL.md). For shared catalog entries on paranoid try/catch and swallowed exceptions, see [../../../anti-patterns/over-defensive.md](../../../anti-patterns/over-defensive.md). For Python-specific anti-patterns, see [../anti-patterns.md](../anti-patterns.md). For typing-side discipline on `Any` and boundary validation, see [typing.md](typing.md).
