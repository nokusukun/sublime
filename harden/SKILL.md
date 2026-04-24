---
name: harden
description: "Tighten error handling, validation, and failure modes. Audits boundaries (input parsing, network calls), removes swallowed exceptions and fallback-masks-bug patterns, and checks security-sensitive primitives (SQL concatenation, CSRF/CORS, Math.random for tokens, hardcoded secrets). Not a paranoia pass — the output typically has fewer try/catches, not more. Use before shipping to production or after audit."
argument-hint: "[target]"
license: MIT
user-invocable: true
---

## MANDATORY PREPARATION

Invoke `{{command_prefix}}sublime` — it contains the code-craft foundation, the Hard BANs, the AI Slop Test, and the Code Context Gathering Protocol. Every sublime verb leans on it.

Follow the Context Gathering Protocol before proceeding. If no `.sublime.md` exists and no Code Context has been loaded, you MUST run `{{command_prefix}}sublime teach` first and gather context interactively. Do NOT skip this step. Do NOT infer Code Context from the codebase alone — conventions in a codebase are usually load-bearing, and only the author can tell you the invariants.

---

# /harden

Tighten error handling, validation, and failure modes.

## When to use it

Reach for `harden` when the happy path is solid and you now need to close the gaps around it. The intent is honest failure — crash loudly on bugs, recover sensibly on expected failures, validate at boundaries, trust inside. This is not a paranoia pass. The most common mistake is treating `harden` as "add more try/catch"; the correct result usually has *fewer* try/catch blocks than the input, because the defensive ones wrapping unfailable code get removed and the ones that matter get tightened. Run `harden` after the feature works, before it ships, and any time you have touched a boundary where input, network, filesystem, or crypto is in play.

## How it works

1. **Inventory the boundaries.** Every place the code meets something it does not own — network, filesystem, parser input, user input, subprocess, database, clock, environment variable. These are the only places where error handling is a design decision. Everything inside the boundary trusts the parsed value.
2. **Audit swallowed exceptions.** Every `catch` that logs-and-continues, returns `null` on any failure, or silently throws to a global handler gets named. For each, decide: remove, narrow to the specific recoverable error, or propagate with context.
3. **Check fallback-masks-bug.** Every `|| defaultValue` and `?? defaultValue` on a value that should not be absent. These are silent wrongness. Replace with explicit validation at the boundary, or let the absence surface.
4. **Validate input at entry.** Parse, don't check. The parsed value should be typed such that downstream code cannot receive malformed data.
5. **Audit security sensitivities.** SQL injection risk (prepared statements, not string concatenation). CSRF posture on state-changing endpoints. Crypto RNG (`crypto.randomUUID`, not `Math.random`) for tokens, IDs, and secrets. Secrets in logs, errors, and stack traces. Fail closed on auth failures.
6. **Check failure modes that silently wrong-answer.** Swallowed promise rejections. Ignored return codes. Integer overflow on user-supplied sizes. Unbounded retries. Missing timeouts on network calls.

## Try it

Input — an endpoint that fetches a user, catches any error, returns `null`, and generates a session token with `Math.random().toString(36)`:

```ts
export async function login(email, password) {
  try {
    const user = await db.users.findOne({ email });
    if (user.password !== password) return null;
    const token = Math.random().toString(36).slice(2);
    return { user, token };
  } catch (e) {
    return null;
  }
}
```

Expected output — input parsed at boundary, timing-safe password comparison, `crypto.randomUUID()` for the token, specific errors propagated (invalid credentials vs database failure), no blanket catch:

```ts
export async function login(input: unknown): Promise<LoginResult> {
  const { email, password } = LoginInput.parse(input);
  const user = await db.users.findOne({ email });
  if (!user) throw new InvalidCredentials();
  if (!timingSafeEqual(user.passwordHash, hash(password))) throw new InvalidCredentials();
  return { user, token: crypto.randomUUID() };
}
```

The try/catch is gone because it was hiding both bugs and recoverable failures under the same `null`. Callers now get specific errors.

## Pitfalls

- **Adding try/catch instead of removing them.** If your diff grows the number of catch blocks, you are doing paranoia, not hardening. Most of the catches you encounter should come out.
- **Hardening without knowing the failure posture.** "Should this crash or degrade?" is the author's call, not yours. If the context file does not answer it, ask before choosing.
- **Treating `harden` as a style pass.** Hardening changes behavior — error surfaces differently, inputs are rejected that used to slip through. If no behavior changes, you ran `{{command_prefix}}polish` instead.
- **Over-validating internal values.** Parse once at the boundary. Re-validating at every layer is ceremony, not safety.

## SKILL.md

You are operating in `{{command_prefix}}harden` mode. Your job is to tighten error handling, validation, and failure modes on the target code.

**Mission.** Make failure honest. Expected failures surface with enough information for the caller to recover. Bugs crash loudly with a real stack trace. Input is parsed and validated at the boundary; internal code trusts the parsed value. Security-sensitive primitives use the right APIs. The output usually has *fewer* try/catch blocks than the input, not more.

**Method.**
1. Inventory the boundaries: network, filesystem, parser, user input, subprocess, database, clock, env. Error handling happens here; nowhere else.
2. For every existing `catch`: remove it if it wraps unfailable code; narrow it to the specific recoverable error class if it catches too broadly; let it propagate with context if the caller can do something about it. Pass-through catches (log-and-rethrow, bare rethrow, empty) get deleted.
3. For every `||` and `??` on an optional-looking value: ask whether absence is a real case or a bug. Silent fallback on a bug is forbidden — surface the missing value at the boundary.
4. Parse input at entry. Use a schema library appropriate to the stack. Post-parse values are typed; internal code does not re-validate.
5. Security audit: SQL built by parameterized queries only. CSRF protection present on state-changing endpoints. Crypto RNG for tokens, session IDs, and secrets (`crypto.randomUUID`, `crypto.getRandomValues`, `secrets.token_urlsafe`, never `Math.random`). No secrets in logs or error messages. Auth failures fail closed.
6. Failure-mode audit: every network call has a timeout; every retry has a bound; every promise is awaited or explicitly fire-and-forget; every return code is checked.

**Constraints.**
- Do not add try/catch blocks that cannot meaningfully handle the error. The bar is "this caller can recover" — if nobody can, let it crash.
- Do not change the happy path. Harden the edges, not the core.
- Do not introduce defensive optional-chaining on non-nullable types.
- Name every new error class in domain terms — `InvalidCredentials`, not `AuthError1`.
- If the failure posture (crash vs degrade) is not in the context, ask.

**References.**
- Foundation: `../sublime/SKILL.md` — see *Errors & failure modes*, *Data & state*, BAN 2 (empty/pass-through catch), BAN 4 (nullable-as-error-channel), BAN 9 (fallback-masks-bug), BAN 10 (`Math.random` for security).
- `../anti-patterns/over-defensive.md` — the try/catch inventory.
- `../anti-patterns/security-and-correctness.md` — the security checklist.
- `../sublime/references/errors.md` — the full taxonomy and layering rules.

The natural failure mode in this mode is paranoid hardening — wrapping everything, nullable-returning everything, re-validating at every layer. Resist. Real hardening is narrower, louder, and smaller than the input.
