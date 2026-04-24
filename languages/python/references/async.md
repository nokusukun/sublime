# Async patterns

Async is viral — pick a posture, sync or async, and stick with it, because the mixed-colour codebase is the worst of both worlds.

Async Python is a concurrency model, not a performance hack. It lets one thread juggle thousands of network-bound operations by yielding to an event loop whenever a coroutine would block. That works only if every I/O call on the hot path is awaitable — one `requests.get`, one `time.sleep`, one CPU-bound loop stops the loop, and every other coroutine waits. Most AI-generated async code fails here: the signatures are `async def`, the bodies are synchronous, and the concurrency gain is zero. The discipline: decide whether your codebase is async, and if it is, keep the event loop honest.

## When to use async — and when not to

Async earns its keep with **many concurrent network-bound operations** whose latency demands they overlap: 200 URL fetches, 50 fanned-out database queries, 10,000 WebSockets on one process. One thread multiplexes I/O waits; no thread stack per connection.

Wrong tool when:

- Work is **CPU-bound**. Parsing large JSON, compressing bytes, NumPy crunching hold the loop with no yield points. Use a process pool.
- **One request in flight**. A CLI hitting one URL gains nothing and pays coroutine overhead.
- Libraries are **sync only**. If the DB driver, HTTP client, and cache client all block, `async def` is a lie — every call blocks, every request serializes.

The test: can you name two I/O operations per request that could be awaited concurrently? If not, stay sync.

## `asyncio` vs `trio` vs `anyio`

- **`asyncio`** — stdlib; every library targets it first. Task management is primitive pre-3.11, much better with `TaskGroup` and `asyncio.timeout` in 3.11+.
- **`trio`** — structured concurrency from the start; nurseries guarantee child tasks cannot outlive their scope. Smaller ecosystem.
- **`anyio`** — abstraction layer running on either loop, exposing structured-concurrency primitives. Current consensus: **library code** targets `anyio` so callers pick their loop; **application code** targets `asyncio` directly with `TaskGroup`.

Pick one per codebase. Do not mix `asyncio.gather` and `trio.open_nursery`; the event loops are not interchangeable.

## The function-colour problem

`async def` is a different type from `def`. A sync function cannot `await`; async-ness is viral upward — Bob Nystrom's "what colour is your function." Every caller of an async function must be async or drive a loop with `asyncio.run`.

Picking async is a codebase-wide commitment. If entry points are async, every layer to the I/O boundary must be async or wrap a sync call in `asyncio.to_thread`. Do not straddle: a module exporting both sync and async versions of every function maintains two implementations and lies about it — the sync version usually calls `asyncio.run` internally, which breaks the moment a caller is in a loop.

## `asyncio.run` — entry point only

`asyncio.run(main())` creates a new event loop, runs the coroutine, and closes it. Call it exactly once at the top of your program — `if __name__ == "__main__":` or a CLI entry point. Calling it inside an async function raises `RuntimeError: asyncio.run() cannot be called from a running event loop`. Calling it from a library function or request handler is always wrong; the caller's loop is the right loop.

```python
# Right — single entry point
async def main() -> None:
    async with httpx.AsyncClient() as client:
        await run_pipeline(client)

if __name__ == "__main__":
    asyncio.run(main())

# Wrong — nested loop, raises at runtime
async def fetch_and_process(url: str) -> dict:
    data = asyncio.run(fetch(url))   # already inside a loop
    return process(data)
```

## `create_task` lifecycle

`asyncio.create_task(coro())` schedules a coroutine and returns a `Task`. The event loop holds only a weak reference — with no strong reference elsewhere, the GC can drop it mid-flight. CPython docs: *"A task that isn't referenced elsewhere may get garbage collected at any time, even before it's done."*

```python
# Wrong — the task may vanish
asyncio.create_task(background_refresh(cache))

# Right — keep a reference; remove it on completion
_background: set[asyncio.Task] = set()

def spawn_background(coro) -> None:
    task = asyncio.create_task(coro)
    _background.add(task)
    task.add_done_callback(_background.discard)
```

Better: avoid bare `create_task`. Use `TaskGroup`, which guarantees tasks are awaited, cancellation propagates, and exceptions surface to the parent.

## `gather` vs `TaskGroup`

`asyncio.gather(*coros)` runs coroutines concurrently and returns results in order. Sharp edges: one exception propagates but remaining tasks are not always cleaned up promptly, and there is no structured cancellation scope. `return_exceptions=True` hides bugs — every failure becomes a result value the caller must remember to check.

`asyncio.TaskGroup` (3.11+) is the structured replacement:

```python
async def fetch_all(urls: list[str]) -> list[dict]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch(url)) for url in urls]
    # on exit, every task is awaited; any exception becomes an ExceptionGroup
    return [t.result() for t in tasks]
```

On exit, every child is awaited. If any raise, the others are cancelled and the group raises `ExceptionGroup`. No task outlives the scope, none is orphaned, cancellation is deterministic. Reach for `gather` only in pre-3.11 code or when you genuinely want `return_exceptions` and are prepared to branch on each result.

## Timeouts

`asyncio.timeout` (3.11+) is a context manager that cancels the enclosed block after a deadline:

```python
async def fetch_with_deadline(url: str) -> dict:
    async with asyncio.timeout(5):
        return await fetch(url)
```

On expiry it raises `TimeoutError` at the active `await`. `asyncio.wait_for(coro, timeout)` is the older coroutine-wrapping form; prefer the context manager in 3.11+ because it composes with `TaskGroup`.

Every external call needs a timeout. An awaited HTTP call with no timeout blocks the coroutine forever if the server hangs; in a fan-out, one stuck request holds the whole group open. Library defaults are not a substitute — set an explicit timeout at the call site.

## `time.sleep` vs `asyncio.sleep`

`time.sleep(n)` blocks the thread for `n` seconds — inside an event loop, every other coroutine is frozen. `asyncio.sleep(n)` yields to the loop.

```python
# Wrong — the entire event loop is frozen for 1 second
async def retry_with_backoff():
    for attempt in range(5):
        try:
            return await fetch()
        except TransientError:
            time.sleep(2 ** attempt)   # blocks every other task

# Right — yields control during the wait
async def retry_with_backoff():
    for attempt in range(5):
        try:
            return await fetch()
        except TransientError:
            await asyncio.sleep(2 ** attempt)
```

Ruff `ASYNC251` catches `time.sleep` inside `async def`. The broader `ASYNC2xx` family also catches `input()`, `open()`, and `subprocess.run` inside async contexts.

## Bridging to sync — `to_thread`, `run_in_executor`

Sometimes you must call a sync function from async code: a library with no async variant, a CPU-bound computation. Two options:

- `asyncio.to_thread(fn, *args, **kwargs)` — runs `fn` on the default thread pool, returns an awaitable. Sugar for the common case.
- `loop.run_in_executor(executor, fn, *args)` — explicit executor control; use when you need a process pool for CPU work or a bounded pool for back-pressure.

```python
# I/O-bound sync library
rows = await asyncio.to_thread(legacy_sync_query, sql)

# CPU-bound work — use a process pool so the GIL does not serialize
with ProcessPoolExecutor() as pool:
    result = await loop.run_in_executor(pool, heavy_compute, data)
```

Do not wrap every sync call in `to_thread` reflexively — the default pool is bounded, and a fan-out of a thousand `to_thread` calls queues behind the pool size. Reserve it for the specific boundary where an unavoidable sync call must live.

## Primitive table

| Primitive | Blocks event loop | Cancellable | When to use |
|---|---|---|---|
| `await coro` | No | Yes, at the await | Every awaitable call |
| `asyncio.sleep(n)` | No | Yes | Backoff, pacing, yielding |
| `time.sleep(n)` | **Yes — forbidden in async** | No | Sync code only |
| `asyncio.run(main())` | Drives a loop | — | Program entry point only |
| `asyncio.create_task(coro)` | No | Yes | Fire-and-hold background work |
| `asyncio.TaskGroup()` | No | Structured | Fan-out with guaranteed cleanup |
| `asyncio.gather(*coros)` | No | Partial | Pre-3.11 fan-out |
| `asyncio.timeout(n)` | No | Yes | Deadlines on a block |
| `asyncio.to_thread(fn)` | No (offloads) | Limited | Unavoidable sync I/O |
| `loop.run_in_executor(pool, fn)` | No (offloads) | Limited | CPU work on a process pool |
| `requests.get`, `open`, `subprocess.run` in `async def` | **Yes — forbidden** | No | Sync code only |

## Common AI failure modes

- **`time-sleep-in-async`** — `time.sleep(1)` inside `async def`. Blocks the entire loop for the sleep duration; every other coroutine waits. Appears constantly in model-generated retry/backoff loops. Ruff `ASYNC251` (plus `ASYNC250/220/221/222/230/240` for other blocking primitives). Replace with `await asyncio.sleep(n)`.
- **`blocking-http-in-async`** — `requests.get/post` or a synchronous `httpx.Client` inside `async def`. Signature says async; body blocks the thread for the whole round trip. Persists even in frontier models because `requests` is the training-corpus default. Ruff `ASYNC210/211/212`. Use `httpx.AsyncClient`, `aiohttp`, or `asyncio.to_thread(requests.get, url)` if you truly cannot change the call site.
- **`async-everywhere-cargo-cult`** — every function declared `async def` regardless of body. Endemic in FastAPI because training examples are saturated with `async def endpoint(...)`. A handler with a sync ORM body gains nothing and pays coroutine overhead. Ruff `RUF029` flags unused-async. Demote to `def` unless the body awaits.
- **`forgotten-await`** — calling an async function without `await`: `user = fetch_user(id); print(user.name)`. The call returns a coroutine object, not a user; `user.name` raises `AttributeError`, or the coroutine is GC'd with a `RuntimeWarning: coroutine was never awaited` often lost in log noise. Pyright's `reportUnusedCoroutine`, Ruff `RUF029`. Every call to an `async def` must be awaited, scheduled with `create_task`, or handed to `gather`/`TaskGroup`.
- **`orphan-create-task`** — `asyncio.create_task(coro())` with the return value discarded. CPython may GC the task before it finishes. Ruff `RUF006`. Keep a reference (module-level `set` with a done-callback discarding entries) or use `TaskGroup`.
- **`asyncio-run-inside-loop`** — `asyncio.run(coro)` from an already-running loop. Raises `RuntimeError`. Appears in glue code where the model "just called the async version" from a handler that was itself async. Await the coroutine directly.
- **`serial-await-missing-gather`** — independent awaits in sequence with no data dependency: `user = await fetch_user(); orders = await fetch_orders()`. Pays latency serially when it could run in parallel — the single largest wasted-concurrency pattern. Use `TaskGroup` (3.11+) or `gather`.
- **`async-wrapping-sync`** — `async def slugify(s): return s.lower()`. No `await`, no `async for`, no `async with` — a sync function in disguise paying coroutine overhead for nothing. Ruff `RUF029`. Demote to `def`.

### Avoid

- `async def` on functions with no `await`, `async for`, or `async with`.
  — Pays coroutine overhead for no concurrency benefit; Ruff `RUF029` catches it.
- `time.sleep` inside an async function.
  — Blocks the event loop; every other coroutine freezes for the sleep duration.
- `requests.get` or any sync HTTP client inside an async function.
  — Blocks the thread for the whole round trip; use an async client or `asyncio.to_thread`.
- `asyncio.run` called from inside an async function or a library.
  — Raises `RuntimeError` or creates a second loop that deadlocks; reserve it for the program entry point.
- `asyncio.create_task(...)` with the return value discarded.
  — Task can be garbage-collected mid-flight; keep a reference or use `TaskGroup`.
- Calling an `async def` without `await`.
  — Returns a coroutine object, not the result; the work never runs.
- Two independent awaits in series when they could be concurrent.
  — Pays latency serially; use `TaskGroup` or `gather` for fan-out.
- `asyncio.gather(..., return_exceptions=True)` as a silent catch-all.
  — Every failure becomes a result value; callers forget to branch and bugs are hidden.
- External calls with no timeout.
  — A hung server blocks the coroutine forever; in a fan-out it holds the whole group open.
- Mixing `asyncio` and `trio` primitives in the same codebase.
  — The loops are not interchangeable; pick one or use `anyio` to abstract.
- Offering both sync and async versions of every function in a library.
  — Maintains two implementations; the sync wrapper usually breaks when a caller is already in a loop.

→ For codebase-wide concurrency posture and the function-colour decision, see [../SKILL.md](../SKILL.md). For core retry/timeout/backoff discipline, see [../../../sublime/references/errors.md](../../../sublime/references/errors.md). For shared catalog entries on unbounded concurrency and the N+1 / no-pagination / unbounded-fetch family, see [../../../anti-patterns/security-and-correctness.md](../../../anti-patterns/security-and-correctness.md). For Python-specific anti-patterns, see [../anti-patterns.md](../anti-patterns.md). For the sibling exception-handling discipline that async propagation depends on, see [exceptions.md](exceptions.md).
