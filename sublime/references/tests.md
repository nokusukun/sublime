# Tests

A test is a claim about behavior you are willing to have contradicted — anything else is decoration.

The foundation file states the core discipline: test behavior not implementation, assert specifically, one thing per test. This file goes deeper, because the failure mode in tests is not usually laziness — it is *plausible-looking tests that assert nothing*. Coverage climbs, correctness does not, and a week later a bug ships with a green suite.

## Taxonomy

The test-quality surface has six sub-topics, each with a distinct trap:

- **Behavior vs implementation.** What should the test survive, and what should it break on?
- **Assertion quality.** What counts as an assertion and what is only a shape of one.
- **Mock discipline.** What to fake, what to fake badly, what never to fake.
- **Property-based testing.** Where generators earn their keep and where they add noise.
- **Snapshots.** When a frozen output is a claim, and when it is a tautology.
- **Flake budget.** The cost of a test that fails intermittently.

## Behavior vs implementation

A test is a bet on what the function must continue to do. Bet on observable behavior, not on how the function arrives there.

The test should survive:
- Renaming internal helpers.
- Reordering statements whose order does not matter.
- Swapping the implementation for a different algorithm with the same contract.
- Extracting a helper.

The test should fail:
- The output changes.
- A side effect is missing or wrong.
- The function crashes where it previously returned.
- A guarantee the caller depends on is broken.

```pseudocode
// implementation-bound test — breaks every refactor
test("computeDiscount calls applyCouponRule before applyTax", () => {
    spy(applyCouponRule)
    spy(applyTax)
    computeDiscount(order)
    expect(applyCouponRule).toHaveBeenCalledBefore(applyTax)
})

// behavior-bound test — survives any internal refactor
test("computeDiscount: coupon applies before tax for a 10% coupon on a 100 item at 8% tax", () => {
    const total = computeDiscount({ items: [{ price: 100 }], coupon: "TEN", taxRate: 0.08 })
    expect(total).toBe(97.20)
})
```

The first test passes when `computeDiscount` returns the wrong number, as long as the call order is preserved. The second fails the instant the number is wrong and survives any refactor that keeps the contract.

## The phantom-assertion epidemic

This is the dominant failure mode in AI-generated tests. You must learn to recognize it on sight.

A phantom assertion is an assertion that passes when the function returns garbage. `expect(x).toBeDefined()`, `expect(x).toBeTruthy()`, `assert x is not None`, `expect(fn).not.toThrow()` — each of these passes as long as *something*, *anything* happens. The function could return `{}`, `42`, or `"banana"` and the test would still be green.

```pseudocode
// phantom — passes when getUser returns garbage
test("getUser", () => {
    const user = getUser(7)
    expect(user).toBeDefined()
})

// real — proves the contract
test("getUser: returns the record matching the id", () => {
    const user = getUser(7)
    expect(user).toEqual({ id: 7, name: "Ada", role: "admin" })
})
```

How to recognize phantom assertions in a PR:

- The only matcher is `toBeDefined`, `toBeTruthy`, `toBeFalsy`, `not.toBeNull`, `not.toThrow`.
- The test calls the function, catches nothing, and asserts on the existence of the returned value.
- The test covers a "happy path" with no specific values in the expectation.
- The test name is a verb-phrase with no outcome: `"fetches user"`, `"processes order"`, `"calls api"`.

If a test could pass when the function was replaced by `() => ({})`, it is a phantom. Delete it or rewrite it.

## Assertion quality: what to assert on

Assert on the smallest set of facts that proves the behavior. Not fewer, not more.

| You want to prove | Assert on |
|---|---|
| A function returns a specific record | The exact record, or the fields you care about |
| A function produces a list in a specific order | `toEqual` on the array; do not assert length separately |
| A side effect happened | The effect's observable trace (a DB row, an emitted event, a written file) |
| An error fires on bad input | The *type* and *message* or a stable error code — not just that *some* error fired |
| A computation is numerically correct | The exact number, with a tolerance only if floats force it |
| A function is idempotent | Call it twice; assert the second call's effect is the same as the first |

Assertions that betray weakness:
- `expect(result).toBeTruthy()` — phantom.
- `expect(result.length).toBeGreaterThan(0)` — passes for `[undefined]`.
- `expect(() => fn()).not.toThrow()` — phantom.
- `expect(mock).toHaveBeenCalled()` without `toHaveBeenCalledWith(...)` — proves nothing about arguments.
- `expect(result).toMatchObject({})` — matches anything.

## Arrange, act, assert

Three phases, blank line between each.

```pseudocode
test("applyCoupon: 10% coupon reduces total by 10%", () => {
    // arrange
    const order = { items: [{ price: 100 }, { price: 50 }], coupon: "TEN" }

    // act
    const total = applyCoupon(order)

    // assert
    expect(total).toBe(135)
})
```

If the arrange block needs a helper, extract it with a name that says what it builds: `anOrderWith({ coupon: "TEN" })`. Not `setup()`, not `makeTestData()` — a specific description.

If the act block is more than one statement, the test is testing more than one thing. Split it.

## What to mock and what not to mock

Mocking is a scalpel. You are carving out *exactly one* seam in the system: usually the boundary between your code and something you cannot control (network, clock, filesystem, random, time zones).

**Mock:**
- External network calls. Use an HTTP stub, not a full mock framework, where possible.
- The clock. `Date.now()`, `sleep`, `setTimeout`.
- Randomness. Seed an RNG; do not rely on real entropy in tests.
- Expensive fixtures you have already proven correct elsewhere.

**Do not mock:**
- The thing under test. If you mock `computeTotal` in the test for `computeTotal`, the test proves nothing.
- Pure functions under your control. Call them. They are fast.
- Simple value objects. Construct them.
- Anything whose real behavior is what you are claiming works.

**Mock with reluctance:**
- Database. Prefer a real in-memory or containerized database when possible; mocked query builders silently diverge from real SQL.
- Your own services called over the network. If you can, run them; mocks drift from the real contract.

```pseudocode
// mocking the thing under test — the test proves nothing
test("sendWelcome: sends a welcome email", () => {
    const send = mock(sendWelcome)
    send.mockReturnValue({ ok: true })
    const result = sendWelcome(user)   // this does nothing
    expect(result.ok).toBe(true)        // we asserted on our own mock
})

// mock only the boundary
test("sendWelcome: composes the welcome body with the user's first name", () => {
    const mailer = fakeMailer()
    sendWelcome(user, { mailer })
    expect(mailer.sent).toHaveLength(1)
    expect(mailer.sent[0].body).toContain("Hi Ada,")
})
```

## Property-based testing, where it pays

A property test generates hundreds of inputs and asserts that a claim holds across all of them. It pays when:

- The function has a clear mathematical property (associative, idempotent, inverse of another function, round-trip-serializable).
- The input space is large and your hand-picked examples could miss boundary cases.
- You are testing a parser, serializer, or encoder/decoder pair.

```pseudocode
// round-trip property — parse then serialize must equal the original
property("JSON parse/serialize round-trip", anyJson(), (value) => {
    expect(parse(serialize(value))).toEqual(value)
})

// idempotence property
property("normalize is idempotent", anyString(), (s) => {
    expect(normalize(normalize(s))).toBe(normalize(s))
})
```

It does not pay when:
- You do not know the property. "I couldn't think of an example so I used a generator" produces tests that assert nothing specific.
- The function is a CRUD glue layer. Example-based tests are clearer.
- The generator is slower than your example count justifies.

## Snapshot discipline

Snapshots are a claim *frozen*. The claim is only as meaningful as the output it captures. A good snapshot is stable, minimal, and human-readable. A bad snapshot is giant, volatile, and auto-updated whenever it breaks.

Rules:

- **Snapshot data, not markup.** A snapshot of a rendered component's DOM tree breaks on every CSS class rename. A snapshot of the component's computed model (`{ label: "Submit", disabled: true }`) breaks only when behavior changes.
- **Snapshot only the interesting shape.** Serialize a subset. Redact timestamps, UUIDs, and any non-deterministic field.
- **Update snapshots deliberately.** `--updateSnapshot` in CI is a lie detector for reviewer discipline. If the reviewer just runs it without reading the diff, the snapshot is dead weight.
- **Name them like tests.** `welcome-email-for-admin.snap`. Not `snapshot_1.snap`.

Snapshots that should never exist:
- DOM dumps of any component with CSS classes generated by a build tool.
- Full API-response snapshots including timestamps, IDs, and pagination cursors.
- Anything whose "expected" is hundreds of lines and nobody reads the diff.

## Flake budget

A flaky test is worse than no test. A flaky test teaches the team to re-run CI without reading failures; once that habit forms, real failures are re-run too.

Your flake budget is zero. When a test is flaky:

1. Reproduce it. A flake you cannot reproduce is not a flake; it is a bug in the system under test that only sometimes surfaces.
2. Find the source. Common causes: time (`Date.now()`), order (test A leaves state test B sees), parallelism (two tests writing the same temp file), external services (real network in a unit test), unawaited promises.
3. Remove the nondeterminism, not the assertion. Seeding, fixing the time, isolating per-test state — not `retry(3)`.
4. If you cannot remove it, delete the test. A broken smoke alarm is worse than none.

## Common AI failure modes

Your natural failure mode in tests is to generate a lot of them and make them pass. The taxonomy names the specific shapes that produce green suites over broken code:

**Phantom assertion (9.1).** `expect(x).toBeDefined()`, `toBeTruthy()`, `not.toThrow()` as the only assertion. The dominant slop pattern in AI-generated tests. Coverage goes up, correctness does not. The rewrite is always the same: assert on the specific value or side effect.

**Tautological test (9.2).** Asserting `mock.calledWith(x)` where `x` was just passed in literally the previous line. Asserting `1 === 1` after `const x = 1`. The test cannot fail because it re-checks its own inputs.

**Mock-the-thing-under-test (9.3).** Mocking `computeTotal` inside the test file for `computeTotal`. The test proves the mock works. Always mock at the boundary of the unit, never inside it.

**Snapshot-of-meaningless-output (9.4).** Snapshotting a rendered component's DOM tree, or a full API response with timestamps and UUIDs. Breaks on cosmetic change; survives real bugs.

**Impl-named test (9.5).** `test_foo_calls_bar_then_baz` instead of `test_returns_user_when_authenticated`. The name is about internals; the test dies the moment internals change.

**Test duplicates production logic (9.6).** The test reimplements the function to compute the expected value. Two copies of the same bug: the function and the test agree with each other and are both wrong.

**Catch-all test (9.7).** `try { runTest(); } catch (e) { }` so the test always passes. Sometimes phrased as a broad `expect(fn).not.toThrow()` around the whole body.

**Fake-data / lying tests (9.8).** The agent generates synthetic success — mocks, fake logs, hardcoded passing assertions — to report "tests pass." This was the pattern documented in the Replit production-DB incident. If the test file describes a system that does not exist, the test passes and the system still breaks.

## Worked example: finding a phantom test

```pseudocode
// this is the file the model generated
test("createOrder returns a valid order", () => {
    const order = createOrder({ items: [], customer: null })
    expect(order).toBeDefined()
    expect(order.id).toBeTruthy()
})
```

Three failures at once:
- `toBeDefined` is phantom.
- `toBeTruthy` on `order.id` passes for any non-empty string, including `"undefined"`.
- The test passes an empty `items` array and a null `customer` — two conditions that should probably fail, but the test asserts nothing about what *should* happen in those cases.

The rewrite, split into the three claims the file was trying to make:

```pseudocode
test("createOrder: rejects empty items with a domain error", () => {
    expect(() => createOrder({ items: [], customer: someCustomer })).toThrow(EmptyOrderError)
})

test("createOrder: rejects missing customer with a domain error", () => {
    expect(() => createOrder({ items: [anItem], customer: null })).toThrow(MissingCustomerError)
})

test("createOrder: returns an order with a prefixed id for a valid payload", () => {
    const order = createOrder({ items: [anItem], customer: someCustomer })
    expect(order.id).toMatch(/^ord_/)
    expect(order.items).toEqual([anItem])
    expect(order.customer).toBe(someCustomer)
})
```

Three tests, each with a specific assertion, each with a name that reads as a claim about behavior. Any of them fails loudly when the contract breaks.

### Avoid

- Phantom assertion — `toBeDefined`, `toBeTruthy`, `not.toThrow` as the only assertion.
- Tautological test — asserting on values the test itself set one line earlier.
- Mock-the-thing-under-test — faking the unit you are trying to test.
- Snapshot-of-meaningless-output — DOM dumps, API responses with volatile fields.
- Impl-named test — `calls_bar_then_baz` instead of an outcome.
- Test duplicates production logic — reimplementing the function to "verify" the function.
- Catch-all test — swallowing failures in a wrapping `try/catch`.
- Fake-data / lying tests — agent-generated synthetic success.
- Multi-claim test — one test asserting on three unrelated behaviors; split it.
- Flaky test left in the suite — a broken smoke alarm trains the team to ignore real ones.
