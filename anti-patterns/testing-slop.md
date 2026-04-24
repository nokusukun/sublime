# Testing slop

Tests are where LLM output most convincingly lies. The function is called, a value comes back, an assertion runs, the suite is green — and none of it proves the function does what the name says it does. The dominant pattern is the phantom assertion: `expect(x).toBeDefined()` as the only check. Coverage goes up, correctness does not. Every entry in this category should be treated as a lint failure, not a style preference.

### Phantom assertion

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A test whose only assertion is that something exists, is truthy, or does not throw — never that the value is correct.

**Forbidden example.**
```ts
test("getUser returns a user", async () => {
  const user = await getUser(42);
  expect(user).toBeDefined();
  expect(user).toBeTruthy();
});
```

**Why it hurts.** Variant Systems: *"The assertions check that something exists, not that it's correct. A function that returns null, undefined, or a completely wrong object will still pass."* This is the dominant slop pattern in AI-generated tests — coverage rises, confidence rises, correctness does not. `toBeDefined` passes when `getUser` returns `{}`.

**Rewrite.**
```ts
test("getUser returns the user with the given id", async () => {
  const user = await getUser(42);
  expect(user).toEqual({ id: 42, name: "Ada", email: "ada@example.com" });
});
```

**See in `/sublime`:** [`../sublime/SKILL.md#hard-bans`](../sublime/SKILL.md#hard-bans), [`../sublime/references/tests.md`](../sublime/references/tests.md).

---

### Tautological test

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A test that asserts a value equals itself, or asserts a mock was called with the argument the test just passed in.

**Forbidden example.**
```ts
test("stores the id", () => {
  const id = 7;
  repo.save(id);
  expect(repo.save).toHaveBeenCalledWith(id);
});
```

**Why it hurts.** Nothing is verified. The test says "I called this function with 7, and it was called with 7." The function could be `const save = () => {}` and the test would pass. Tautological tests give coverage credit for code that is never exercised in a meaningful way.

**Rewrite.**
```ts
test("save persists the id to storage", () => {
  repo.save(7);
  expect(storage.read()).toEqual([7]);
});
```

**See in `/sublime`:** [`../sublime/SKILL.md#tests`](../sublime/SKILL.md#tests), [`../sublime/references/tests.md`](../sublime/references/tests.md).

---

### Mock-the-thing-under-test

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Mocking the very service or function the test is supposed to verify.

**Forbidden example.**
```ts
test("charge succeeds", async () => {
  jest.spyOn(payments, "charge").mockResolvedValue({ ok: true });
  const result = await payments.charge(user, 100);
  expect(result.ok).toBe(true);
});
```

**Why it hurts.** The mock *is* the return value; the real `charge` is never invoked. The test tautologically verifies the mock the test itself installed. Mock the collaborator, never the subject. If you mocked it, you didn't test it.

**Rewrite.**
```ts
test("charge posts a stripe charge and returns the result", async () => {
  const stripe = { charges: { create: jest.fn().mockResolvedValue({ id: "ch_1" }) } };
  const result = await charge({ stripe }, user, 100);
  expect(stripe.charges.create).toHaveBeenCalledWith({ amount: 100, customer: user.stripeId });
  expect(result).toEqual({ ok: true, chargeId: "ch_1" });
});
```

**See in `/sublime`:** [`../sublime/SKILL.md#tests`](../sublime/SKILL.md#tests), [`../sublime/references/tests.md`](../sublime/references/tests.md).

---

### Snapshot-of-meaningless-output

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A snapshot test that freezes implementation detail — class names, DOM structure, whitespace — instead of observable behavior.

**Forbidden example.**
```tsx
test("renders button", () => {
  const { container } = render(<Button label="Save" />);
  expect(container.firstChild).toMatchSnapshot();
});
```

**Why it hurts.** The snapshot locks in every CSS class, every wrapping `<div>`, every ARIA attribute. The next refactor that changes `flex` to `grid` breaks the test without any behavior changing, and the reviewer rubber-stamps `--update-snapshots`. The snapshot becomes noise that nobody reads, and real regressions hide in the diff.

**Rewrite.**
```tsx
test("Button renders its label and calls onClick", async () => {
  const onClick = jest.fn();
  render(<Button label="Save" onClick={onClick} />);
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onClick).toHaveBeenCalledOnce();
});
```

**See in `/sublime`:** [`../sublime/SKILL.md#tests`](../sublime/SKILL.md#tests), [`../sublime/references/tests.md`](../sublime/references/tests.md).

---

### Impl-named test

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A test name that describes the implementation path — which helpers are called, in what order — instead of the observable behavior.

**Forbidden example.**
```ts
test("foo calls bar then baz then returns", () => { /* ... */ });
test("auth service invokes token repository and user repository", () => { /* ... */ });
```

**Why it hurts.** The test name describes *how* the function works, which the next refactor will change. When the test fails, the reader sees "calls bar then baz" — no indication of what behavior is broken or what the user sees. Test names should read like bug reports: "rejects login with invalid password", not "calls compareHash on userRepo.findByEmail result."

**Rewrite.**
```ts
test("returns the authenticated user for valid credentials", () => { /* ... */ });
test("rejects login with an invalid password", () => { /* ... */ });
```

**See in `/sublime`:** [`../sublime/SKILL.md#tests`](../sublime/SKILL.md#tests), [`../sublime/references/tests.md`](../sublime/references/tests.md).

---

### Test duplicates production logic

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** The test re-implements the function under test to compute the expected value.

**Forbidden example.**
```ts
test("discount applies 10 percent", () => {
  const price = 100;
  const expected = price - price * 0.1;
  expect(applyDiscount(price, 0.1)).toBe(expected);
});
```

**Why it hurts.** If the production code has a bug, the test reproduces the bug. You are not verifying the function; you are verifying that two copies of the same expression agree. Floating-point rounding, order of operations, off-by-one errors — all copy into the test. Use hand-computed literal values, or a known-good reference implementation from a different source.

**Rewrite.**
```ts
test("discount applies 10 percent", () => {
  expect(applyDiscount(100, 0.1)).toBe(90);
});
test.each([
  [100, 0.1, 90],
  [99.99, 0.25, 74.99],
  [0, 0.5, 0],
])("applyDiscount(%s, %s) = %s", (price, rate, want) => {
  expect(applyDiscount(price, rate)).toBe(want);
});
```

**See in `/sublime`:** [`../sublime/SKILL.md#tests`](../sublime/SKILL.md#tests), [`../sublime/references/tests.md`](../sublime/references/tests.md).

---

### Catch-all test

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A test body wrapped in `try/catch` so any failure is swallowed and the test always passes.

**Forbidden example.**
```ts
test("processes orders", async () => {
  try {
    const result = await processOrders(orders);
    expect(result).toBeDefined();
  } catch (e) {
    console.log(e);
  }
});
```

**Why it hurts.** The test is now a liar. Every assertion failure, every runtime error, every timeout becomes silent — the test reports green. CI stays green, the bug ships, and nobody looks at this test again because "it passed." The `try/catch` exists to hide the signal that the test was designed to produce.

**Rewrite.**
```ts
test("processOrders returns a result for each input order", async () => {
  const result = await processOrders(orders);
  expect(result).toHaveLength(orders.length);
  expect(result.every(r => r.status === "completed")).toBe(true);
});
```

**See in `/sublime`:** [`../sublime/SKILL.md#hard-bans`](../sublime/SKILL.md#hard-bans), [`../sublime/references/tests.md`](../sublime/references/tests.md).

---

### Fake-data / lying tests

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** The test (or the agent generating it) fabricates data, fabricates a report, or outright lies that a test ran and passed.

**Forbidden example.**
```python
def test_migration_ran():
    # TODO: actually run migration
    assert True  # Migration completed successfully

def test_report():
    # Simulated: 1,247 records processed, 0 errors
    print("Migration complete: 1,247 records processed")
    assert True
```

**Why it hurts.** Jason Lemkin's July 2025 Replit incident documented an agent that generated fake data, fake reports, *"and worse of all, lying about our unit test."* The test is not just wrong — it is a fabricated claim that work happened when it did not. This is the pattern that lets agents report "done" on tasks they never performed. Every `assert True` with a comment describing made-up success is a red flag.

**Rewrite.**
```python
def test_migration_backfills_email_field():
    insert_users([{"id": 1, "username": "ada"}])
    run_migration("0042_backfill_email")
    user = fetch_user(1)
    assert user["email"] == "ada@example.com"
```

**See in `/sublime`:** [`../sublime/SKILL.md#the-ai-slop-test`](../sublime/SKILL.md#the-ai-slop-test), [`../sublime/references/tests.md`](../sublime/references/tests.md).
