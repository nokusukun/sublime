# Dependencies

Every `import` is a trust assertion, a long-term commitment, and a supply-chain surface — and the model's reflex is to add one for every problem it can recognize.

The foundation file already states the rule: verify every package exists, prefer the standard library, pin versions. This file goes deeper. It is the specific, adversarial discipline you need because the model's training corpus is full of imports for packages that no longer exist, never existed, or existed but have been replaced — and attackers are now racing to register the names the model hallucinates.

## Taxonomy

The dependency failures you need to defend against cluster into six groups:

- **Supply-chain risk.** Slopsquatting, compromised maintainers, unpublished transitive deps, typo-squatting registries.
- **Unnecessary dependency.** A library doing what the standard library already does. Lodash `isEmpty`. `axios` for a `GET`.
- **Deprecated choice.** Picking a package that was idiomatic in 2016 and has been replaced twice since.
- **Stale API.** Calling a real method that existed in v2 but was removed in v4.
- **Version drift.** Auto-bumping majors, unpinned transitive versions, lockfile not committed.
- **Heavyweight for trivial.** Pulling Puppeteer to fetch a JSON endpoint. Adding `moment` for one date format.

Each has a distinct defense. Do not conflate them.

## The verify-before-you-import discipline

Roughly one in five LLM-generated imports points at a non-existent package. Attackers know this. They register the hallucinated names. Real incidents have shipped this year — `faster_log` on crates.io, `async_println`, `unused-imports` on npm, the `arangodb` RubyGems incident. This attack is now named *slopsquatting*, and it targets you specifically, because you write the first draft.

Before you type the import, you do this:

1. **State the package name out loud.** Not "a hashing library" — the exact string you plan to type. `"sha-utilities"`, `"fast-crypto"`, `"smart-retry"`.
2. **Ask whether you have personally seen this package in a recent file, lockfile, or dependency graph.** If yes, proceed. If no, continue.
3. **Search the registry.** npm, PyPI, crates.io, Maven Central. Is the name a real package? Who publishes it? How many downloads per week? When was the last release?
4. **Check the API you intend to call against the current docs, not against memory.** Method names migrate. `openai.createCompletion` became `openai.completions.create`. `request.get` became `axios.get` became `fetch`.
5. **Prefer the standard library outcome.** If the runtime already provides this, stop.

A package with three stars, one commit, and a maintainer account created this week is not a new discovery. It is bait. Treat unfamiliar package names that fit your need *too perfectly* as warnings, not gifts.

## The standard-library-first principle

Every language shipped in the last decade has a rich standard library. Models under-use it because their training data over-samples tutorials that say "first, install this library." Before you reach for a dependency, check what the runtime already does.

| Need | Reflex dep | Native replacement |
|---|---|---|
| HTTP request | `axios`, `request`, `got`, `node-fetch` | `fetch` (Node 18+, Deno, Bun, browsers) |
| Flatten array | `lodash.flatten`, `lodash/fp` | `Array.prototype.flat()` |
| Deep clone | `lodash.clonedeep` | `structuredClone()` |
| Unique IDs | `uuid`, `node-uuid`, `cuid` | `crypto.randomUUID()` |
| Random token | `Math.random().toString(36)` | `crypto.getRandomValues(new Uint8Array(32))` |
| Date formatting (JS) | `moment`, `dayjs` | `Intl.DateTimeFormat`, `toLocaleDateString` |
| Env var parsing (Node) | `dotenv` | `process.loadEnvFile()` (Node 21+) |
| Retry | `async-retry`, `p-retry` | A 12-line loop with exponential backoff |
| Debounce | `lodash.debounce` | 6 lines of `setTimeout` |
| Empty check (JS) | `lodash.isEmpty` | `x == null \|\| (typeof x === "object" && !Object.keys(x).length)` or the right type check inline |
| HTTP server (Python) | `flask` (for one endpoint) | `http.server` or FastAPI if you need more |
| JSON handling | a "typed JSON" package | The language's built-in `JSON`/`json` module |

The rule is not "never use dependencies." It is: the value must clearly justify the long-term commitment. `fast-xml-parser` is worth it; `is-even` is not.

## The cost of every dependency

A dependency is not free. The costs compound:

- **Install time.** Your CI runs this every build.
- **Bundle size.** Every byte you ship is a byte your user downloads.
- **Transitive surface.** Every dep brings its own deps. `left-pad` broke the internet because of this.
- **Maintenance drift.** The package will ship breaking changes, security patches, and deprecations — all on its schedule, not yours.
- **Supply-chain risk.** Any dep or transitive dep can be compromised. The `event-stream` incident, the `ua-parser-js` incident, the PyPI `ctx` takeover. This is now routine.
- **Cognitive cost.** Every reader must learn the library's idioms to understand your code.

When you add a dep, state the reason out loud in the commit or the PR body. One sentence. "We need `zod` because we parse untrusted JSON at five boundaries and hand-rolled guards drift." If you cannot write that sentence, do not add the package.

## Deprecated alternatives to avoid

Certain packages are still dominant in training data and still wrong in 2026. The model will reflexively reach for them. Reject them on sight:

| Reflex choice | Reason to reject | Use instead |
|---|---|---|
| `moment`, `moment-timezone` | Officially deprecated since 2020, mutable API, 290KB | `date-fns`, `Temporal` (when available), `Intl.DateTimeFormat` |
| `request` | Officially deprecated Feb 2020, CVE-prone | `fetch`, `undici`, `got` |
| `node-uuid` | Deprecated, renamed to `uuid`, which itself is now rarely needed | `crypto.randomUUID()` |
| `left-pad` | Not deprecated, but — `String.prototype.padStart` | `padStart` |
| `lodash` (whole package) | Tree-shakes badly, most functions are now native | Native methods or `lodash-es/<single>` imports |
| `body-parser` (standalone) | Merged into Express 4.16+ | `express.json()` |
| `bcrypt-nodejs` | Unmaintained | `bcrypt` or `argon2` |
| `jade` | Renamed to `pug` in 2016 | `pug` or a template engine chosen deliberately |
| `gulp` | Most projects don't need a task runner anymore | npm scripts, `tsx`, build-tool-native pipelines |

If you see a dep in this column enter the diff, push back on it.

## Pinning, lockfiles, and version discipline

The lockfile is a contract with your future self. Treat it like one.

- **Commit the lockfile.** `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `poetry.lock`, `uv.lock`, `Cargo.lock` (for binaries), `go.sum`. Without it, `npm install` produces different trees on different machines on different days.
- **Pin exact versions for applications.** Use `1.2.3`, not `^1.2.3` or `~1.2.3`, when the project ships. The caret means "accept any minor bump"; the minor bump can be a supply-chain attack, a breaking change mislabeled as minor, or a legitimate update that shifts timing in your load tests.
- **Use ranges for libraries.** A library published to npm should accept compatible versions from its consumers to avoid duplicate installs. Applications do not have this problem.
- **Resist auto-bumping majors in diffs.** A model will happily bump `react` from 18 to 19 inside a diff that was supposed to fix a typo. Reject it. Upgrades are their own PRs with their own tests.
- **Audit on install.** `npm audit`, `pnpm audit`, `pip-audit`, `cargo audit`, `go vuln`. Make this part of CI. Do not merge diffs that add known-CVE packages unless the CVE is irrelevant to your use and you say so in the PR.

```pseudocode
// package.json — applications
{
  "dependencies": {
    "react": "19.0.2",          // exact
    "zod": "3.22.4"              // exact
  }
}

// package.json — libraries
{
  "peerDependencies": {
    "react": "^19.0.0"           // range — the consumer picks
  }
}
```

## Package-namespace conventions

Names matter because names are the attack surface. A few conventions that catch real attacks:

- **Scoped packages (`@org/pkg`) are harder to squat** because the scope is controlled. Prefer scoped for internal packages.
- **Typo-squat variants are common.** `expresss`, `loadash`, `requerst`. When a name feels slightly off from what you remember, it probably is.
- **Name collisions across registries.** A package on npm is not the same as a package with the same name on crates.io or PyPI. Models mix these up.
- **Namespace patterns matter.** `pytorch` is the project; `torch` is the package on PyPI. `redis` exists on npm; `ioredis` is a different library with a different API. Do not assume parallel naming.

## Common AI failure modes

Your natural failure mode in dependencies is to over-reach. You recognize a problem and reach for the most-named package in training data, whether or not it is current, needed, or real. The taxonomy names the specific shapes:

**Slopsquatting / hallucinated import (8.2).** The pattern: confidently importing a package that does not exist, and where attackers have now registered the hallucinated names. Empirical rate: 19.7% of 576,000 generated samples referenced non-existent packages; 205,474 unique names; 43% repeat across runs. Real attacks are shipping. This is the single highest-stakes dependency failure mode, and the only defense is the verify step above — there is no substitute.

**Lodash-for-isEmpty (11.1).** Adding a 24KB general-purpose library for one function a native method replaces. Often the import survives the inline call being replaced, because nobody prunes. Check your bundle before and after.

**axios-when-fetch-suffices (11.2).** Adding `axios`, `got`, `node-fetch`, or `request` to a project whose runtime already has `fetch`. The model's training data overweights tutorials from before `fetch` was native everywhere. It is native now.

**Deprecated-suggestion (11.3).** Suggesting `moment`, `request`, `node-uuid`, or similar packages whose replacement has been idiomatic for three or more years. This one is pure training-data lag. Catch it at the import line.

**Outdated API version (11.4).** Calling `openai.createCompletion` on the v4 SDK. Using Next.js pages-router patterns in an App Router project. Using `PropTypes` where TypeScript is present. The model confidently invents method names and version-specific patterns. Verify against *the installed version*, not against what you remember.

**Heavyweight-for-trivial (11.5).** Spinning up Puppeteer to fetch a static JSON endpoint. Electron for a menubar script. `next` for a 40-line marketing page. Match the tool to the job; a small job does not deserve a large tool.

## Worked example

A model is asked: "parse a CSV file and email the totals."

The slop draft:

```pseudocode
import Papa from "papaparse"           // 45KB dep for `split("\n").map(split(","))`
import nodemailer from "nodemailer"     // heavyweight; project already has a mail service
import moment from "moment"             // deprecated
import { format } from "date-fns"       // third date lib in the same project
import axios from "axios"               // axios added, fetch already used elsewhere
```

The tightened draft:

```pseudocode
import { mailer } from "./mail"                    // existing module
// CSV parsing inline — 8 lines, no dep, exact semantics
// Dates via Intl.DateTimeFormat, already imported
// HTTP via native fetch, already the convention
```

Zero new dependencies. The second version is smaller, faster to review, free of supply-chain risk, and consistent with the codebase's conventions. The first is every dependency failure mode at once.

### Avoid

- Slopsquatting — importing a package you have not verified exists.
- Lodash-for-isEmpty — reaching for utility libraries when native methods suffice.
- axios-when-fetch-suffices — adding an HTTP dep to a runtime that already has `fetch`.
- Deprecated-suggestion — proposing `moment`, `request`, `node-uuid`, or similar 2016-era choices.
- Outdated API version — calling methods that no longer exist in the installed version.
- Heavyweight-for-trivial — spinning up Puppeteer, Electron, or GraphQL for a job that needs none of them.
- Unpinned dependencies in applications — `^` and `~` ranges in a shipping app.
- Uncommitted lockfile — every install a lottery.
- Stealth major bumps inside unrelated diffs — upgrades are their own PRs.
- Adding a dep without stating the reason — if you cannot justify it in one sentence, do not add it.
