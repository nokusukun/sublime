# NOTICE

## Attribution

Sublime is licensed under the MIT License (see [LICENSE](LICENSE)).

This project is a code-craft adaptation of design-craft ideas. Its structure, voice, and most distinctive conventions — the **Context Gathering Protocol**, the **anti-attractor procedures**, the **BAN block shape**, the **AI Slop Test**, the **sub-mode argument dispatch**, the **semantic-tag wrapping of principles and rules**, and the reference-file format — are all adapted from:

- **[impeccable](https://impeccable.style)** by **Paul Bakaus** ([`pbakaus/impeccable`](https://github.com/pbakaus/impeccable), Apache-2.0). Impeccable is, in turn, an upgrade of Anthropic's original [`frontend-design`](https://github.com/anthropics/skills) skill.
- **[Anthropic frontend-design skill](https://github.com/anthropics/skills)** — the foundation shape Impeccable extended.

We do not redistribute Impeccable or frontend-design code. We re-use the *shape* of those projects — the architectural move of building one deep foundation skill plus a library of verb commands plus a named anti-pattern catalog — and translate it from design craft to code craft. Every dimension, every BAN, every anti-pattern in Sublime is original to this project; the structural vocabulary comes from Impeccable.

## Research attribution

The **anti-pattern taxonomy** at [anti-patterns/](anti-patterns/) is synthesized from the engineering community's published work on LLM-generated code failure modes. Source attribution lives inline inside the taxonomy research document ([llm-slop-taxonomy.md](llm-slop-taxonomy.md)) — developer quotes are attributed to named authors where available.

Key sources whose work shaped specific patterns:

- **Simon Willison** — vibe-coding vs vibe-engineering distinction.
- **Addy Osmani** — comprehension-debt framing; generation-review asymmetry.
- **Armin Ronacher** — agentic-coding failure-mode taxonomy; "Agent Psychosis" essay.
- **Dr. Derek Austin** — the top-5 AI anti-pattern ranking (over-commenting, console.log sprawl, over-defensive error handling, gratuitous abstraction, tutorial-style scaffolding).
- **Variant Systems** — the "10 Anti-Patterns Hiding in Every AI-Generated Codebase" audit.
- **Muhammad Sohail** — reviewer-scale "tells" list.
- **Daniel Stenberg** / **Seth Larson** — the curl bug-bounty collapse narrative.
- **Steve Ruiz** / **Sam Saffron** / **Mitchell Hashimoto** — maintainer-burden perspectives.
- **Pearce et al. (NYU, IEEE S&P 2022)** — *Asleep at the Keyboard*, 40% vulnerability rate.
- **Perry et al. (Stanford)** — insecure-but-confident effect.
- **Spracklen et al. (USENIX '25)** — slopsquatting origin.
- **METR** — 19%-slower-despite-feeling-faster RCT.
- **GitClear** — 211M-line churn analysis.
- **Nathan Onn** — "stop planning spacecraft" principle (Factory/Strategy spam).

Full source list: [llm-slop-taxonomy.md](llm-slop-taxonomy.md) §"Notable sources".

## Spec attribution

The directory layout and frontmatter conventions follow the **[Agent Skills specification](https://agentskills.io/spec)**. Validation against that spec uses [`skills-ref`](https://github.com/agentskills/agentskills/tree/main/skills-ref).
