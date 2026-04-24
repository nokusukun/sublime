# Review burden

These patterns are not code smells you can grep for in a single file. They are the systemic artifacts of LLM-assisted work at scale — the pile of PRs a maintainer now has to triage, the comprehension gap between how much code exists and how much any human understands, the dead code that accumulates because the model worked around what it could not read, and the pull request description that restates the diff in narrative form. They are diagnosed by pattern across files, commits, and contributor behavior. The fix is a posture shift: generate less, justify more, and prefer the change that is small enough to land.

### Comprehension debt

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** The gap between how much code exists in a system and how much any human actually understands continues to widen with each agent-assisted change.

**Forbidden example.**
```
$ git log --since="3 months ago" --oneline | wc -l
   412
$ git log --since="3 months ago" --author="<any human>" | grep -c "^commit"
   0
# every commit authored by an agent, reviewed by the same agent, merged by a human who skimmed it.
```

**Why it hurts.** Addy Osmani names this directly: *"The growing gap between how much code exists in your system and how much of it any human being genuinely understands… breeds false confidence."* Twei's framing is the same: throughput went up, understanding went down, and the first real incident will surface what nobody on the team remembers writing. The repo is large and nobody knows how it works.

**Rewrite.**
```
# land smaller changes, write why-comments at non-obvious decisions,
# require a human to restate the change in their own words before merge,
# refuse "looks good" reviews on code no reviewer would have written.
```

**See in `/sublime`:** [../sublime/SKILL.md#the-ai-slop-test](../sublime/SKILL.md#the-ai-slop-test), [../sublime/SKILL.md#comments--docs](../sublime/SKILL.md#comments--docs).

---

### Dead-code accumulation

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Old implementations linger alongside new ones because the agent added a replacement without removing what it replaced.

**Forbidden example.**
```diff
+ export function formatDate(d: Date) {
+   return new Intl.DateTimeFormat("en-US").format(d);
+ }
+
  export function formatDateLegacy(d: Date) {
    return d.toLocaleDateString("en-US");
  }
  // still imported in 4 files; no migration performed
```

**Why it hurts.** Osmani: *"Old implementations linger. Comments get removed as side effects. Code they don't fully understand gets altered anyway because it was adjacent to the task."* Every dead path is a bug-hunting distraction, a refactoring hazard, and a false signal to the next model that runs over the repo. The new code passed review; the deletion never happened.

**Rewrite.**
```diff
- export function formatDateLegacy(d: Date) { ... }
+ export function formatDate(d: Date) { ... }
# migrate call sites in the same PR. Do not ship the replacement without the deletion.
```

**See in `/sublime`:** [../sublime/SKILL.md#control-flow--structure](../sublime/SKILL.md#control-flow--structure), [../sublime/references/control-flow.md](../sublime/references/control-flow.md).

---

### Convergence cliff

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** The codebase has reached a size and complexity where fixing one bug reliably introduces another and no agent can pull out of the spiral.

**Forbidden example.**
```
$ claude fix "login regression"
# 14 files touched. auth works; profile page now 500s.
$ claude fix "profile 500"
# 9 files touched. profile works; search is broken.
$ claude fix "search broken"
# 22 files touched. search works; login regression is back.
```

**Why it hurts.** The community-coined term for this is the *convergence cliff*: *"once an AI-generated codebase reaches a certain size and complexity, it enters a state where 'fixing one bug causes another.' No agent — Claude Code, Codex, Gemini, whatever — can salvage it."* The codebase is past the point where iteration converges. At this stage the work is architectural, not incremental. You cannot prompt your way out.

**Rewrite.**
```
# stop iterating. identify the load-bearing invariants the code has lost,
# rewrite the smallest module that restores them, and gate further agent work
# on tests that encode those invariants as executable checks.
```

**See in `/sublime`:** [../sublime/SKILL.md#the-ai-slop-test](../sublime/SKILL.md#the-ai-slop-test).

---

### PR-slop / verbose-LLM-description

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A pull-request description that restates the diff in narrative form, adds checklists, emojis, and "Summary of Changes" sections for a two-line fix.

**Forbidden example.**
```markdown
## Summary of Changes
In this pull request, we have made several important changes to improve
the robustness and clarity of the authentication module.

## Detailed Changes
- Modified `auth.ts` to include additional null checks
- Added a defensive try/catch around the token parser
- Updated the error message to be more descriptive
- Ensured backward compatibility by...

## Testing
I have thoroughly tested these changes locally and verified that...

## Checklist
- [x] Code compiles
- [x] Tests pass
- [x] Documentation updated
```

**Why it hurts.** Samuel Colvin (Pydantic) heuristic: *"flagging PRs where the description was too long. LLMs have this weird insistence on telling you everything they did even though the code is right there."* Verschelde (Godot): *"descriptions are extremely verbose, users don't understand their own changes."* The description is narration of the diff, not justification for it. The reviewer has to read everything twice.

**Rewrite.**
```markdown
Parser threw on expired tokens instead of returning `TokenExpired`.
Callers were treating the crash as `InvalidToken` and logging users out.
Fix: return the typed error. Test added for the expired-token path.
```

**See in `/sublime`:** [../sublime/SKILL.md#comments--docs](../sublime/SKILL.md#comments--docs), [../sublime/references/comments.md](../sublime/references/comments.md).

---

### Drive-by one-shot PR

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** An agent generates a "fix this issue" PR against a project the author has never used, ignores the contribution template, and disappears after submission.

**Forbidden example.**
```
Title: Fix #4821
Body: (empty)
Diff: 340 lines across 17 files. Tests not run. CLA not signed.
Author history on this repo: 0 prior commits, 0 prior issues.
Response to review comments: none.
```

**Why it hurts.** Steve Ruiz (tldraw): *"obvious 'fix this issue' one-shots by an author using AI coding tools… Authors almost always ignored our PR template."* The maintainer spends an hour understanding a change the author spent 60 seconds generating, and the author is not there to answer questions. This is the generation-review asymmetry at its worst. Maintainers are shipping "disable PRs entirely" settings in response.

**Rewrite.**
```
# before opening a PR, read CONTRIBUTING.md, run the test suite,
# fill the PR template, and stay online to answer review comments.
# if you cannot do those things, do not open the PR.
```

**See in `/sublime`:** [../sublime/SKILL.md#the-ai-slop-test](../sublime/SKILL.md#the-ai-slop-test).

---

### Resume-padding / green-square farming

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Drive-by agent-generated PRs submitted across many popular projects to inflate a contribution graph or resume credential.

**Forbidden example.**
```
# same contributor, one week:
PR #812 to project-a: "Fix typo in README"       (agent-generated)
PR #311 to project-b: "Update deprecated method" (agent-generated, wrong API)
PR #4409 to project-c: "Refactor for clarity"    (agent-generated, no discussion)
PR #77 to project-d: "Add missing null check"    (agent-generated, masks bug)
# 147 PRs this month across projects the contributor has no history in.
```

**Why it hurts.** The contributions are optimized for the graph, not the projects. Maintainers absorb the review cost; the contributor collects the signal. When every one of the PRs needs to be rejected for wrong API use or masked bugs, the project has paid for nothing. Seth Larson and Daniel Stenberg have both documented the maintainer-burnout end state.

**Rewrite.**
```
# contribute to a project you actually use. open one issue, discuss it,
# then submit a PR that references the discussion. a single shipped fix
# is worth more than fifty rejected drive-bys.
```

**See in `/sublime`:** [../sublime/SKILL.md#the-ai-slop-test](../sublime/SKILL.md#the-ai-slop-test).

---

### AI-review-noise

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** An AI reviewer leaves dozens of comments that relitigate settled team conventions, flag non-issues, and bury real review feedback under noise.

**Forbidden example.**
```
AI Reviewer: 187 comments on PR #902

#1  Consider using async/await instead of .then() chains
#2  Consider using async/await instead of .then() chains
#3  Consider using async/await instead of .then() chains
  (team standardized on .then chains two years ago; documented in STYLE.md)
#4  This variable could be `const` instead of `let`
  (it is reassigned on line 41)
#5  Missing JSDoc comment
  (internal helper; team policy is no JSDoc on non-exported functions)
... 182 more.
```

**Why it hurts.** CodeAnt case study: *"The AI reviewer left 187 comments. Twelve flag the same async/await pattern your team standardized two years ago. The engineer spends 90 minutes triaging AI feedback before reviewing a single line of logic."* The bot cannot read the codebase's conventions, so it surfaces its priors. The signal-to-noise ratio collapses and humans learn to ignore the reviewer entirely — including its occasional real catches.

**Rewrite.**
```
# configure the reviewer against the project's actual conventions.
# collapse duplicate comments. threshold on severity.
# require the bot to cite a rule from CONTRIBUTING before flagging style.
```

**See in `/sublime`:** [../sublime/SKILL.md#the-ai-slop-test](../sublime/SKILL.md#the-ai-slop-test).

---

### Slop-loop addiction

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** Run many agents in parallel with no quality control, then use more agents to generate documentation that tries to regain confidence about what the first agents did.

**Forbidden example.**
```
# 8 agents running in parallel on one repo.
# each opens 3-6 PRs per hour.
# a 9th agent writes "architecture decision records" summarizing the diffs.
# a 10th agent writes release notes from the ADRs.
# no human has read any of it end to end.
```

**Why it hurts.** Armin Ronacher (*Agent Psychosis*): *"There appears to be some competition in place to run as many of these agents in parallel with almost no quality control in some circles. And to then use agents to try to create documentation artifacts to regain some confidence of what is actually going on. Except those documents themselves read like slop."* The documentation is generated from the code the documentation is supposed to audit. There is no external check anywhere in the loop.

**Rewrite.**
```
# cap concurrent agents. require a human to review every merged PR.
# write ADRs before the code, not after. if nobody on the team can
# restate a change in their own words, do not merge it.
```

**See in `/sublime`:** [../sublime/SKILL.md#the-ai-slop-test](../sublime/SKILL.md#the-ai-slop-test).
