# Errors and failure modes

Error handling is a design decision about who recovers from what, at which layer, with what information — not a reflex to wrap every line in `try/catch`.

Most code that looks defensive is noise. A catch that does not change behaviour changes nothing except the stack trace, and it usually makes the real failure harder to see. The work in this dimension is not "adding more error handling" — it is deciding, for each category of failure, which layer can actually do something about it, and putting the handling there and nowhere else.

## A taxonomy of failure

Not all failures are the same. They differ in who can recover, what they mean, and what the right response is. Confusing them is the origin of most bad error code.

| Kind | Caused by | Expected? | Who recovers | Right handling |
|---|---|---|---|---|
| **Validation** | Bad input at a boundary | Yes | The caller (user, API client) | Reject at the boundary with a structured reason |
| **Not-found** | Lookup of a non-existent entity | Yes | The caller, by choosing another action | Return an explicit absence (`None`, `Option`, result variant) |
| **Timeout** | Remote system slow or unreachable | Yes | The system, via retry or degradation | Retry with backoff at the call site; surface after the budget is spent |
| **Contention** | Concurrent write conflict, optimistic-lock failure | Yes | The system, via retry or the caller, via merge | Retry bounded; on exhaustion, surface with enough context to diagnose |
| **Capacity** | Quota, rate limit, queue full | Yes | The system, via backpressure | Shed load, queue, or fail fast with a retry-after signal |
| **Bug** | A case the code did not account for | No | Nobody at runtime — the engineer, later | Let it crash loudly; log and page |
| **Corruption** | Data on disk violates invariants | No | The engineer, manually | Halt the affected operation; do not "heal" silently |

Model the first five in your return types. Let the last two propagate.

The single biggest decision is the line between "expected" and "bug." Expected failures are part of the domain — they have names (`EmailAlreadyInUse`, `InsufficientFunds`, `RateLimited`), they belong in the function's signature, callers branch on them. Bugs are not part of the domain; they are the absence of a plan, and their right response is to be loud enough that someone fixes them.

## Handle at the right layer

A network timeout is a network concern. A business-rule violation is a domain concern. A null pointer is a code concern. The layer that understands the failure is the layer that should handle it.

```
boundary (HTTP, queue, disk)
  ↓  catch transport errors, translate to domain errors, retry where bounded
domain (order placement, pricing, auth)
  ↓  express domain failures as typed results, throw for true bugs
application (controller, CLI command, job handler)
  ↓  turn domain failures into user-facing responses; log bugs, page on them
runtime (top-level handler)
  ↓  last-resort catch that renders a 500, logs context, exits cleanly
```

A symptom of this being wrong: business logic wrapped in `try/catch (NetworkError)`. The business logic does not make network calls. The catch is in the wrong place, and it is catching nothing.

A second symptom: the HTTP layer inspecting the error message to decide whether it was "not found" or "permission denied." Errors should carry structured kinds, not stringly-typed intent. If the HTTP layer needs to distinguish, the domain layer must have made it distinct.

## Result types versus exceptions

Both are legitimate. Neither is universally right.

- **Exceptions** are correct for bugs and for failures that every layer between the raiser and the handler should skip. A NullPointerException should not pass through three levels of catch-and-rewrap; it should travel uninterrupted to the top handler and die with a stack trace.
- **Result types** (`Result<T, E>`, `Either`, sum types) are correct for expected failures where the type system should force the caller to handle both branches. A `chargeCard` function that can fail with `CardDeclined | InsufficientFunds | NetworkTimeout` is lying if its signature says `Promise<Charge>`.

Pick per language and per codebase. In Rust or OCaml, `Result` is the default and exceptions are the exception. In Python and Ruby, exceptions are the default and `Result` is imported. In TypeScript and Go, the answer is contextual — use a result type at boundaries where callers must handle the failure, and exceptions for bugs.

Do not mix them badly. A function that sometimes throws and sometimes returns `null` and sometimes returns a result object is lying to every caller simultaneously. Pick one shape per function and document it in the return type.

## Retries, backoff, jitter

A retry is a claim that the failure is transient. If the failure is permanent, retrying is just rate-limiting yourself.

Three things every retry loop needs:

1. **A ceiling.** Number of attempts, total deadline, or both. Infinite retry is a denial-of-service attack on your own system.
2. **Backoff.** Exponential, not fixed. Fixed-interval retries from many clients synchronize into a thundering herd at the next attempt.
3. **Jitter.** Randomize the delay. Without jitter, every client of a recovering service retries in lockstep and the recovery is fragile.

```pseudo
retry(operation, { maxAttempts = 5, baseMs = 100, capMs = 30_000 }):
  for attempt in 1..maxAttempts:
    result = operation()
    if result is ok: return result
    if not retryable(result.error): return result
    wait_ms = min(capMs, baseMs * 2^(attempt - 1))
    wait_ms = random(wait_ms / 2, wait_ms)  // full jitter
    sleep(wait_ms)
  return result  // exhausted; surface the last error
```

Retry only on errors that could plausibly succeed next time: timeouts, 5xx, connection resets, optimistic-lock failures. Never retry validation errors or 4xx that are not 408/429. A retry on `EmailInvalid` is a tight loop that will never succeed.

Idempotency is load-bearing. If the operation is not idempotent, retrying a timeout can double-charge a card. Either make it idempotent (idempotency keys) or do not retry it.

## Bulkheads and circuit breakers

Two patterns for failures that are not single-call — they are systemic.

- **Bulkheads** isolate failure domains. A slow downstream should not consume every thread, connection, or socket in your pool; allocate bounded resources per dependency so one misbehaving service cannot starve the rest.
- **Circuit breakers** stop trying after a service has demonstrated it is down. After *N* consecutive failures, open the circuit: fast-fail all calls for a cooldown, then let one request through as a probe. Closed → open → half-open → closed.

These are not ornaments. A system without them will respond to a 2-second downstream outage with a 20-minute outage of its own, because every client is blocked on a connection pool waiting for a service that is not coming back.

You probably do not need to write these yourself. The standard library or a well-known package for your language has them. Reach for those first.

## Logging, throwing, swallowing

Three distinct acts, often conflated:

- **Logging** is telling an operator later what happened. It is not error handling. An error that is only logged is an error that was ignored with paperwork.
- **Throwing** propagates a failure to a caller. It is the right answer when the current layer cannot recover.
- **Swallowing** catches the error and continues. It is the right answer only when the failure genuinely does not affect the operation in progress — and that case is rare enough that you should write a comment naming it.

Never log and rethrow in the same place. Pick one. If you log and rethrow, an outer handler will log again and now there are two entries for the same event at two call sites with two stack traces, and the operator has to decide which is real.

The single most common slop pattern in this entire dimension is `catch (e) { console.log(e) }` — logging instead of handling. The function returns as if nothing happened, the caller proceeds with a half-built state, the error is in the logs but not in any alerting pipeline, and the bug surfaces three days later as corrupted data.

## Failure messages that help

An error message is a UI for a future debugger — usually you. Write it like one.

- **Name the failure, not the symptom.** `RefundExceedsOriginalCharge(refund=12.50, original=10.00)` is a failure. `"validation failed"` is paperwork.
- **Include the values that led to the failure.** Not the whole request body — the specific inputs the check examined.
- **Preserve the cause.** When rethrowing, wrap the original error; do not replace it. The original stack trace is the most valuable thing in the log.
- **No markdown, no emoji, no sentence-case declarations.** `throw new Error("🚨 Oops! Something went wrong 😬")` is a generation tell. The error message is a machine-readable field; write it that way.

## Common AI failure modes

Four named patterns from the slop taxonomy dominate AI-written error code:

- **Paranoid try/catch everywhere (1.1).** `try { x + 1 } catch (e) { log(e) }` around code that cannot throw — pure integer arithmetic, a type-narrow property read on a non-nullable value, an already-awaited promise. The catch does not protect against anything; it declares to the reader that the author was nervous. Every such catch is reading tax. Remove them. Your natural failure mode is to wrap whatever you just wrote, "to be safe." It is not safer. It is louder, noisier, and hides the bug you most need to see.
- **Swallowed exception (1.5).** `catch (e) {}` or `catch (e) { console.log(e) }` with no rethrow, no metric, no recovery. The code continues as if the error did not happen; the data the function was supposed to produce is now missing or half-built, and downstream callers will assume success. This is the #1 reported slop tell across every survey. Fix: remove the catch entirely, or catch a specific error you can actually handle and recover from.
- **Redundant existence checks (1.7).** `if (array && array.length > 0) { if (array) { for (const item of array) { if (item) { ... } } } }`. The repetition signals the model is not confident about the shape, so it hedges at every step. The correct response is not more checks; it is to establish the invariant once (at the boundary, with a parser) and then trust it.
- **Stanford insecure-but-confident effect (8.10).** Developers using AI assistance produce less secure code while believing it is more secure. The confidence gap itself is the failure mode. Applied here: a model that wraps every function in a catch is producing code that *looks* handled and is not, and a reviewer skimming for completeness can miss the hollowness. The antidote is to name each failure explicitly, decide who recovers, and write the minimum handling — if you cannot name the failure a catch is guarding against, delete the catch.

### Avoid

- **Empty catch** — `catch (e) {}` as load-bearing control flow.
- **Log-and-continue** — logging an error and proceeding as if it did not happen.
- **Log-and-rethrow** — double-recording the same event at two sites.
- **Nullable-as-error-channel** — returning `null` to mean "something broke."
- **Try/catch around deterministic in-memory code** — it cannot fail in ways you can handle.
- **Optional-chaining paranoia** — `x?.y?.z?.()` on values the type says are non-null.
- **Retry without backoff or jitter** — a thundering herd at the next tick.
- **Retry on non-idempotent operations** — double-charging a card on a timeout.
- **Retry on permanent failures** — a validation error will not succeed next time.
- **Generic catch at the wrong layer** — the HTTP layer catching a domain error it cannot interpret.
- **Stringly-typed error kinds** — parsing `err.message` to decide what to do.
- **Error messages with emoji, markdown, or apology** — an error is a structured field, not a greeting.
