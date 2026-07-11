# Atria shared data contract (hackathon scope)

Source of truth for names and shapes crossing the web↔solver boundary. TypeScript (`web/lib/types.ts`) and pydantic (`solver/app/models.py`) mirror this exactly. ISO-8601 datetimes with timezone; dates as `YYYY-MM-DD`. IDs are short strings (`p_ana`, `slot_2026-08-03_cath_am`).

## Entities

### Person
```json
{ "id": "p_okafor", "name": "Adaeze Okafor", "level": "F2", "fte": 1.0,
  "eligibleServices": ["CATH", "ECHO", "CCU", "CONSULT", "EP", "CLINIC", "JEOP"],
  "clinicDay": "THU" }
```
`level`: F1|F2|F3 (fellowship). `clinicDay`: fixed weekly continuity-clinic half-day (COCATS §2 — hard weekly overlay).

### Service
```json
{ "id": "CATH", "name": "Cath Lab", "code": "CATH", "family": "procedural",
  "kind": "rotation", "coverage": { "minPerWeekday": 2, "minPerWeekendDay": 0 } }
```
`kind`: rotation (block-granular) | call (overnight) | clinic | jeopardy.
`family` (one of 6, drives hue): procedural | imaging | inpatient | consult | ambulatory | backup.

### Slot
One assignable unit of demand at any grain (§2 of spec: one object, every grain).
```json
{ "id": "slot_b3_cath_1", "serviceId": "CATH", "start": "2026-09-01T07:00:00-04:00",
  "end": "2026-09-28T17:00:00-04:00", "grain": "block", "roleIndex": 1 }
```
`grain`: block | week | day | call-night | halfday. Call-night slots for in-house call run 17:00→07:00 (+1d). `roleIndex` distinguishes multiple people needed on one service-interval.

### Assignment
```json
{ "id": "a_1042", "slotId": "slot_b3_cath_1", "personId": "p_okafor",
  "status": "published", "locked": false, "provenance": "solver",
  "createdInVersion": 3, "supersededInVersion": null }
```
`provenance`: solver | manual | swap | repair | import. Append-only; edits create a new row superseding the old.

### Absence
```json
{ "id": "abs_7", "personId": "p_okafor", "start": "2026-11-13", "end": "2026-11-15",
  "type": "sick", "reasonCode": "OPAQUE-01", "status": "approved" }
```
`type`: vacation | sick | leave | away | conference. Reason codes are opaque strings; never free text.

### Rule (typed DSL — the only thing Claude may emit)
```json
{ "id": "r_12", "type": "min_coverage", "params": { "serviceId": "CCU", "min": 1, "daily": true },
  "level": "hard", "tier": null, "scope": "all", "source": "excel:Sheet1!B4",
  "text": "CCU must always have one fellow on service.", "confirmed": true,
  "replay": { "violationsLastYear": 0 } }
```
`level`: hard | blocking (overridable with named waiver) | soft. `tier` (soft only): must | should | nice.
**Rule catalog (v1 types, closed set):** `min_coverage`, `max_consecutive_call`, `min_rest_after_call`, `one_in_seven_free`, `no_call_before_clinic`, `clinic_day_protected`, `block_requirement` (person needs N blocks of service S across the year — COCATS months), `max_service_gap`, `pair_exclusion`, `fixed_assignment` (do-not-move), `do_not_schedule` (inverse lock), `holiday_equity`, `call_spacing`, `weekend_equity`, `jeopardy_payback`.
ACGME rules (`min_rest_after_call` 14h, `one_in_seven_free` averaged/4wk with home-call exclusion, 24+4 via max shift length, q3 in-house call) are ALWAYS present in the validator regardless of this list.

### Lock
```json
{ "assignmentId": "a_1042", "by": "coordinator", "reason": "PD directive", "hard": true }
```

### ScheduleVersion
```json
{ "version": 4, "publishedAt": "...", "publishedBy": "coordinator", "parent": 3,
  "cause": { "kind": "repair", "absenceId": "abs_7" },
  "diff": { "changed": 3, "peopleTouched": 2, "violations": 0 },
  "inputHash": "sha256:...", "seed": 4711 }
```

## Solver API (FastAPI, :8000)

### POST /solve  (generate)
In: `{ people, services, slots, rules, locks, absences, seed?, timeBudgetSec? }` → Out: `{ assignments, objective: {tierScores}, feasible: true, seed, inputHash, telemetry }`
On infeasible: `{ feasible: false, conflicts: [{ ruleIds, text, relaxations: [{ description, cost }] }] }` — conflicts name user rules via assumption literals. NEVER the bare word "infeasible" in `text`.

### POST /repair
In: everything in /solve plus `{ baseAssignments, event: { kind: "absence", absenceId }, maxPeopleTouched?, maxCandidates: 3 }`
Out: `{ candidates: [{ assignments, diff: { changes: [{ slotId, from, to }], peopleTouched, disruptionScore }, explanation }] }`
Objective order (fixed): feasibility → disruption (notice-weighted changed person-days: <7d×10, <30d×4, else×1, + per-person charge) → equity → preferences. Locks + already-started slots are frozen. Candidates must be genuinely diverse (different people touched).

### POST /validate  (independent validator — separate module, no CP-SAT imports)
In: `{ people, services, slots, rules, assignments, absences }` → Out: `{ ok: boolean, violations: [{ ruleId|acgmeCode, severity: "block"|"warn", text, slotIds, personIds }] }`
Hard-coded ACGME checks run always: `ACGME-24+4`, `ACGME-REST-14H`, `ACGME-1IN7`, `ACGME-Q3-CALL`.

## Fixture: `fixtures/fellowship.json`
Cardiology fellowship, academic year 2026–27 (Jul 1–Jun 30): 15 fellows (5 F1/5 F2/5 F3), 13 four-week blocks, services CATH, ECHO, CCU, CONSULT, EP, NUC, RESEARCH, CLINIC (weekly half-day per fellow), overnight call pool (in-house, all fellows, q≥4 target), JEOP two-tier backup, ~8 rules incl. COCATS block requirements (F1: 2×CATH, 3×ECHO...), 2 locks, 1 pending November absence (the demo's sick event), holidays. Synthetic names only, generated deterministically (no Faker randomness without a fixed seed).
