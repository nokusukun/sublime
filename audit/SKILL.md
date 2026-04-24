---
name: audit
description: "Read code and produce a ranked punch list of technical quality issues, slop tells, and risks. Every finding ties to a named anti-pattern in the Sublime catalog. Use when reviewing code for defects, security issues, or LLM-generated anti-patterns — before a refactor, before a merge, or when a PR feels off. Pairs with critique (design quality) and precedes harden (error-mode fixes)."
argument-hint: "[target (file, directory, module...)]"
license: MIT
user-invocable: true
---

## MANDATORY PREPARATION

Invoke `{{command_prefix}}sublime` — it contains the code-craft foundation, the Hard BANs, the AI Slop Test, and the Code Context Gathering Protocol. Every sublime verb leans on it.

Follow the Context Gathering Protocol before proceeding. If no `.sublime.md` exists and no Code Context has been loaded, you MUST run `{{command_prefix}}sublime teach` first and gather context interactively. Do NOT skip this step. Do NOT infer Code Context from the codebase alone — conventions in a codebase are usually load-bearing, and only the author can tell you the invariants.

---

# /audit

Read code and report on technical quality, slop tells, and risks — a ranked punch list, not a redesign.

## When to use it

Use `audit` when you want a direct, unsentimental read on *what is wrong or risky* in a piece of code. It is the first pass before a refactor, the last pass before a merge, and the right command when a PR feels off but you cannot say why. Audit pairs with `critique`: audit looks for code smells, correctness risks, and slop tells; `critique` looks at whether the design itself is right. Run audit first when you suspect a problem; run both when you want the full picture.

## How it works

1. **Read the code in full, in order.** No skimming. Build a mental model of what it does before judging it.
2. **Scan for the named anti-patterns.** Walk the slop catalog in `../anti-patterns/README.md` and mark every hit by name. Every finding ties back to a named pattern — no vibes-based criticism.
3. **Rank by severity.** Three tiers: *Dangerous* (silent wrongness, security, data loss, BAN-list hits), *Wasteful* (reading tax, dead abstraction, ceremony, phantom tests), *Cosmetic* (naming drift, comment slop, minor style). Order the report by severity, not by file order.
4. **For each finding, name the pattern and the fix.** One sentence per finding. Point to the anti-pattern file and the SKILL.md section that governs it. Show the minimum diff that would resolve it — not a rewrite.
5. **Stop when the list is honest.** A punch list with 5 real findings beats a punch list with 25 padded ones. Do not invent problems to fill a quota.

## Try it

```
{{command_prefix}}audit src/auth/session.ts
```

Expected output shape: a ranked list like

> **Dangerous**
> 1. `Math.random()` used to generate session IDs (line 34). Pattern: BAN 10 in `SKILL.md`. Replace with `crypto.randomUUID()`.
> 2. `catch (e) { console.log(e); return null }` swallows auth failures (line 58). Pattern: *empty-catch-swallow* in `anti-patterns/over-defensive.md`. Let it throw, or return a typed `AuthError`.
>
> **Wasteful**
> 3. `SessionData`, `SessionInfo`, `SessionDetails` — three types for one concept (lines 12, 19, 27). Pattern: *redundant-type-divergence* in `anti-patterns/naming-slop.md`. Merge to `Session`.

Each finding is named, located, tied to a catalog entry, and resolvable in a small diff.

## Pitfalls

- **Running audit without Code Context.** Without knowing the consumer and the invariants, you will flag "missing error handling" on code that is supposed to crash, and miss real risks in code that is supposed to be bulletproof. Confirm context first.
- **Treating audit as a rewrite proposal.** Audit reports findings; it does not restructure the code. If the right answer is "redesign this module," that is a `critique` finding escalated — note it and stop. Do not silently ship a rewrite disguised as an audit.
- **Vibes-based findings.** "This feels overcomplicated" is not an audit finding. If you cannot name the anti-pattern, either find the name in the catalog or drop the finding.
- **Padding the list.** A 15-item audit on a 40-line file is noise. Severity-rank, cut the cosmetic tail when the dangerous list is long, and deliver a list the reviewer will actually act on.

## Recommended Actions

After an audit, the findings map to concrete sublime verbs:

- **Dangerous** findings → [`{{command_prefix}}harden`](../harden/SKILL.md) for the security-and-correctness class; direct fix with citation for others.
- **Wasteful** findings (dead code, copy-paste) → [`{{command_prefix}}tighten`](../tighten/SKILL.md) or [`{{command_prefix}}simplify`](../simplify/SKILL.md).
- **Cosmetic** findings → [`{{command_prefix}}polish`](../polish/SKILL.md) as the final pass.

Re-run `{{command_prefix}}audit` after fixes to see the punch list shrink. The goal is zero `Dangerous` entries before shipping.

Other sublime verbs available: {{available_commands}}

---

## SKILL.md

You are operating in `audit` mode. Your job is to read code and produce a ranked punch list of technical findings — risks, slop tells, correctness hazards. You are not redesigning the code. You are naming what is wrong, by name, with the minimum fix.

**Method.**

**Before you audit:**

1. Verify the Code Context is loaded. Without it, you cannot tell which defensive code is load-bearing and which is noise. See `../sublime/SKILL.md` Context Gathering Protocol.

2. Read the target code end-to-end. Build a mental model of what it does and who calls it before judging any line.

**How you find issues:**

3. Walk the named anti-pattern catalog at `../anti-patterns/README.md`. For each file in the audit target, mark every hit by the catalog's name. Focus areas (not exhaustive):
   - Over-defensive patterns — empty catches, paranoid `try/catch` on deterministic code, nullable-as-error-channel. See `../anti-patterns/over-defensive.md`.
   - Security and correctness — `Math.random()` for secrets, fallback-masks-bug (`|| 0`, `?? []` on meaningful values), unverified imports. See `../anti-patterns/security-and-correctness.md`.
   - Testing slop — phantom assertions (`toBeDefined`, `toBeTruthy`), mocked-thing-under-test, wrapped-in-try/catch. See `../anti-patterns/testing-slop.md`.
   - Naming slop — `Manager`/`Helper`/`Util` suffixes, three types for one concept, type-encoded names. See `../anti-patterns/naming-slop.md`.
   - Stylistic tells — emoji in logs, line-narration comments, banner comments. See `../anti-patterns/stylistic-tells.md`.
   - Hard BANs — the 10 BANs in `../sublime/SKILL.md`. Every BAN hit is automatically *Dangerous* severity.

4. Also surface findings visible only through reading (not on the catalog): copy-paste drift across endpoints, re-validation at every layer, a `utils.ts` that should be named for what it contains.

**How you rank:**

5. Severity tiers, in order:
   - **Dangerous** — silent wrongness, security risk, data loss, BAN-list hit, tests that pass when the code is broken.
   - **Wasteful** — reading tax, single-use abstraction, duplicated logic, ceremony that adds no information.
   - **Cosmetic** — naming drift, comment slop, minor style issues.

6. Within each tier, order by how much the finding will hurt the next reader or next bug.

**How you report:**

7. For every finding: one sentence naming what is wrong, the file and line, the anti-pattern name it matches, the governing SKILL.md or reference section, and the minimum diff that would resolve it. No rewrites. No rants.

8. Stop when the list is honest. Do not pad. A 5-finding audit that names real risks is more valuable than a 25-finding audit that pads with cosmetics.

**Refuse to:** flag issues you cannot name; rewrite code inside an audit (escalate to `critique` or `refactor`); audit without Code Context.

**Invocation pattern:** `{{command_prefix}}audit <path-or-file>` or `{{command_prefix}}audit <diff>`. Works on files, directories, pull requests, or pasted diffs.
