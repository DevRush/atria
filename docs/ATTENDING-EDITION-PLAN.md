# Attending edition — build plan (resume point)

The one remaining Codex learning we haven't built. Attendings were the market the
founder deliberately deprioritized (trainee-first), so this is its own phase.
Build it on our CP-SAT core — which beats Codex's greedy heuristic — not a rewrite.

## Why it's mostly config, not a new engine

Our slot/assignment/rule model is already edition-agnostic (one slot object at
every grain; rules are typed data; the solver knows no medicine). The attending
edition is a **new program shape + a few new rule types + attending-flavored
views**, selected by a group-type toggle at setup. The CP-SAT core, validator,
repair, publish, share, and fairness all carry over unchanged.

## 1. Data — an attending cardiology division fixture

`fixtures/attending.json` (mirror the trainee fixture's structure):
- ~18–24 attendings with **FTE fractions** (1.0, 0.8, 0.6, 0.5) and privileges
  (interventional, EP, imaging/TEE, general).
- Service lines as services (kind=`service` or `call`): CONSULT, CICU, TEE/imaging,
  CATH/STEMI call, EP call, CLINIC, ADMIN/teaching (blocked time).
- Two allocation layers: **monthly interventional call** (nightly 17:00→07:00,
  privilege-gated) and **annual service-week allocation** (7-day service blocks).
- Per-attending fixed obligations: clinic half-days, admin days, approved leave.

## 2. New rule types (add to the closed catalog in docs/SCHEMA.md + solver)

- `fte_target` — target assignments/burden per attending prorated by FTE (leximin
  over deviation, like our equity but FTE-weighted). *We already prorate by FTE in
  the ledger — extend it.*
- `service_week_min` / `service_week_max` — bounds on consecutive service weeks.
- `post_call_recovery` — no clinic/service the day after a call night (a variant of
  our `no_call_before_clinic` / rest checks).
- `privilege_required` — only privileged attendings cover STEMI/EP/TEE (this is
  just our existing eligibility check with privilege tags).
- `clinic_conflict` — can't be on a covered service and in clinic the same day
  (interval overlap — validator already has the primitive).
- `holiday_rotation_memory` — carry weighted holiday history across years (our
  `holiday_equity` + a persistent ledger; see Codex ROADMAP).

Most of these reuse validator primitives we already have (eligibility, overlap,
spacing, equity). The solver's assumption-literal + lexicographic-tier machinery
handles them with no engine change.

## 3. Group-type selector

- Add `groupType: "training" | "attending"` to the program (a workspace setting).
- Import/commit + seed accept it; it picks the rule pack, service families, and
  which views render.
- The header program label reflects it ("Cardiology Division · AY 2026–27").

## 4. Attending-flavored views (reuse components)

- **Monthly call calendar** — a date×service grid (who's on interventional/EP/TEE/
  CICU call each night). Reuse the grid + family hues; columns are call domains.
- **Service-week grid** — attending × week → service line (like our block grid,
  finer cadence).
- **Per-attending schedule** — one attending's month (call + clinic + admin +
  service) — a personal view.
- The repair, requests, swaps, fairness ledger, publish, and secure share link all
  work as-is on attending data (call swaps especially).

## 5. Phased steps

1. `fixtures/attending.json` + `generate` it via the solver (blocks/call/service),
   confirm validator-clean. Add `groupType`.
2. New rule types in solver + validator (FTE target, service-week bounds,
   post-call, privilege, clinic-conflict). Unit-test each.
3. Group-type plumbing (seed, import commit, state, header).
4. Monthly-call calendar view + service-week grid + per-attending view.
5. Bundle an attending sample (`web/data/attending-program.json`) and a way to
   switch sample programs (extend `/api/reset` or add `/api/switch-edition`).
6. Web tests for the new rule types + a live attending repair/swap demo.

## What NOT to change

The engine, validator independence, publish gate, share/projection, and the
trainee edition all stay exactly as they are. Attending is additive.

---
**Status at last checkpoint:** trainee edition complete + deployed
(atria-web-production.up.railway.app). Codex learnings #1–4,6 adopted. This doc is
the resume point for #5. See the memory note `physician-scheduling-product` for
Railway IDs and run commands.
