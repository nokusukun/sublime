# Boilerplate and ceremony

Ceremony is code that exists to look like code. A class wrapping a single function, a constructor that only assigns its arguments, an interface with no body, `if __name__ == "__main__":` on a library module — all are the visible residue of training corpora heavy on enterprise Java and tutorial Python. The root cause is pattern-matching on shape rather than need: the model has seen many classes, so it writes a class. Watch for constructs whose removal would leave the code strictly clearer.

### Unnecessary class wrapping functions

**Tags:** `AI-slop` · `Review` · `Universal`

**Pattern.** A class that holds no state and exists only to namespace one or more functions.

**Forbidden example.**
```python
class UserValidator:
    def validate(self, email: str) -> bool:
        return "@" in email

validator = UserValidator()
if validator.validate(email):
    ...
```

**Why it hurts.** The class carries no state, so `self` is inert. The instantiation, the method lookup, and the class declaration all add reading cost for nothing. Dominant in ChatGPT Python output; the function is the thing and the class is pure ceremony.

**Rewrite.**
```python
def is_valid_email(email: str) -> bool:
    return "@" in email

if is_valid_email(email):
    ...
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [references/interfaces.md](../sublime/references/interfaces.md).

### Trivial getters/setters

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** Getter and setter methods that wrap a field with no validation, transformation, or side effect.

**Forbidden example.**
```ts
class User {
  private name: string;
  getName(): string { return this.name; }
  setName(n: string): void { this.name = n; }
  getEmail(): string { return this.email; }
  setEmail(e: string): void { this.email = e; }
}
```

**Why it hurts.** The accessors add no behavior the field did not already have. They double the surface area of the class, hide the field behind two names each, and train readers to treat them as "maybe doing something" when they are not. If you ever need to add validation, adding a setter at that moment is trivial — premature accessors are pure ceremony.

**Rewrite.**
```ts
class User {
  name: string;
  email: string;
}
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [references/interfaces.md](../sublime/references/interfaces.md).

### Constructor-that-only-assigns-fields

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** A constructor whose entire body is `this.x = x; this.y = y; ...` in a language that supports records, dataclasses, or named tuples.

**Forbidden example.**
```python
class Point:
    def __init__(self, x: float, y: float, z: float):
        self.x = x
        self.y = y
        self.z = z
```

**Why it hurts.** The language already has a concise way to express "a value with these fields." Hand-rolling `__init__` duplicates the signature, invites typos that silently miss an assignment, and gives up equality, repr, and pattern-matching support that the idiomatic form provides for free. Particularly bad in Java 16+, where `record` exists.

**Rewrite.**
```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Point:
    x: float
    y: float
    z: float
```

**See in `/sublime`:** [SKILL.md#data--state](../sublime/SKILL.md#data--state), [references/data-modeling.md](../sublime/references/data-modeling.md).

### Pydantic-for-a-dict

**Tags:** `Quality` · `Review` · `Lang:python`

**Pattern.** A Pydantic `BaseModel` (or equivalent schema class) defined for data that is read once at a boundary and discarded, never validated, never serialized, never reused.

**Forbidden example.**
```python
from pydantic import BaseModel

class ScriptArgs(BaseModel):
    input_path: str
    dry_run: bool

args = ScriptArgs(input_path=sys.argv[1], dry_run=False)
print(args.input_path)
```

**Why it hurts.** The model adds a dependency, an import, a class definition, and an instantiation step to hold three fields you read immediately. Pydantic earns its keep at untrusted boundaries — API payloads, config files, database rows. On a one-shot internal dict, the machinery exceeds the problem.

**Rewrite.**
```python
input_path = sys.argv[1]
dry_run = False
print(input_path)
```

**See in `/sublime`:** [SKILL.md#data--state](../sublime/SKILL.md#data--state), [references/data-modeling.md](../sublime/references/data-modeling.md).

### Empty interface / marker class

**Tags:** `AI-slop` · `Lint` · `Universal`

**Pattern.** An interface, protocol, or class that declares no members of its own and exists only to tag its implementers.

**Forbidden example.**
```ts
interface User extends Serializable {}

interface Repository {}
class UserRepository implements Repository { /* ... */ }
```

**Why it hurts.** An interface with no body adds a name without adding a contract. Callers cannot program against it, type-checkers cannot enforce anything through it, and readers pay the cost of an extra symbol that teaches them nothing. If you need a marker, the language's existing mechanisms (branded types, structural tags, decorators) carry real information.

**Rewrite.**
```ts
// Drop the empty interface entirely; use the concrete type.
class UserRepository { /* ... */ }
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [BAN 7](../sublime/SKILL.md#hard-bans).

### `if __name__ == "__main__":` on library modules

**Tags:** `AI-slop` · `Lint` · `Lang:python`

**Pattern.** An `if __name__ == "__main__":` guard appended to a module that is imported by other code and has no real entry point.

**Forbidden example.**
```python
# src/myproject/user_utils.py
def normalize_email(email: str) -> str:
    return email.strip().lower()

if __name__ == "__main__":
    pass
```

**Why it hurts.** LLMs append the block "to every single file, including library modules with no executable entry point." It implies the module is runnable when it is not, invites readers to look for a CLI that does not exist, and appears as a ritual rather than an intent.

**Rewrite.**
```python
# src/myproject/user_utils.py
def normalize_email(email: str) -> str:
    return email.strip().lower()
```

**See in `/sublime`:** [SKILL.md#the-ai-slop-test](../sublime/SKILL.md#the-ai-slop-test), [references/comments.md](../sublime/references/comments.md).

### `const noop = () => {}`

**Tags:** `AI-slop` · `Lint` · `Lang:ts`

**Pattern.** A no-op function defined at module scope, either unused or used to satisfy a type that should have been optional.

**Forbidden example.**
```ts
const noop = () => {};

function Button({ onClick = noop }: { onClick?: () => void }) {
  return <button onClick={onClick}>click</button>;
}
```

**Why it hurts.** The `noop` is a ceremonial placeholder where an optional callback or a conditional call expresses intent directly. It hides the fact that the caller may not care about the event, spreads a shared mutable-looking reference across call sites, and invites the "why is this here" question on every read.

**Rewrite.**
```ts
function Button({ onClick }: { onClick?: () => void }) {
  return <button onClick={onClick}>click</button>;
}
```

**See in `/sublime`:** [SKILL.md#interfaces--boundaries](../sublime/SKILL.md#interfaces--boundaries), [references/interfaces.md](../sublime/references/interfaces.md).
