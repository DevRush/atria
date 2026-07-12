# Atria architecture

Atria is a medical scheduling system for residency/fellowship programs (trainee
edition today; attending edition on the same core). Its job: turn a program's
rules, people, and services into a schedule that can be **generated, validated,
repaired with minimal disruption, and published** as one trustworthy record.

## Two services, one contract

- **`solver/`** — Python + FastAPI + OR-Tools **CP-SAT**. Stateless. Three
  endpoints: `/solve` (generate), `/repair` (minimal-disruption re-solve),
  `/validate` (independent checker). Guarded by a shared key + rate limits.
- **`web/`** — Next.js (App Router) + Prisma/SQLite. UI, persistence, and the
  publish/share lifecycle. Talks to the solver over HTTPS.

The web↔solver boundary is the data contract in [`docs/SCHEMA.md`](docs/SCHEMA.md).
TypeScript (`web/lib/types.ts`) and pydantic (`solver/app/models.py`) mirror it.

## Domain model

The atomic unit is the **assignment** — one person in one **slot**. A slot is
one object at every grain (block, call-night, jeopardy week, clinic half-day);
only its duration/type/rules differ. That single-object model is what lets one
solver core serve both the trainee and attending editions.

- **Person** — durable identity; dated **memberships** (unit, role/level, FTE);
  eligibility as a credential set; fairness scoped to membership, safety limits
  scoped to the person across memberships.
- **Rule** — a typed record (catalog type + params + scope + level + effective
  dates + provenance), never per-customer code. Level is one of three:
  solver-infeasible, publish-blocking-but-overridable, or soft.
- **Assignment** — append-only, version-scoped (`createdInVersion` /
  `supersededInVersion`). Absences are first-class inputs that *trigger* repair,
  never deletions.
- **ScheduleVersion** — immutable published snapshot with a stored validation
  receipt; exactly one published head; amendments create new versions with
  attributed diffs. An append-only `ScheduleEvent` log records every action.

## The correctness boundary

Generation and validation are **separate code paths**. `solver/app/solver.py`
proposes assignments; `solver/app/validator.py` — which imports neither OR-Tools
nor the solver (enforced by a test) — independently re-checks the result and runs
the authoritative ACGME arithmetic. **`/api/publish` calls the validator and
refuses any version with an unresolved blocking violation** unless a named human
files a typed override waiver, which is stored as the compliance artifact.

The solver is deterministic: fixed seed + single worker + `PYTHONHASHSEED=0`
reproduce the same schedule. Every user-facing rule compiles with a named
assumption literal, so an infeasible model returns the *specific conflicting
rules* with ranked relaxations — never the bare word "infeasible".

## Repair

Repair starts from the published baseline: freeze locks and already-started
slots, add the disruption, re-solve only the affected region, and rank valid
candidates by notice-weighted disruption (nearer-term changes cost more), then
fairness. Every candidate is re-run through the independent validator before it
is returned, so a repair can never propose a schedule that would fail publish.
Output is always a diff plus a disruption receipt ("3 of 664 changed · 2 people ·
0 violations"), and it never auto-commits.

## Publication and sharing

Publishing revalidates the exact payload, writes a new immutable version, stores
a validation receipt, and logs an audit event. The **public who's-on-call link**
serves a privacy-allowlisted projection (program name, dates, service/role
labels, and abbreviated names only) through a revocable bearer link whose 256-bit
secret is stored only as a SHA-256 hash. Every failure mode returns one generic
page, and public pages are noindex/no-referrer.

## Import boundary

`web/lib/import-parse.ts` parses a coordinator's real Excel (merged cells,
footnote markers, code legend, stray columns) into a confirmable structure,
flagging anything it can't read — it never silently drops a cell. Commit maps the
imported blocks onto the calendar and generates a validated call/jeopardy
schedule around them. AI may assist import and explanation; it is never the
correctness layer.

## Safety and privacy

- No patient data, ever — enforced at the model level.
- Absence *reasons* are opaque, role-gated codes, excluded from AI processing.
- Required constraints are never silently downgraded.
- The who's-on-call read path is designed to stay available independently of the
  solver; a wrong on-call answer is treated as patient-safety-grade.

See [`docs/DECISION-BRIEF.md`](docs/DECISION-BRIEF.md) for the reasoning behind
these choices and [`docs/SPEC-V1.md`](docs/SPEC-V1.md) for the full v1 spec.
