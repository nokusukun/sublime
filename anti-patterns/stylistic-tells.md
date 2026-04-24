# Stylistic tells (the "AI voice")

Surface-level patterns that reveal LLM authorship on first glance. These are the cheapest slop to enforce and the most legible to users as "this code was not written with care." The surface tells fade with model improvements, but they still appear by the hundred in generated code today. Strip them. A professional codebase does not decorate itself.

### Emoji in log messages

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Emoji dropped into log calls to signal status, severity, or celebration.

**Forbidden example.**
```ts
logger.info("[rocket] Starting server on port 3000");
logger.info("[check] Database connected");
logger.error("[x] Failed to connect to upstream");
logger.info("[party] All systems operational");
```

(Substitute the literal emoji glyphs for the bracketed labels — that is the pattern in the wild.)

**Why it hurts.** Emoji in log lines break grep, corrupt log aggregators that expect ASCII, and signal "AI wrote this" on first read. They are decoration pretending to be structure. Log severity already encodes severity; the emoji adds noise, not signal.

**Rewrite.**
```ts
logger.info("server.start", { port });
logger.error("db.connect.failed", { error, attempt });
logger.info("server.ready", { port, pid });
```

**See in `/sublime`:** [`../sublime/SKILL.md#comments--docs`](../sublime/SKILL.md#comments--docs), [`../sublime/SKILL.md#hard-bans`](../sublime/SKILL.md#hard-bans).

---

### INFO-on-every-entry

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Entry and exit log lines scattered through every function at `INFO` level.

**Forbidden example.**
```python
def process_order(order):
    logger.info("Entering process_order")
    logger.info(f"Processing order {order.id}")
    result = validate(order)
    logger.info("Validation complete")
    logger.info("Leaving process_order")
    return result
```

**Why it hurts.** This is `printf`-debugging fossilized into production. It floods log storage, drowns real signals, and tells a reader nothing the call graph would not already tell them. Variant Systems' audit: "every single project had zero error monitoring and zero structured logging." Trace entry/exit with a profiler; log business events, not function calls.

**Rewrite.**
```python
def process_order(order):
    result = validate(order)
    if not result.ok:
        logger.warning("order.validation.failed", order_id=order.id, reason=result.reason)
    return result
```

**See in `/sublime`:** [`../sublime/SKILL.md#errors--failure-modes`](../sublime/SKILL.md#errors--failure-modes), [`../sublime/references/errors.md`](../sublime/references/errors.md).

---

### Verbose bulleted error messages

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Markdown bullets, newlines, and formatting embedded inside thrown error strings.

**Forbidden example.**
```ts
throw new Error(
  "Invalid input:\n" +
  "• Field 'email' is required\n" +
  "• Field 'name' must be a string\n" +
  "• Field 'age' must be positive\n"
);
```

**Why it hurts.** Exception messages are for developers and structured error handlers, not for UI rendering. Bullets in a message string couple the error to one display context and make programmatic inspection impossible — a caller cannot branch on "email is required" without string-parsing. The message becomes a document pretending to be data.

**Rewrite.**
```ts
throw new ValidationError("input", {
  email: "required",
  name: "must be a string",
  age: "must be positive",
});
```

**See in `/sublime`:** [`../sublime/SKILL.md#errors--failure-modes`](../sublime/SKILL.md#errors--failure-modes), [`../sublime/references/errors.md`](../sublime/references/errors.md).

---

### Console.log as observability strategy

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** `console.log` / `print` sprinkled through production code as the only form of observability.

**Forbidden example.**
```ts
export async function charge(userId, amount) {
  console.log("charging user", userId, amount);
  const user = await db.users.findById(userId);
  console.log("user found", user);
  const result = await payments.charge(user, amount);
  console.log("charge result", result);
  return result;
}
```

**Why it hurts.** `console.log` is unstructured, unlevelled, unsearchable, and ships PII to stdout. Variant Systems' audit of Claude Code projects: "every single project had zero error monitoring and zero structured logging." This is Austin's anti-pattern #2. Real observability is structured events, levels, correlation IDs, and a destination — not a trail of breadcrumbs in stdout.

**Rewrite.**
```ts
export async function charge(userId, amount) {
  const user = await db.users.findById(userId);
  const result = await payments.charge(user, amount);
  logger.info("payment.charged", { userId, amount, chargeId: result.id });
  return result;
}
```

**See in `/sublime`:** [`../sublime/SKILL.md#errors--failure-modes`](../sublime/SKILL.md#errors--failure-modes), [`../sublime/references/errors.md`](../sublime/references/errors.md).

---

### Markdown in docstrings

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Bold, bullets, and headers inside Python docstrings or Go doc comments where plain prose is the idiom.

**Forbidden example.**
```python
def fetch_orders(user_id: str) -> list[Order]:
    """
    Fetches orders for a user.

    **Parameters:**
    - `user_id`: The ID of the user

    **Returns:**
    - A **list** of `Order` objects
    """
```

**Why it hurts.** Python docstrings render as plain text in `help()`, REPLs, and most IDE tooltips. Markdown asterisks and backticks show up as literal characters, not formatting. The convention is plain prose with minimal structure; tools like Sphinx have their own directives, not generic markdown. The bold emphasis is model reflex, not communication.

**Rewrite.**
```python
def fetch_orders(user_id: str) -> list[Order]:
    """Return the user's orders, most recent first. Empty list if none."""
```

**See in `/sublime`:** [`../sublime/SKILL.md#comments--docs`](../sublime/SKILL.md#comments--docs), [`../sublime/references/comments.md`](../sublime/references/comments.md).

---

### All-caps ceremony constants

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** `SCREAMING_SNAKE_CASE` constants declared for values used in exactly one place.

**Forbidden example.**
```ts
const DEFAULT_TIMEOUT_IN_MILLISECONDS = 5000;
const MAXIMUM_RETRY_ATTEMPTS = 3;
const USER_AGENT_STRING = "app/1.0";

export async function ping() {
  return fetch("/health", {
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_IN_MILLISECONDS),
  });
}
```

**Why it hurts.** All-caps constants signal "this is tunable global configuration." A value used once, at the file where it lives, is not configuration — it is a literal. The ceremony makes the call site longer, adds a name the reader must resolve, and implies a contract (multiple consumers) that does not exist. Name it when a second caller appears.

**Rewrite.**
```ts
export async function ping() {
  return fetch("/health", { signal: AbortSignal.timeout(5000) });
}
```

**See in `/sublime`:** [`../sublime/SKILL.md#naming`](../sublime/SKILL.md#naming), [`../sublime/references/naming.md`](../sublime/references/naming.md).

---

### Over-capitalized success/error strings

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** `"SUCCESS"`, `"FAILURE"`, `"ERROR"` returned as string status instead of proper types or booleans.

**Forbidden example.**
```ts
function charge(amount: number): { status: string; data?: Charge } {
  try {
    const data = processCharge(amount);
    return { status: "SUCCESS", data };
  } catch (e) {
    return { status: "FAILURE" };
  }
}
```

**Why it hurts.** Stringly-typed status is a typo waiting to ship — `"SUCESS"` compiles. The type says `string`, so every caller must remember the magic values and the compiler cannot help. The shouting caps are model cargo-cult from tutorial code. Use a discriminated union, a boolean, or a thrown error.

**Rewrite.**
```ts
type Result<T> = { ok: true; value: T } | { ok: false; error: ChargeError };

function charge(amount: number): Result<Charge> {
  try {
    return { ok: true, value: processCharge(amount) };
  } catch (error) {
    return { ok: false, error };
  }
}
```

**See in `/sublime`:** [`../sublime/SKILL.md#data--state`](../sublime/SKILL.md#data--state), [`../sublime/references/data-modeling.md`](../sublime/references/data-modeling.md).
