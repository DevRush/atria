# Codex-learnings ledger

A parallel build ("Atria"/"Atrium") of this same product was made by Codex. This
is the honest accounting of what we took, what we already had, what we are
building, and what we consciously declined — audited by reading their product
docs (blueprint, two pilot-readiness reviews, full re-review, 500-question audit,
attending spec) **and** their engine/validator/import/publication/share code, then
diffing against our tree.

Legend: **weight** HIGH / MED / LOW (to a hackathon-judged, trust-first product) ·
**status** ✅ adopted · 🔨 building now · 📋 planned · ⏸ deferred (out of scope) ·
🚫 declined (with reason).

---

## Already ours (verified in-tree, equal or stronger)

These are Codex principles we independently shipped; several are *stronger* on our
side. Not action items — recorded so the ledger is complete and honest.

| Learning | Where in our tree |
|---|---|
| ✅ Independent validator, separate code path from the generator | `solver/app/validator.py` (no OR-Tools import; enforced by test) |
| ✅ Server-side validation as an un-bypassable publish gate, fail-closed | `web/app/api/publish/route.ts` |
| ✅ Minimal-disruption repair anchored to the published schedule | `solver` repair + `RepairFlow.tsx` |
| ✅ Repair returns only strictly-valid candidates (never a false "safe") | repair candidates re-validated before return |
| ✅ Disruption receipt / before→after diff on every change | `DisruptionReceipt` in `RepairFlow.tsx` |
| ✅ Locks as an engine primitive; baseline stability | `Lock` model; solver honors locks |
| ✅ Lexicographic rule tiers; hard vs. weighted-soft separation | `solver/app/solver.py` tier weights |
| ✅ Deterministic reproducibility (seed + single worker + PYTHONHASHSEED) | solver params; `seed`/`inputHash` on versions |
| ✅ Multiple ranked candidates, not one answer | repair returns up to 3 |
| ✅ Infeasibility explained via named assumption literals + relaxations (never "infeasible") | **stronger than Codex** — real CP-SAT unsat cores vs. their greedy engine |
| ✅ LLM never in the correctness path | engine owns correctness; LLM only maps/drafts/explains |
| ✅ Import-first onboarding (upload your current schedule) | `web/app/import` + `import-parse.ts` |
| ✅ Materialized public projection from an explicit allowlist | `web/lib/projection.ts` |
| ✅ Projection privacy boundary (no PHI, no IDs, name abbreviation) | `projection.ts` (`A. Okafor`) |
| ✅ Bearer-link share security: 256-bit secret, SHA-256 at rest, generic unavailable page, noindex/no-referrer | `web/lib/share.ts`, `web/app/p/[token]` |
| ✅ Immutable append-only versions with parent chain, diff, inputHash, seed | `ScheduleVersion` |
| ✅ Append-only audit log for consequential actions | `ScheduleEvent` |
| ✅ Rules as first-class typed objects with level/tier/scope/source | `Rule` model + rule catalog |
| ✅ Structural shortages stay visible (never disguised as optimization success) | coverage-gap surfacing |
| ✅ Configurable rule hardness (blocking vs. advisory) | `RuleLevelToggle.tsx` + `PATCH /api/rules` |
| ✅ Reason-code-only absences (no free-text PHI) | `Absence.reasonCode` |
| ✅ Rate limiting on all routes | `web/lib/ratelimit.ts` (Codex has none) |
| ✅ Shared attending/trainee domain model, distinct policy layers | edition system, one CP-SAT core |
| ✅ Open-source foundation (Apache-2.0, README/ARCH/SECURITY/CONTRIBUTING/ROADMAP) | repo root |

---

## Gaps we are acting on

Ordered by build priority. Rationale: correctness/honesty bugs first (things we
*claim* but don't do), then tamper-evidence & separation-of-duties, then
judged-demo features, then robustness.

### Tier 1 — correctness & honesty (a claim the product doesn't currently keep)

- ✅ **HIGH · Holiday equity was a silent no-op — FIXED & DEPLOYED (2026-07-12).**
  We shipped a `holiday_equity` rule, a holiday fairness column, and an objective
  whose docstring claimed to spread holiday call — but the solver ran
  `holiday_dates = set()` (empty), the request schema had no `holidays` field,
  the validator had no holiday check, and the fairness ledger hardcoded
  `new Set()`, while the holiday data sat unused in the bundle. Now threaded
  end-to-end: `Holiday` model → `getState` → request builders → solver
  `_equity_objective` holiday-spread term → Fairness page **Holiday** column, with
  a regression test asserting `holiday_dates` is populated. *(readers A#28/#63,
  code#1.)*
- ✅ **LOW · Validator provenance stamp — DONE.** The validator now reports
  `validatorVersion`; publish persists it plus `validatedAt` on the stored
  validation receipt so the verdict is independently auditable ("which validator,
  when"). *(code#8.)*
- ✅ **MED · Honest sample-data labeling — DONE & DEPLOYED (2026-07-12).** A
  header "Sample data" chip shows while the loaded program is the illustrative
  sample, driven by a real seed-vs-import marker (append-only `ScheduleEvent`:
  seed→"seed", import→"import"); `getState` reports `dataSource` and the chip
  clears once a real schedule is imported. The public share surface was already
  appropriately labeled (version/timestamp/"may be out of date"/hash) and
  deliberately does not hardcode "sample." *(reader A#59.)*

### Tier 2 — tamper-evidence & separation of duties

- ✅ **HIGH · Immutable projection snapshot + content-hash verify-on-read — DONE
  & DEPLOYED (2026-07-12).** Every published version freezes its allowlisted
  projection into a `PublicProjection` row (payload + `contentHash`), written at
  publish and at seed. The `/p` route reads the frozen artifact and re-hashes it
  on read — a mismatch renders the generic unavailable page, never the tampered
  data. `hashProjectionBody`/`verifyStoredProjection` single-source the hashing;
  test proves a tampered name or swapped hash fails. Verified live via a real
  share link. *(readers A#25/#59, code#2.)*
- 📋 **MED · Approval-before-publish (separation of duties).** Add a review/approve
  checkpoint distinct from publish, each capturing a human justification note.
  Achievable single-tenant via `reviewedBy` + an `approved` state, without full
  RBAC. *(readers A#22/#33, code#3.)*

### Tier 3 — judged-demo features

- ✅ **MED · Assignment inspector / constraint trace — DONE & DEPLOYED
  (2026-07-12).** Inspect mode on the grid: click any assignment → *why this
  holder* (eligibility/privileges, continuity clinic, lock), who else could cover
  (eligible, with the swap it causes + call/weekend/holiday load), and who's ruled
  out with a concrete reason (not credentialed/privileged, or on approved leave).
  Pure client compute (`lib/inspect.ts`), edition-aware wording, 4 unit tests.
  Verified: attending EP shows 12 ruled out for lacking privileges. *(readers
  A#19/#48.)*
- ◐ **MED · Export + calendar suite — CSV + ICS DONE & DEPLOYED (2026-07-12).**
  Header Export menu → CSV (formula-injection-neutralized, RFC-4180) and ICS
  (RFC-5545, timed call nights + all-day rotations, per-person filter). Remaining:
  a version-stamped **grayscale print view** (browser print-to-PDF, no PDF lib)
  and a *revocable-token* ICS feed (today it's an authenticated download).
  *(readers A#60/#76, code#4.)*

### Tier 4 — robustness

- 📋 **MED · Cross-period boundary continuity (`priorAssignments`).** Feed the
  prior period's final call/service dates so call-spacing and consecutive limits
  hold across a month/year boundary — matters most on incremental repair
  re-solves. *(reader A#46, code#6.)*
- ◐ **MED · Import hardening — size/type cap DONE (2026-07-12).** `/api/import/parse`
  enforces a 4 MB cap (413) and `.xlsx/.xlsm` type check (415) before buffering.
  Remaining: per-row eligibility/availability/duplicate flags on the confirm
  screen, downloadable template, CSV path. *(readers A#14–16/#54, code#4/#5.)*
- ✅ **MED · Emergency read-only / offline roster — DONE & DEPLOYED (2026-07-12).**
  Standalone grayscale `/print` roster (Export → "Print / offline roster"):
  print-to-PDF or save-page for an offline copy, monochrome/border-driven, call
  roster + block grid, stamped with version + generation timestamp + "a saved copy
  may be out of date." *(reader A#40, + grayscale print from A#42/#76.)*
- 📋 **LOW · Per-slot burden weight.** Weight fairness by burden (a call night ≠
  a clinic half-day), not raw count. *(reader A#29, code#9.)*
- ⚠️ **MED · Attending min/target/max + FTE-weighted fairness — SOLVER WORK,
  needs bundle regeneration + user validation.** Prototyped an FTE-prorated
  fairness target view (per-call-domain proration; math verified — targets sum to
  total call) and it exposed that the attending bundle spreads call by **headcount,
  not FTE** (a 1.0-FTE attending sits ~30 calls *below* its FTE-fair share, a
  0.5-FTE ~23 *above*). Shipping the view alone would advertise our own schedule as
  FTE-unfair, so it was reverted. The correct fix is to FTE-weight the solver's
  equity objective (and add min=obligation/target=soft/max=cap), then **regenerate
  the attending bundle and re-patch the repair-demo absence** — a solver change
  that alters the demo, so it should be done with the user watching, not unattended.
  *(reader A#45, code#9.)*

---

## Consciously deferred (out of hackathon scope)

- ⏸ **Multi-tenant organizations + full RBAC.** Codex is multi-tenant
  (orgs/memberships/roles). We extract only *role separation* (edit vs. approve
  vs. publish vs. view) + actor-role in the audit log — see Tier 2. Full
  tenancy/SSO/SCIM is enterprise-sale, not pilot. *(readers A#32–34, code#7.)*
- ⏸ **Notification outbox + acknowledgment ledger.** Real delivery/retry/ack
  infrastructure. Valuable but a whole subsystem; on ROADMAP "Next". *(reader A#31.)*
- ⏸ **Semantic zoom / large-schedule virtualization.** Year/month/week/day
  level-of-detail + virtualized 52-week × 200-person rendering. *(readers A#68/#69.)*
- ⏸ **Backtest against a real de-identified historical schedule.** The single
  most valuable *validation* artifact per Codex, but needs real data we don't
  have. On ROADMAP. *(readers A#49/#78/#79.)*
- ⏸ **Enterprise-readiness checklist** (SSO/SCIM, SOC 2, pen test, VPAT, BC/DR).
  Pre-sale, not pre-pilot. *(reader A#82.)*

---

*Audited 2026-07-11. Both source readers grounded in Codex files under
`/Users/annasr/Documents/Codex/2026-07-10/i-want-to-make-a-piece/`.*
