# Craft Flow

Plan before writing; present the smallest version that solves the stated problem. Craft is the disciplined path for non-trivial work — the shape of the diff is a direct function of the thinking that preceded it.

## Step 1: Restate

State the problem in a single sentence. If you cannot, you do not understand it yet — ask. Name the posture (library / internal module / one-shot script / hot path / glue code / prototype) and the one thing the reader should notice first. The posture determines the bar; the one thing determines the edit.

## Step 2: Sketch the call site

Before writing the implementation, write the call site. What does the caller type? What do they get back? How does failure look from their side? The call site is the contract; the implementation is the servant. A painful call site is a signal the type is wrong, not the implementation.

## Step 3: Inventory existing material

Search the codebase for existing types, modules, conventions, and helpers that cover part of the problem. *Do not invent a new type for an old concept.* If `Order`, `Invoice`, or `RetryPolicy` already exists, use it. The divergence pattern (`UserData` / `UserInfo` / `UserDetails`) starts with skipping this step.

## Step 4: Write the smallest version

The smallest version that actually solves the stated problem. No speculative abstraction. No "in case we need it later." No factory for one implementation. No interface for one caller. If a second caller appears, the abstraction appears with it — not before.

Reach for the boring choice. The boring choice is the one the next maintainer can read without a prompt. Novel patterns demand justification; familiar ones do not.

## Step 5: Run the AI Slop Test

Before presenting the diff, read it as if someone handed it to you. Would you believe an AI wrote it? If yes, fix whatever made you think so — line-narration comments, paranoid try/catch, `utils.ts` spill, ceremony that does not earn its keep, three types for one concept, phantom-assertion tests.

If your test assertions are `toBeDefined` or `toBeTruthy`, the test is decoration. Rewrite.

## Step 6: Present

Present the diff with: the one-sentence restatement, the posture, and the one thing you want the reader to notice. No verbose PR description. The code is the content; the note is the handle. A reviewer reading your summary should know before they open the diff whether it is safe to skim or worth a close read.

### Avoid

- Skipping Step 1 and writing first — "I'll figure the problem out as I go" produces shapeless diffs.
- Designing the implementation before the call site — leads to painful signatures callers must work around.
- Inventing a new type for a concept that already has one — the `UserData`/`UserInfo`/`UserDetails` divergence starts here.
- Speculative abstraction in Step 4 — factories and interfaces for a single caller are reading tax.
- Skipping the AI Slop Test — the diff reads fine to you; to a reviewer it reads like generated code.
- Presenting without a one-sentence restatement — the note is the handle; without it the reviewer has to derive intent from the diff.
