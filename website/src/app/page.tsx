import Link from "next/link";

const verbs = [
  {
    group: "Create",
    items: [{ name: "scaffold", href: "/docs/commands/scaffold" }],
  },
  {
    group: "Evaluate",
    items: [
      { name: "audit", href: "/docs/commands/audit" },
      { name: "critique", href: "/docs/commands/critique" },
    ],
  },
  {
    group: "Refine",
    items: [
      { name: "refactor", href: "/docs/commands/refactor" },
      { name: "tighten", href: "/docs/commands/tighten" },
      { name: "name", href: "/docs/commands/name" },
    ],
  },
  {
    group: "Simplify",
    items: [
      { name: "simplify", href: "/docs/commands/simplify" },
      { name: "extract", href: "/docs/commands/extract" },
    ],
  },
  {
    group: "Harden",
    items: [
      { name: "harden", href: "/docs/commands/harden" },
      { name: "polish", href: "/docs/commands/polish" },
    ],
  },
];

const languages = [
  { name: "TypeScript", href: "/docs/languages/typescript" },
  { name: "Python", href: "/docs/languages/python" },
  { name: "Go", href: "/docs/languages/go" },
  { name: "React", href: "/docs/languages/react" },
];

const faqItems = [
  {
    q: "What is Sublime?",
    a: "Sublime is a code-craft skill system you drop into your AI coding agent. It gives the model opinionated positions on how code should read, a catalog of anti-patterns to refuse, and a vocabulary of verbs to steer with. It is not a framework, not a library, and not a linter.",
  },
  {
    q: "Is this a linter?",
    a: "No. A linter checks syntax and formatting. Sublime teaches judgment. It tells the model why a six-parameter constructor is wrong, not just that a line is too long. Linters enforce rules. Sublime encodes craft.",
  },
  {
    q: "Do I need to load every skill file?",
    a: "No. Start with the foundation skill. Add verbs as you need them. Add language extensions when you work in that language. The system is modular by design.",
  },
  {
    q: "Which AI agents does Sublime work with?",
    a: "Any agent that accepts system-level or project-level instructions. Claude Code, Cursor, Windsurf, Cline, Aider, or any tool that reads AGENTS.md, CLAUDE.md, .cursorrules, or equivalent files.",
  },
];

function SectionNumber({ n }: { n: string }) {
  return (
    <span className="text-[2.25rem] font-bold text-muted/40 font-mono select-none leading-none">
      {n}
    </span>
  );
}

export default function Home() {
  return (
    <div className="max-w-[42rem] mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
      {/* Hero */}
      <header className="mb-32">
        <h1 className="text-[3rem] sm:text-[3.75rem] font-bold tracking-tight leading-[1.05] mb-5">
          Sublime
        </h1>
        <p className="text-[1.25rem] sm:text-[1.5rem] font-medium text-foreground/90 mb-5 leading-snug">
          A code-craft skill for AI coding agents.
        </p>
        <p className="text-base text-muted max-w-lg mb-10 leading-relaxed">
          Opinionated positions, a named anti-pattern catalog, and a verb
          library. Drop it into your AI coding agent and stop producing the same
          predictable slop.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/docs/foundation"
            className="inline-flex items-center px-5 py-2.5 bg-foreground text-background font-medium text-sm rounded-md hover:opacity-90 transition-opacity"
          >
            Get Started
          </Link>
          <Link
            href="/docs/commands/audit"
            className="inline-flex items-center px-5 py-2.5 border border-border text-foreground font-medium text-sm rounded-md hover:bg-surface-hover transition-colors"
          >
            Browse Commands
          </Link>
        </div>
      </header>

      {/* 01 The Foundation */}
      <section className="mb-24">
        <div className="flex items-baseline gap-5 mb-5">
          <SectionNumber n="01" />
          <h2 className="text-[1.25rem] sm:text-[1.5rem] font-bold tracking-tight">
            The Foundation
          </h2>
        </div>
        <p className="text-muted leading-relaxed mb-3">
          Before commands, before detection, Sublime teaches the model real
          craft. One foundation skill, eight deeper reference files across the
          dimensions of code that matter: naming, control flow, data modeling,
          errors, interfaces, dependencies, tests, comments.
        </p>
        <p className="text-muted leading-relaxed mb-6">
          The foundation is not a checklist. It is a set of positions. Each one
          is defensible, each one is opinionated, and each one exists because AI
          models get it wrong by default.
        </p>
        <Link
          href="/docs/foundation"
          className="text-accent font-medium text-sm hover:underline underline-offset-4"
        >
          Read the foundation
        </Link>
      </section>

      {/* 02 The Language */}
      <section className="mb-24">
        <div className="flex items-baseline gap-5 mb-5">
          <SectionNumber n="02" />
          <h2 className="text-[1.25rem] sm:text-[1.5rem] font-bold tracking-tight">
            The Language
          </h2>
        </div>
        <p className="text-muted leading-relaxed mb-8">
          Ten verbs form a shared vocabulary between you and your agent. Each
          encodes one discipline so you can steer with precision instead of
          hoping the model understands what you meant.
        </p>
        <div className="space-y-5">
          {verbs.map((group) => (
            <div key={group.group} className="flex items-baseline gap-4">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted w-20 shrink-0">
                {group.group}
              </span>
              <div className="flex flex-wrap gap-2">
                {group.items.map((verb) => (
                  <Link
                    key={verb.name}
                    href={verb.href}
                    className="inline-block px-3 py-1.5 font-mono text-sm border border-border rounded-md hover:border-accent hover:text-accent transition-colors"
                  >
                    {verb.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 03 The Antidote */}
      <section className="mb-24">
        <div className="flex items-baseline gap-5 mb-5">
          <SectionNumber n="03" />
          <h2 className="text-[1.25rem] sm:text-[1.5rem] font-bold tracking-tight">
            The Antidote
          </h2>
        </div>
        <p className="text-muted leading-relaxed mb-3">
          Every AI model learned from the same mass of training data. Without
          intervention, they all produce the same predictable mistakes: wrapper
          classes that add nothing, premature abstractions nobody asked for, god
          objects wearing a trench coat.
        </p>
        <p className="text-muted leading-relaxed mb-6">
          Sublime names them, tags them for detection, and teaches the model to
          refuse them. 80+ patterns across 12 categories.
        </p>
        <Link
          href="/docs/anti-patterns"
          className="text-accent font-medium text-sm hover:underline underline-offset-4"
        >
          Browse the anti-pattern catalog
        </Link>
      </section>

      {/* 04 Language Extensions */}
      <section className="mb-24">
        <div className="flex items-baseline gap-5 mb-5">
          <SectionNumber n="04" />
          <h2 className="text-[1.25rem] sm:text-[1.5rem] font-bold tracking-tight">
            Language Extensions
          </h2>
        </div>
        <p className="text-muted leading-relaxed mb-8">
          Sublime core is language-agnostic. When you need language-specific
          craft, load an extension. Each one encodes the idioms, pitfalls, and
          patterns that matter for that ecosystem.
        </p>
        <div className="flex flex-wrap gap-3">
          {languages.map((lang) => (
            <Link
              key={lang.name}
              href={lang.href}
              className="px-4 py-2 border border-border rounded-md text-sm font-medium hover:border-accent hover:text-accent transition-colors"
            >
              {lang.name}
            </Link>
          ))}
        </div>
      </section>

      {/* 05 Install */}
      <section className="mb-24">
        <div className="flex items-baseline gap-5 mb-5">
          <SectionNumber n="05" />
          <h2 className="text-[1.25rem] sm:text-[1.5rem] font-bold tracking-tight">
            Install
          </h2>
        </div>
        <p className="text-muted leading-relaxed mb-6">
          Clone the repository and symlink the skills you need into your
          project.
        </p>
        <pre className="bg-code-bg text-code-fg px-5 py-4 rounded-lg font-mono text-sm overflow-x-auto mb-5 border border-border">
          <code>git clone https://github.com/nokusukun/sublime</code>
        </pre>
        <p className="text-muted text-sm leading-relaxed">
          Then symlink the foundation skill into your project root. For
          Claude&nbsp;Code, link to{" "}
          <code className="text-xs bg-surface border border-border px-1.5 py-0.5 rounded font-mono">
            CLAUDE.md
          </code>
          . For Cursor, link to{" "}
          <code className="text-xs bg-surface border border-border px-1.5 py-0.5 rounded font-mono">
            .cursorrules
          </code>
          . Point it at{" "}
          <code className="text-xs bg-surface border border-border px-1.5 py-0.5 rounded font-mono">
            sublime/skills/foundation.md
          </code>{" "}
          and you are ready to go.
        </p>
      </section>

      {/* 06 What's New */}
      <section className="mb-24">
        <div className="flex items-baseline gap-5 mb-5">
          <SectionNumber n="06" />
          <h2 className="text-[1.25rem] sm:text-[1.5rem] font-bold tracking-tight">
            What&apos;s New
          </h2>
        </div>
        <div className="pl-4">
          <p className="text-sm font-mono text-muted mb-1.5">v0.1</p>
          <p className="text-foreground leading-relaxed">
            Initial release. Foundation skill, ten command verbs, 80+
            anti-patterns, and language extensions for TypeScript, Python, Go,
            and React.
          </p>
        </div>
      </section>

      {/* 07 FAQ */}
      <section>
        <div className="flex items-baseline gap-5 mb-8">
          <SectionNumber n="07" />
          <h2 className="text-[1.25rem] sm:text-[1.5rem] font-bold tracking-tight">
            FAQ
          </h2>
        </div>
        <dl className="space-y-8">
          {faqItems.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold text-foreground mb-2">{item.q}</dt>
              <dd className="text-muted leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
