# File organization slop

File layout is a navigation surface. Models tend to either dump everything into catch-all modules or explode everything into one-thing-per-file, because each prompt session generates code in isolation and has no incentive to find a home for the new code in the existing structure. The root cause is the same on both ends: missing codebase context. Watch for files whose names do not describe their contents, directories created for a handful of items, barrels that re-export the world, and ORM changes that never got a migration.

### utils.ts / helpers.ts / common.ts dumping ground

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A file whose name is a generic suffix — `utils`, `helpers`, `common`, `misc`, `shared` — accumulating unrelated functions because there was no obvious home for each.

**Forbidden example.**
```ts
// src/utils.ts
export function formatDate(d: Date) { /* ... */ }
export function debounce<T>(fn: T, ms: number) { /* ... */ }
export function isEmpty(x: unknown) { /* ... */ }
export function slugify(s: string) { /* ... */ }
export function retry<T>(fn: () => Promise<T>) { /* ... */ }
```

**Why it hurts.** A file whose name does not describe its contents grows unboundedly, breaks tree-shaking, and hides missing modules. If the new helper has no home, that is a signal of a missing concept, not a missing util file.

**Rewrite.**
```ts
// src/formatting.ts → formatDate, slugify
// src/async.ts     → debounce, retry
// src/predicates.ts → isEmpty
```

**See in `/sublime`:** [BAN 6](../sublime/SKILL.md#hard-bans), [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries).

### Over-split one-function-per-file

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Each utility exported from its own single-function file, usually paired with a barrel index that re-exports everything.

**Forbidden example.**
```
src/utils/
  formatDate.ts     // 4 lines
  slugify.ts        // 3 lines
  debounce.ts       // 6 lines
  isEmpty.ts        // 2 lines
  index.ts          // export * from './formatDate'; ...
```

**Why it hurts.** Navigation cost multiplies: four jumps to read four related one-liners that belong in one cohesive module. Closely-related code is scattered across files with no shared context, and every caller now imports through the barrel instead of the real module.

**Rewrite.**
```ts
// src/formatting.ts
export function formatDate(d: Date) { /* ... */ }
export function slugify(s: string) { /* ... */ }
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [references/interfaces.md](../sublime/references/interfaces.md).

### Barrel index.ts re-exports everything

**Tags:** `AI-slop` · `Lint` · `Lang:ts`

**Pattern.** An `index.ts` at every directory whose only job is `export * from './x'` for every sibling.

**Forbidden example.**
```ts
// src/features/index.ts
export * from "./auth";
export * from "./billing";
export * from "./users";
export * from "./orders";
export * from "./reports";
```

**Why it hurts.** Barrels defeat tree-shaking, slow bundlers, inflate type-check times, and obscure the actual dependency graph. Importers cannot tell where a symbol lives, so rename and refactor tooling degrades. The convenience of `from "features"` is paid for by every build forever.

**Rewrite.**
```ts
import { signIn } from "./features/auth";
import { createInvoice } from "./features/billing";
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [references/dependencies.md](../sublime/references/dependencies.md).

### /constants/ for two values

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** A top-level directory or module created to house a small handful of literal constants.

**Forbidden example.**
```ts
// src/constants/index.ts
export const DEFAULT_TIMEOUT_IN_MILLISECONDS = 5000;
export const MAX_RETRIES = 3;
```

**Why it hurts.** A directory implies enough content to justify navigation. Two values do not. The constants drift away from the code that uses them, future readers have to cross the repo to learn what they mean, and the directory attracts unrelated constants over time — the dumping-ground pattern in miniature.

**Rewrite.**
```ts
// src/http/client.ts
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 3;

export function request(...) { /* uses them inline */ }
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries).

### Deep-nested paranoid layering

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Directory paths with five or more generic layers: `src/lib/utils/helpers/common/shared/index.ts`.

**Forbidden example.**
```
src/
  lib/
    utils/
      helpers/
        common/
          shared/
            index.ts
```

**Why it hurts.** Each layer implies a distinction, but the names are interchangeable synonyms. Readers cannot predict where anything lives, imports become long and brittle, and the structure encodes no real information about the domain. Depth without distinction is pure navigation tax.

**Rewrite.**
```
src/
  formatting.ts
  retries.ts
  ids.ts
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [references/interfaces.md](../sublime/references/interfaces.md).

### Orphan migration / schema drift

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** An ORM model, schema definition, or type changed without a corresponding migration file committed alongside it.

**Forbidden example.**
```python
# models/user.py (edited)
class User(Base):
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str]
    phone: Mapped[str]  # newly added

# migrations/  — nothing new here
```

**Why it hurts.** Flagged by Variant Systems as a Cursor/Claude Code signature: the model edits the model file because that is what the prompt asked for, but does not run the tooling that generates a migration. The schema on disk and the schema in production diverge silently until a deploy breaks.

**Rewrite.**
```python
# models/user.py
class User(Base):
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str]
    phone: Mapped[str]

# migrations/20260417_add_user_phone.py  — generated and committed
```

**See in `/sublime`:** [SKILL.md#data--state](../sublime/SKILL.md#data--state), [references/data-modeling.md](../sublime/references/data-modeling.md).
