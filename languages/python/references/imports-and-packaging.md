# Imports and packaging

Imports are the shape of your module graph; circular imports, wildcard imports, and an `__init__.py` doing real work are all signs the graph is wrong.

A Python project's import graph is the only structural document it has. Every `from x import y` is an edge; every module is a node; the whole shape determines what is testable, what is swappable, and what breaks when you rename a file. Your natural failure mode is to treat imports as a typing exercise and `__init__.py` as a landing page for "everything the package exports." Both instincts are wrong. Imports are structure. `__init__.py` is a promise.

## Taxonomy

- **Absolute vs relative imports.**
- **`__init__.py` discipline.**
- **Wildcard imports and tooling breakage.**
- **`if __name__ == "__main__":` on library modules.**
- **Packaging with `pyproject.toml` (PEP 621).**
- **Entry points vs `python -m foo`.**
- **Namespace packages (PEP 420).**
- **`__all__` — when it helps and when it lies.**

---

## Absolute vs relative imports

Absolute imports name the package from the root: `from myapp.billing.invoice import format_money`. Relative imports name it from the current module: `from .invoice import format_money`. Both work; they are not interchangeable.

Use absolute imports by default. They survive moves and read unambiguously in review. Use relative imports only within a tight package where the contents always move together.

```python
# myapp/billing/handlers.py

# prefer — absolute, self-documenting
from myapp.billing.invoice import format_money

# acceptable within a tight package
from .invoice import format_money

# wrong — two-dot imports across sibling subpackages
from ..users.models import User
```

Two-dot (`from ..foo import bar`) is an absolute import in disguise — write it absolute.

**DO** pick one style per package and stick with it.
**DO NOT** mix absolute and relative for the same target in the same file.

---

## `__init__.py` discipline

`__init__.py` runs on first import. Anything you put there executes. It has two legitimate jobs: declare the package's public surface, and do the bare minimum to make it usable. It does not hold logic, execute side effects, or flatten the namespace.

```python
# myapp/billing/__init__.py — good
from myapp.billing.invoice import create_invoice, void_invoice
from myapp.billing.types import Invoice, InvoiceId

__all__ = ["create_invoice", "void_invoice", "Invoice", "InvoiceId"]
```

```python
# myapp/billing/__init__.py — bad
from .invoice import *
from .types import *
from .db import connection
connection.connect()                 # side effect at import time
```

The bad version combines wildcard re-exports, untyped public surface, and a side effect at import. Now `import myapp.billing` opens a database connection; tests can't stub it; circular imports become runtime errors because wildcards pull everything into the init before dependencies resolve.

**DO** keep `__init__.py` small and declarative; list named re-exports explicitly.
**DO NOT** run side effects on import — no database connections, no logger configuration, no registry mutation.

---

## Wildcard imports and tooling breakage

`from foo import *` imports every public name from `foo` into the current namespace — the single fastest way to break every tool that reads Python code. Type checkers can't narrow what was imported, linters can't flag unused names, IDEs can't offer auto-import, and a reader can't tell which module `format_money` came from.

```python
# wrong
from myapp.billing import *
result = format_money(total)       # which module? git-blame only

# right
from myapp.billing import format_money
```

The worst variant is `from .foo import *` inside `__init__.py` — the canonical `init-reexport-bloat` shape. Ruff flags these with `F403`/`F405`; treat them as errors, not warnings.

---

## `if __name__ == "__main__":` on library modules

The idiom belongs in exactly two places: a `scripts/` folder of ad-hoc runnables, and a `__main__.py` that supports `python -m pkg`. It does not belong at the bottom of every file. The model adds it anyway, producing library modules with a trailing block that runs code nothing imports — dead weight, or worse, drift-prone demos that diverge from production calls.

```python
# myapp/billing/invoice.py — slop
def create_invoice(...): ...

if __name__ == "__main__":
    create_invoice(customer_id="demo", amount=100)   # dead branch

# myapp/__main__.py — correct
from myapp.cli import main

if __name__ == "__main__":
    main()
```

If you need an executable script, write the script. The module's job is to expose callable behavior; execution is a separate concern.

---

## Packaging with `pyproject.toml` (PEP 621)

`pyproject.toml` is the standard. `setup.py` is almost never the right choice for a new project. PEP 621 defines the `[project]` table; build backends handle the actual build. Pick one and commit:

| Backend | Best for |
|---|---|
| `hatchling` | new libraries; default for `hatch` |
| `setuptools` | legacy projects or C extensions |
| `pdm-backend` | projects managed with `pdm` |
| `flit-core` | pure-Python libraries, minimal config |
| `uv_build` | projects managed with `uv` |

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "myapp"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["httpx>=0.27", "pydantic>=2.6"]

[project.scripts]
myapp = "myapp.cli:main"

[project.optional-dependencies]
dev = ["pytest", "ruff", "mypy"]
```

`requirements.txt` is an output of a lockfile, not a source of truth — use `uv.lock`, `poetry.lock`, or `pdm.lock`.

---

## Entry points vs `python -m foo`

Two ways to run a package as a command:

- `[project.scripts]` → generates a console entry point; `pip install` puts `myapp` on `PATH`. Use when the command is the product.
- `__main__.py` → enables `python -m myapp`. Use for test harnesses, debug entries, or developer runners.

A well-packaged tool has both, wired to the same `main()`:

```python
# myapp/__main__.py
from myapp.cli import main
if __name__ == "__main__":
    main()
```

```toml
[project.scripts]
myapp = "myapp.cli:main"
```

---

## Namespace packages (PEP 420)

A namespace package is a package without an `__init__.py`. Python's import system stitches together sibling directories across `sys.path` that share the same top-level name. Right choice when multiple distributions contribute to the same package (`azure.storage`, `azure.identity`). For a single-distribution project, write `__init__.py` and be explicit.

The implicit case is where bugs live: a missing `__init__.py` you did not intend to omit means the folder "works" as an import but your build tool silently stops packaging it. One missing file, one production-only `ModuleNotFoundError`.

**DO** write `__init__.py` files explicitly for regular packages — don't rely on PEP 420 unless you mean it.

---

## `__all__` — when to declare, when it lies

`__all__` controls two things: what `from package import *` imports, and what tools treat as the package's documented public surface (Sphinx autodoc, stub generators, some linters). It does not control what is importable — that is whatever is defined in the module.

```python
# myapp/billing/__init__.py
from myapp.billing.invoice import create_invoice, void_invoice
from myapp.billing.types import Invoice, InvoiceId

__all__ = ["create_invoice", "void_invoice", "Invoice", "InvoiceId"]
```

Useful in library packages where you curate the public surface; noise in internal application code. If you declare it, keep it in sync — a drifted `__all__` is worse than none.

---

## Import style comparison

| Import style | Tree-shakable | Surfaces to tooling | When to use |
|---|---|---|---|
| `from pkg.mod import name` | Yes — direct | Full: type checker, IDE, linter | Default; always prefer |
| `import pkg.mod as m` | Yes | Full; verbose at call site | When many names from one module would collide |
| `from .mod import name` (relative, one dot) | Yes | Full | Inside a tight package |
| `from ..sibling import name` (two-dot) | Yes | Full, but reader must parse | Smell; prefer absolute |
| `from pkg import *` | No — opaque surface | Hostile to type checker, linter, IDE | Never in library or app code; REPL only |
| `import pkg` + `pkg.mod.name` | Yes | Full | When `pkg` is used enough to keep top-level reference |
| Dynamic `importlib.import_module("pkg.mod")` | No | Opaque | Plugin systems only, at well-defined seams |
| Deferred-import-inside-function | Yes at runtime | Hidden from static tools | Only to break a genuine cycle or avoid startup cost |

Pick the top row until you have a reason not to.

---

## Common AI failure modes

**`init-reexport-bloat`** — an `__init__.py` full of `from .a import *; from .b import *` meant to "expose a clean API." What you get: opaque public surface, circular import risk, slow cold start, and `ModuleNotFoundError`s for symbols the IDE said existed. List the names you want to expose explicitly, set `__all__`, and let callers import the rest from their real module paths.

**`star-import`** — `from foo import *` anywhere that is not a REPL. Every tool loses: type checkers cannot narrow, linters cannot flag unused symbols, grep cannot find the source. Ruff's `F403`/`F405` catch it; promote them to errors.

**`sys-path-hack`** — `sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))` to work around a missing `pyproject.toml`. The model produces this when asked for "a multi-file Python project" because it doesn't reach for packaging by default. Fix the absence, not the symptom: write `pyproject.toml`, declare the package, install with `pip install -e .` or `uv pip install -e .`.

**`setup-py-in-pyproject-era`** — `setup.py` and `requirements.txt` generated for a new project when PEP 621 and a lockfile are the standard. `setup.py` is executable configuration; `pyproject.toml` is declarative. Declarative wins every time a tool chain needs to introspect without executing (mirrors, security scanners, reproducible builds). Keep `setup.py` only to unblock legacy tooling that refuses to read TOML.

**`main-boilerplate-everywhere`** — every module ending with `if __name__ == "__main__":`, including library modules never executed directly. The block is dead weight or a drift-prone demo. Delete it from every non-script file. For package-level executability, write `__main__.py`. For per-module smoke tests, write real tests.

---

### Avoid

- `from pkg import *` anywhere in library or application code.
  — Opaque to every tool; the public surface drifts silently when a new symbol appears upstream.
- `__init__.py` that runs side effects — `logging.basicConfig`, `connect()`, registry mutation.
  — Imports become runtime events; tests lose isolation; cycles appear only in production.
- `__init__.py` that does `from .a import *` to flatten the namespace.
  — Trades explicit public surface for invisible coupling; every new file changes the package's API.
- Two-dot (`from ..x import y`) relative imports across sibling subpackages.
  — You are reaching across the module graph; say so absolutely.
- `sys.path` mutation in source files.
  — You have a packaging problem. Write `pyproject.toml`.
- `setup.py` for new projects, or `setup.py` and `pyproject.toml` coexisting with different metadata.
  — Declarative `pyproject.toml` is the standard; two sources of truth drift.
- `requirements.txt` as a source of truth.
  — It is an output of a lockfile; use `uv.lock` / `poetry.lock` / `pdm.lock`.
- `if __name__ == "__main__":` at the bottom of library modules never executed directly.
  — Dead branches that lie about what the module is for.
- A missing `__init__.py` in a folder you intended to be a regular package.
  — PEP 420 treats it as a namespace package; wheels may silently omit it.
- `__all__` that does not match the module's actual public symbols.
  — A stale `__all__` is worse than none.
- Importing a heavy dependency at module top-level when only one function needs it.
  — Every caller of the module pays the import cost.

See [`../SKILL.md`](../SKILL.md) for the Python posture and hard bans.
See [`../anti-patterns.md`](../anti-patterns.md) for the named catalog entries on re-export bloat and main-boilerplate.
See [`../../../sublime/SKILL.md`](../../../sublime/SKILL.md) for the core code-craft foundation.
See [`../../../sublime/references/interfaces.md`](../../../sublime/references/interfaces.md) for module-boundary and public-surface discipline.
See [`../../../anti-patterns/file-organization.md`](../../../anti-patterns/file-organization.md) for cross-language barrel and re-export entries.
See [`decorators.md`](decorators.md) for decorators that run at import time and their side-effect risks.
