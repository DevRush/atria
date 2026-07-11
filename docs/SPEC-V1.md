# Atria — v1 Product Specification
**Working name:** Atria (pending founder approval) · **Date:** 2026-07-11 · **Edition:** Trainee-first (R1)
**Inherits:** [DECISION-BRIEF.md](DECISION-BRIEF.md) (rulings R1–R8, convergent spine §1–10), [research/DOMAIN-FINDINGS.md](research/DOMAIN-FINDINGS.md) (verified constraints), [research/competitors/00-COMPETITIVE-SYNTHESIS.md](research/competitors/00-COMPETITIVE-SYNTHESIS.md) (verified landscape), `research/codex-deltas/` (adopted deltas). Q-codes cite the 500-question dossier.

## 0. Product statement

Atria is the living schedule for medicine. It turns a program's rules, people, and services into a published schedule that can be **generated, validated, explained, repaired with minimal disruption, and trusted at 3am**.

The promise, one sentence: *Change one fact, understand everything affected, compare valid minimal repairs, and publish one trustworthy current schedule.*

v1 ships the **Training edition** (residency/fellowship: blocks, call, jeopardy, clinic, ACGME, graduation requirements), with the **Attending edition** as a fast-follow skin on the same core. Group type is selected at workspace creation; it changes templates, rule packs, and vocabulary — never the engine (C2-Q3, A4-Q19).

**Verified market context:** no competitor in ~20 examined has minimal-disruption mid-year repair; rule configuration is everywhere a paid human service; mobile is universally burned (1.6–2.8★); the AI newcomers are concierge shops that punt the live layer to Amion. Repair + self-serve AI rule capture + a free always-current lookup page is an empty quadrant.

## 1. Users and surfaces

Three workspaces (Codex adoption #2), six lenses over one schedule (#7):

**Scheduler workspace** (coordinator, chief fellow/resident, designated admins) — the dense, keyboard-first cockpit:
1. **Grid** (Schedule Studio) — virtualized DOM, semantic zoom (year band → month codes → week detail), 40-person month on a 13″ laptop without scrolling, Excel-parity keybindings, drag-and-drop with live validation, every manual drop auto-locks (A1-Q1/Q8, A2-Q2/Q6).
2. **Repair** — the marquee surface: coverage event in → ≤3 ranked minimal-repair candidates → disruption meter → diff overlay (unchanged dims to 40%, changed cells split-chip old→new) → **disruption receipt** ("3 of 1,240 changed · 2 people · 0 violations") (A1-Q11, A2-Q20, E3-Q13).
3. **Requests & swaps** — typed requests with deadline windows; directed rule-checked swaps, auto-approved when rule-clean (C3-Q3/Q16, A2-Q9).
4. **Rules** — the rule catalog: sentence-shaped cards with provenance, hard/soft/overridable level, effective dates, replay evidence, tests (C2-Q13; Lightning Bolt "editable sentences" precedent).
5. **Fairness ledger** — one table: weighted points, FTE-prorated targets, variance metric, holiday memory; every number explainable (D1-Q5/Q6; Montefiore variance-of-points precedent).
6. **Requirements board** (trainee v1) — per-fellow COCATS/graduation accrual: months + procedure counts, completed vs projected, "short 2 months of echo with 8 blocks left" (C1-Q7; verified COCATS math).

**Clinician surface** (fellows/residents; attendings later) — zero-training PWA: my next obligation, my week/month, who's on now, request time off, propose/accept swap, acknowledge urgent changes, my ledger. Four actions, no cockpit leakage (A2-Q12). Read-only grid on mobile, and it says so (A1-Q14).

**Leadership workspace** (PD/APD/chair) — coverage resilience, structural staffing deficits stated with arithmetic, schedule stability and callout-recovery time, denied-request patterns, one-screen ACGME compliance summary with export (Codex #2; C1-Q7; A3-Q8's four reports).

**The public read path** — who's-on-call: CDN-served static artifacts, zero runtime dependency on app/DB/solver, chaos-tested, <50KB, no login (org-scoped capability URLs; pager/operator numbers only, never personal cells), offline-cached with staleness stamp (A4-Q20, A5-Q3/Q4, C5-Q16).

## 2. Domain model

Narrative frame: **the schedule is a stack, not a calendar** — obligation, eligibility, allocation, coverage, call, recovery, change, evidence (Codex #3). One schedule graph, many views.

**Core entities** (C2 lane, Codex blueprint §7, deltas):
- **Organization / Unit** — tenant boundary; unit-scoped calendars (academic year), holiday lists, policies.
- **Person** — durable identity (personal email anchor + institutional alias); multiple dated **Memberships** (unit, role, PGY/level, FTE); fairness scoped to membership, **safety limits scoped to person across memberships** (moonlighting — C2-Q7). Away rotator = short-dated narrow membership (C2-Q8). **Eligibility is a dated competency graph** (WashU delta): capabilities carry effective dates and prerequisites, not static PGY labels.
- **Service / Coverage requirement** — demand definition: service, interval, role, min/ideal staffing, capability mix, supervision mix, escalation (Codex #4). Coverage may be **worklist/queue ownership**, not location presence (Codex #5).
- **Slot** — one object at every grain (rotation block, shift, call night, clinic session; duration/type/rules vary, schema doesn't — C2-Q3). Templates store recurrence + IANA timezone; slots materialize to a rolling ~13-month horizon; overnight call belongs to two display days (C2-Q15, A1-Q7, A4-Q13).
- **Assignment** — the sole atomic editable unit (person × slot, with status, cause, location, burden value, provenance). Append-only, version-scoped rows (`created_in_version` / `superseded_in_version`) (C2-Q2, A4-Q6).
- **Absence** — first-class typed object with state machine; triggers repair, never deletes; reasons stored as opaque role-gated codes, excluded from AI processing and calendar sync (C2-Q11, A5-Q10, D5-Q15).
- **Swap** — entity with lifecycle: proposal → frozen rule-check → approval chain → serialized commit with CAS + re-validation (C2-Q12, A4-Q11, D2-Q16).
- **Rule** — typed data record: catalog type + params + scope + level (see §3) + weight tier + effective dates + provenance + tests. Catalog is versioned code shipped for everyone; **zero per-customer code, ever** (C2-Q13, C5-Q8).
- **Lock** — pin on an assignment (by/at/reason, hard/soft); unconditionally solver-hard; survives every re-solve; priced, never overridden (C2-Q18, D1-Q10).
- **Schedule version** — immutable, content-addressed publish snapshots; exactly one published head per scope; drafts are branches; bitemporal (valid + transaction time); as-of queries; fork-capable for the phase-2 sandbox (D2-Q3/Q14, B1-Q12).
- **Fairness ledger** — derived, never stored (two exceptions: publish snapshots, signed carry-over rows); weights versioned and effective-dated (C2-Q19).
- **Jeopardy** — first-class rotation with tier attribute; tier objects carry response radius/time, conversion notice, travel rules, configurable activation-payback rules (verified: CU 45-min/24h/3:1; Morehouse points ledger) (A3-Q20, C2-Q20, DOMAIN-FINDINGS §3).
- **Person scheduling profile** — **min/target/max** per burden category (min=contractual, target=fairness objective, max=protection cap; unset allowed) (Codex delta).
- **Period-boundary context** — prior/next-period assignments are first-class solver inputs; spacing/consecutive/rolling-window rules evaluate across boundaries (Codex delta; generalizes ACGME windows).
- **Event ledger** — every action (create/edit/lock/approve/override/solve/publish/notify/ack) with actor + audit metadata; publication-to-effect intervals, denial reasons, repair timings — powers the Schedule Health Report and renewal receipts (E1-Q12).

**Separations that must never blur:** scheduled vs as-worked (retroactive corrections are the only sanctioned contact — C3-Q20); availability effect vs private reason; assignment vs coverage requirement; draft vs published; rule vs exception; eligibility vs preference; internal truth vs exported projection.

## 3. Rules and solver

**Three-level hardness (R7):** (1) solver-infeasible — tiny set: coverage, credentialing/eligibility, approved leave, locks; (2) publish-blocking-but-overridable — regulatory (ACGME duty hours, CBA terms): a named human's typed waiver is required and becomes the compliance artifact; (3) soft — everything else, in fixed lexicographic tiers (Must/Should/Nice). Hardness is carried by request *type* with scarce priority tokens; only coordinators promote, with feasibility cost shown (D1-Q3/Q4, C3-Q5, D5-Q1).

**Solver:** CP-SAT (OR-Tools). Fixed lexicographic objective order — coverage/regulatory → disruption (repair only) → equity band (±) → preferences. Programs reorder tiers, never tune numeric weights (A4-Q16, D1-Q11). Every user-facing rule compiles with a **named assumption literal**; infeasibility renders as a minimal plain-language conflict set with ≤3 ranked one-click relaxations and visible blast radius. The word "infeasible" is banned from the UI (D1-Q1/Q2, E2-Q19). Anytime solving with streamed telemetry and stop-keep-best (A1-Q9). Bit-for-bit reproducibility: pinned input hash, rule-set version, solver build, seed (recorded in version metadata — tie-break randomization allowed only via persisted seed); approved proposals are content-hashed and "apply" applies that hash or fails (D1-Q12, D2-Q15, E4-Q15).

**Repair mode (the product):** lexicographic — satisfy new facts → minimize disruption → fairness → preferences. Disruption = notice-weighted changed person-days (<7d ≈ 10×, <30d ≈ 4×) × burden class × already-notified flag + per-person-touched charge + hard "touch ≤N people" cap. LNS around the incumbent; warm starts; repaired assignments get 30-day soft pins; urgent holes (<72h) solve immediately (p95 <10s), else 24h debounce. Repair never auto-commits: diff preview → named human acceptor → disruption receipt. Regeneration is explicit escalation at >~15% changes (D1-Q8/Q9/Q15, C3-Q10, A4-Q2/Q3). Ledger position orders absorption; quarterly rebalance spends an explicit disruption budget to repay equity debt (D3-Q13, D1-Q16).

**The independent validator (the trust keystone):** a deterministic rule-checker on a separate code path — no OR-Tools dependency — re-verifies every schedule at publish, on every amendment (including 2am break-glass edits), and nightly across all published schedules. Coverage failures are unpublishable blocks. Hard-coded ACGME validators (24+4; 14h post-call; 1-in-7 averaged with home-call exclusion; q3 in-house averaged; home call as a distinct class) run regardless of captured rules. **This validator + the constraint-DSL spec are the open-source components (R2).** (A4-Q5, A5-Q16, D5-Q17, E2-Q12; DOMAIN-FINDINGS §1.)

**⚠ Before encoding the 80-hour rule:** re-verify its exact 2026 scope (home clinical work, moonlighting, suspended §6.24 exception) — the naive framing was refuted in verification.

**Fairness engine:** FTE-prorated weighted point targets (pool formula per the deployed-MIP literature), leximin objective, academic-year horizon, 50% annual decay, cohort-median entry for new hires, multi-year holiday memory (kept even under the onboarding **amnesty line**: balances zero at go-live by default, history informs rules and holiday rotation only) (D1-Q5/Q6, D3-Q19). Seniority only as an explicit, visible, group-adopted multiplier (D3-Q6). Religious accommodations are zero-point hard unavailabilities (D3-Q14). Variance-of-points is the shipped equity display metric. Visibility is per-unit governance: trainee default = own ledger + anonymized percentiles; attending default = group-visible (R6).

## 4. AI pipeline — "LLM proposes, solver disposes"

Structural topology, not policy: draft surfaces (extraction, interview, intent parsing, explanation translation) may use the LLM; commit surfaces (published schedules, coverage, who's-on-call) are physically unreachable by LLM output (B3-Q9, E4-Q16).

1. **Import:** deterministic pre-parse (unmerge, layout grammar, PII strip before any model call) → LLM proposes entity/column mapping → human confirms in mapping UI → unmappable cells go to an explicit "cells I couldn't read" queue (A4-Q14, A5-Q14, B3-Q8, A2-Q15). Import ≥12 months of history — it back-tests rules AND seeds fairness counters.
2. **Rule capture:** LLM emits into the closed typed constraint DSL only. Each rule = paired artifact (plain-English sentence + typed record + provenance to source cell/phrase). **Replay against the program's own history is the confirmation UI** ("violated 14× last year — wrong rule or known exceptions?"). Zero unconfirmed rules reach the solver; ambiguous rules force single-item review; "rules I did NOT find" checklist; coverage-lint backstop with mandatory jeopardy-tier fields (B3-Q1, D1-Q17, E4-Q2/Q4/Q7). Interview mode asks targeted questions mined from historical patterns, labeled "pattern — confirm or reject" (B3-Q2). Ingest incumbents' rule vocabulary (Amion/LB/ByteBloc terms) so captured rules read native to switchers.
3. **Explanation:** derived from solver artifacts (unsat cores, binding constraints, counterfactuals); LLM translates only; explanation-faithfulness is a CI gate; peer-facing counterfactuals anonymized (D1-Q13, E4-Q13, B3-Q7).
4. **Steady state requires zero LLM calls**; every NL flow has a structured-form equivalent; global AI-off switch; pinned model versions; correction-derived eval suite gates upgrades; jargon lexicon (q4, golden weekend, jeopardy…) with forced disambiguation chips (E4-Q10, B3-Q10/Q17/Q19).

## 5. Lifecycle, notifications, concurrency

- **Lifecycle:** Collecting → Draft → In Review → Published → Archived; skippable forward, never backward; amendments-in-place with attributed diffs; no un-publish (C3-Q1/Q2). Rolling firmness: firm N months repair-only, provisional badged remainder (C3-Q9). Rollover is a guided workflow: clone structure, re-confirm every rule, ledger decay, graduation credit never decays; July 1 succession (PGY flips, offboarding, chief handoff with surviving rule ownership) is a first-class flow (C3-Q19, C1-Q6, Codex delta).
- **Notifications:** calendar sync is the primary channel; push/SMS only for <72h changes and jeopardy activation; **delivery + acknowledgment ledger** (outbox pattern, retries, per-person receipts, escalation-to-phone-call task; coordinator sees who hasn't acked). KPI: <3 interrupts/clinician/month. Calendars are one-way projections with stable UIDs; drift is detected and healed (A2-Q8, D2-Q4/Q6, C3-Q18).
- **Concurrency (R5):** single-writer draft editing with visible presence and handoff; solver proposals pin input versions and rebase over human edits (human wins; conflicts block publish with two one-click resolutions); swap commits serialize with CAS + re-validation. CRDT rejected (A4-Q8, A2-Q14, D2-Q1/Q2).
- **Emergency flows:** break-glass direct assignment always works for coordinator+ (rules warn, never block; flags queue for morning). Jeopardy activation: one tap → directory/calendar flip on ack → shallow 72h repair, deep cascade deferred to morning ("instant and shallow at night"). The bereavement flow — mark unavailable → 3 repair options → publish — in under two minutes from a phone, is designed and demoed first (A2-Q10, A3-Q20, E5-Q10). Degraded mode: ranked substitute list renders into the static read path so 5:40am works when the app doesn't (C batch ruling).

## 6. Visual and interaction design (the Apple/Palantir bar)

Density IS the polish: strong table geometry, ~26–30px rows, tabular numerals, low corner radius, rare shadows (A1-Q8; corpus design direction). Hue = six locked assignment families; lightness = siblings; **text short-codes are the identity carrier** (required first-class data per rotation); color never sole carrier, CVD-validated in CI against design tokens (A1-Q2/Q3/Q6). Severity budget: red only for publish-blocking violations; soft warnings in a gutter rail; nothing pulses (A1-Q12). One provenance glyph max per cell; detail in the inspector (A1-Q13). Scaffolding (weekends/holidays) may claim luminance and line weight only (A1-Q18). Server-side PDF/Excel renderer reproduces the program's wall-printout format — acceptance test: survives two photocopies; every export stamped with version + QR validity check (A1-Q5, E5-Q6, D2-Q8). Every grid has a list/agenda equivalent; WCAG 2.2 AA on list surfaces at launch; keyboard-first editing path documented (A1-Q16, D4-Q20). Dark mode: second hand-calibrated palette; print always light (A1-Q4).

## 7. Platform architecture

Modular monolith + isolated solver worker (Codex #11): `identity / workforce / scheduling / policy / optimization / workflow / communication / integration / audit`. Postgres with RLS as the tenant boundary + merge-blocking cross-tenant probe suite (A4-Q9). Event-sourced core scoped sanely: append-only assignment/event tables + immutable version snapshots — not a CQRS framework (Codex guard). Async job API: `POST /solves` → 202 + SSE; solve materializes a draft; publish is a separate explicit call; idempotency keys on every mutation; version-addressed reads (A4-Q10). Web app = PWA; offline reads cached with staleness banner; write intents queue and re-validate on reconnect; coordinator grid edits online-only (D2-Q17). Read path: static artifacts to dual-provider object storage behind CDN; read RTO <5min / write RTO 4h / RPO 5min; SLO 99.95 read / 99.9 app, published (D2-Q13, A5-Q6). Auth: passkeys + magic links; mandatory MFA for edit/publish roles; step-up on publish/mass-edit; SAML via broker when demanded, never hand-rolled (A5-Q1/Q15). RBAC grants scoped (org, unit, academic year) with June-30 auto-expiry; self-approval blocked at policy layer (A5-Q2). 7-year append-only retention; per-tenant PITR; quarterly restore drills (A5-Q6, D5-Q13/Q14).

## 8. Integrations and coexistence (v1)

Per-person ICS feeds (day one) · **publish-to-Amion** export + re-upload checklist · **publish-to-MedHub/New Innovations** compliance feeds (they invite third-party schedules; they keep reporting custody until trust flips — note: NI is QGenda-owned since Jul 2025, so expect this door to narrow; build the export before it does) · CSV everywhere · layout-learning Excel export. Never in v1: EHR, payroll, bidirectional sync, paging integration (v2 with a design-partner hospital).

## 9. Onboarding and adoption

Value before configuration: upload Excel → hosted, shareable, synced schedule in the same session; 45-min TTFV managed at P90; rules confirmed incrementally over days; first draft schedule within 2 weeks (A2-Q1/Q15). Mirror-first: reproduce their exact grid before improving anything (E3-Q7). Amnesty line at go-live. Mid-year onboarding = locked-baseline import + repair-mode takeover (C5-Q17). Concierge for the first ~10 programs (founder-attended; it's the training corpus); zero training for clinicians by definition; 2×45min for coordinators; chief-handoff flow ships v1 (C4-Q17, C5-Q2/Q18, C1-Q6). Publish the onboarding budget publicly as anti-QGenda positioning ("live in two weeks, no implementation fee" vs their $10k/multi-month).

## 10. Metrics, pilots, season

North star: **% of pilot programs whose working schedule still lives in Atria at 6 months** (>80% = system of record; <50% = thesis dead), with weekly repair usage as the tell (E3-Q18). Product metrics: time-to-published, repair-diff size, swap cycle time, schedule truthfulness (staleness vs reality), sync accuracy, lookup latency, confirmed-rules-per-hour vs manual (kill signal if AI capture loses — E4-Q17). Pilot: 90 days free, January-block anchor, written success criteria (schedule accepted ≤3 cycles, coordinator time −50%, ≥1 live repair), day-75 decision, old system dormant one cycle (R8). Season: cap 8–10 trainee onboardings/season, intake closes March, feature freeze May 15–Jul 15, swap-flow hardening in May (C5-Q6/Q9). Kill criteria stand as written in the brief (E3-Q20, B5-Q20).

## 11. Build phases (trainee-first)

- **Phase 0 — design partners (2–4 wks):** founder's own fellowship as user #1 (coordinator + chief fellow); 3–5 cardiology fellowship partners recruited; de-identified schedules + one real disruption each; vocabulary normalization.
- **Phase 1 — truthful schedule foundation (4–6 wks):** org/people/memberships/services/slots/assignments/versions; importer + mapping UI + ambiguity queue; grid/people/personal views; independent validator + publish gate; ICS/CSV/PDF out; audit; static read path.
- **Phase 2 — repair vertical slice (4–6 wks):** coverage events; eligibility filtering; CP-SAT generate + LNS repair; ≤3 ranked candidates; diff + disruption receipt; approval + publish; notification/ack ledger. *Demo: published fellowship month → fellow out Fri–Sun → uncovered call found → three candidates → receipt → publish.*
- **Phase 3 — requests, swaps, fairness, requirements (4–6 wks):** typed requests + windows; rule-checked directed swaps with auto-approve; fairness ledger + holiday memory + amnesty; requirements board (COCATS accrual); jeopardy tiers + activation flow.
- **Phase 4 — AI rule capture + pilot hardening (4–8 wks):** extraction → replay confirmation → interview mode; eval harness; permissions hardening; accessibility; print/wall exports; backup/restore drills; performance CI (solve budgets, grid 60fps); pilot playbooks.
- **Phase 5 — attending edition proof:** seniority multipliers, contractual FTE/clinic templates, comp-formula weight mapping, service-line templates — after trainee validation, sold through the same division chiefs.

**v1 cut list (recorded, not re-litigated):** the brief's never-list stands; plus no marketplace, no native apps, no sandbox UI (schema ready), no widget (post-first-building), no paging integration, no enterprise SSO/SCIM until demanded.

## 12. Test corpus

Ten synthetic fixtures (Codex #9, trainee-first ordering): IM program with 2-week X+Y + continuity clinic + night float + jeopardy + leave + graduation totals; cardiology fellowship with COCATS counters + clinic collisions; cardiology attending group (6 services, 5 call pools, 2 hospitals); hospitalist 7-on/7-off + variable FTE; EM demand-matched shifts; pediatric week-long backup + coverage-credit ledger; surgery junior/senior composition + home/in-house call; anesthesia release order; radiology worklists; mid-year leave repair with auditable diff. Plus the 90-artifact public corpus as importer tests — flagships: ECU cardiology #062 (v1 flagship), Morehouse #016 (jeopardy ledger), McGovern #002 (mixed blocks), UF-Jax #057, Houston Methodist #046 (verify URLs, mirror locally). DST fixtures; adversarial spreadsheets (merged cells, color-as-data, footnotes).

## 13. Open items

1. **Name:** "Atria" pending founder approval → then domain, "Built with Atria" footer, design language.
2. **Design-partner list:** 5 named cardiology fellowship programs, starting with the founder's own.
3. **80-hour rule scope:** re-verify before encoding (§3).
4. **Tech stack selection** (framework, hosting, DB provider) — deliberately deferred to the implementation plan; the architecture above constrains but does not name vendors.
