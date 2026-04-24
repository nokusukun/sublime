# Sublime

**A code-craft skill for AI coding agents.** Opinionated positions, a named anti-pattern catalog, and a verb library. Drop it into your Claude Code / Cursor / Codex CLI / Gemini CLI context and your model stops producing the same predictable slop.

Not a linter. A partner with positions.

---

## 01 The Foundation

Before commands, before detection, Sublime teaches the model real craft. One foundation skill, eight deeper reference files across the dimensions of code that matter: naming, control flow, data modeling, errors, interfaces, dependencies, tests, comments.

→ [sublime/SKILL.md](sublime/SKILL.md) · [sublime/references/](sublime/references/)

## 02 The Language

Ten verbs form a shared vocabulary between you and your agent. Each encodes one discipline so you can steer with precision. Each is its own Agent Skill alongside the foundation.

- **Create** — [`/scaffold`](scaffold/SKILL.md)
- **Evaluate** — [`/audit`](audit/SKILL.md) · [`/critique`](critique/SKILL.md)
- **Refine** — [`/refactor`](refactor/SKILL.md) · [`/tighten`](tighten/SKILL.md) · [`/name`](name/SKILL.md)
- **Simplify** — [`/simplify`](simplify/SKILL.md) · [`/extract`](extract/SKILL.md)
- **Harden** — [`/harden`](harden/SKILL.md) · [`/polish`](polish/SKILL.md)

## 03 The Antidote

Every AI model learned from the same templates. Without intervention, they all produce the same predictable mistakes. Sublime names them, tags them for detection (lint / type-check / review), and teaches the model to refuse them.

Eighty-plus named patterns across twelve categories: over-defensive programming, gratuitous abstraction, naming slop, comment slop, file organization, boilerplate, stylistic tells, security and correctness, testing slop, architectural slop, dependency slop, review burden.

→ [anti-patterns/](anti-patterns/README.md)

## 04 Language extensions

Sublime core is language-agnostic. Language-specific extensions live under [`languages/`](languages/), each its own Agent Skill, loadable with or without the core.

- [languages/typescript/](languages/typescript/SKILL.md) — strict null checks, discriminated unions, `any`/`unknown`/`as`, narrowing, branded types, module boundaries, React patterns.
- [languages/python/](languages/python/SKILL.md) — type hints and mypy/pyright, dataclasses vs Pydantic, EAFP exception handling, async correctness, decorator restraint, packaging, idiomatic iteration.
- [languages/go/](languages/go/SKILL.md) — error wrapping, interface design, goroutine and channel discipline, context propagation, defer cleanup, struct and package organization, generics restraint, stdlib modernization.
- `languages/rust/` *(planned)*

Adding a new language is a directory: `languages/<lang>/SKILL.md` + `languages/<lang>/references/` + `languages/<lang>/anti-patterns.md`. Copy [`languages/typescript/`](languages/typescript/) as the template and rewrite. See [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-language-extension) for the file-by-file checklist.

## 05 Install

No package manager. No CLI. Just the files.

```bash
git clone https://github.com/<org>/sublime
```

Every top-level directory containing a `SKILL.md` is an [Agent Skill](https://agentskills.io/spec). Point your agent harness at the ones you want to load. For Claude Code, symlink or copy them into `.claude/skills/`:

```bash
ln -s $(pwd)/sublime ~/.claude/skills/sublime
ln -s $(pwd)/audit   ~/.claude/skills/audit
# …repeat for any verbs and language extensions you want
```

For Cursor, point each at `.cursor/rules/`. For Codex CLI, include them in your `AGENTS.md`.

Project-specific context lives in `.sublime.md` at your project root. Ask the agent to invoke `sublime teach` once per project to produce that file.

## 06 Try it

Once the skill is loaded, steer with verbs:

```
/audit src/auth/

/critique src/components/Dashboard.tsx

/simplify lib/retry.ts

/name src/services/*.ts

/polish
```

The model runs each verb against the foundation and reports or rewrites. Commands compose — run `/audit` before `/harden`, run `/critique` before `/refactor`, run `/polish` last.

## 07 What's new

- **v0.1** — Initial release: core foundation skill, eight reference files, twelve-category anti-pattern catalog, ten verb-command skills, TypeScript extension skill with six references plus its own anti-pattern file.

## 08 FAQ

**Is this a linter?** No. Many of the anti-patterns are lintable and the tag system flags which ones, but the catalog includes review-only patterns (phantom validation, assumption propagation, architectural slop) no static tool can catch. Sublime is a set of positions loaded into the model's context — the model itself enforces.

**Do I have to load every skill?** No. Loading only [`sublime/`](sublime/SKILL.md) gets you the foundation and references. The verb skills and language extensions are additive — load whichever you need.

**Will Sublime argue with me?** Yes, if you ask it to ship something it would flag. That's the point. It has positions. Give it a real reason and it'll step aside; don't, and it'll push back. The foundation explicitly says: *it's a partner, not a linter — it can be pushed back on with a real reason, but it has positions.*

**Why not publish as an npm package?** The skill is text. A package manager adds friction for no benefit. When the file-format spec for an agent-skill registry stabilizes, that might change.

**How do I contribute a new anti-pattern, command, or language?** See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
