# Atria

The living schedule for medicine. Trainee-first (residency/fellowship) scheduling: generate, validate, explain, **repair with minimal disruption**, publish. Attending edition later on the same core.

**Immediate goal:** win the Built-with-Claude Life Sciences hackathon (deadline ~2026-07-13). The demo is the spec's vertical slice: import Excel → Claude rule capture → generate a fellowship schedule → a fellow calls out sick → ≤3 ranked minimal repairs → diff + disruption receipt → publish → who's-on-call page updates.

## Canonical documents (read before designing anything)
- `docs/SPEC-V1.md` — the product spec. Section numbers cited as §N.
- `docs/DECISION-BRIEF.md` — why every decision was made (rulings R1–R8).
- `docs/DOMAIN-FINDINGS.md` — verified ACGME/COCATS/jeopardy constraint facts. Do NOT invent regulatory numbers; use these.
- `docs/SCHEMA.md` — the shared data contract between web and solver. Change it only deliberately and update both sides.

## Architecture
- `web/` — Next.js (App Router, TypeScript, Tailwind). UI + API routes. State in SQLite via Prisma for the hackathon (Postgres later).
- `solver/` — Python 3.12 + FastAPI + OR-Tools **CP-SAT**. Isolated solver service: `/solve` (generate), `/repair`, `/validate`. Runs on :8000.
- `fixtures/` — synthetic demo data (cardiology fellowship). NEVER real names/schedules.

## Non-negotiable invariants (from the spec — violating these is a bug, not a choice)
1. **The independent validator shares no code with the solver.** It re-checks every schedule before publish. Coverage/duty-hour failures BLOCK publish (a named typed override is the only path).
2. **LLM proposes, solver disposes.** Claude may draft rules/mappings/explanation text; nothing Claude emits can directly write to published schedules. Claude output → typed DSL → human confirm → solver.
3. **Repair never auto-commits.** Diff preview + human accept + disruption receipt, always.
4. **Locks are absolute.** A manual placement/lock survives every re-solve; the solver prices it, never overrides it.
5. **Published versions are immutable.** Amendments create new versions with attributed diffs. Append-only.
6. **Reproducibility:** every solve records input hash + seed; same inputs → same output.
7. **ACGME rules are hard-coded in the validator** (24+4, 14h post-call rest, 1-in-7 averaged over 4wks with home-call exclusion, q3 in-house call averaged). Home call is a distinct constraint class. Do not encode an 80-hour rule until its 2026 scope is re-verified (see DOMAIN-FINDINGS §1 warning).
8. **No PHI, ever.** No patient fields anywhere. Absence reasons are opaque codes.

## Design bar (§6 of the spec)
Density IS the polish: strong table geometry, ~26–30px rows, tabular numerals, low corner radius, rare shadows. Hue = locked assignment families only; text short-codes (CATH, ECHO, CCU, JEOP) carry identity; color is never the sole carrier. Red is reserved for publish-blocking violations. The repair diff dims unchanged cells to ~40% and shows old→new chips. Every consequential change produces a **disruption receipt** ("3 of 1,240 changed · 2 people · 0 violations"). No decorative gradients, nothing pulses. Think Linear/Palantir, not Salesforce.

## Commands
- Web: `cd web && npm run dev` (:3000) · `npm run build` · `npx prisma db push` / `npx prisma studio`
- Solver: `cd solver && .venv/bin/uvicorn app.main:app --reload --port 8000` · tests: `.venv/bin/pytest` (Python 3.13 venv at `solver/.venv`, pip-managed — no uv on this machine)
- Claude API: model `claude-fable-5` via `@anthropic-ai/sdk`; key in `web/.env.local` as `ANTHROPIC_API_KEY` (never commit).

## Conventions
- TypeScript strict; Python typed (pydantic v2). Shared vocabulary comes from docs/SCHEMA.md — same field names on both sides of the HTTP boundary.
- Commit style: short imperative subject, body explains why. Commit early and often.
- Solver time budgets: generate ≤60s for the fixture year, repair ≤10s. Tests enforce.
