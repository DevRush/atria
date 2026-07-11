# Decision Brief — Physician Scheduling Product
**Date:** 2026-07-10
**Sources:** 500-question dossier (`questions/00-FULL-DOSSIER.md`, 25 lanes) triaged by five batch synthesizers (`questions/synthesis-A..E.md`). Q-codes below trace to the dossier. Competitor deep-research report pending; it will be integrated as an addendum.

**How this was weighted.** Every answer was triaged: (1) build-shaping, (2) trust-critical, (3) adoption-deciding, (4) risk register, (5) parked, (6) noise. What follows is not a summary of 500 answers — it is the residue: the decisions that survived weighting, the contradictions resolved with explicit rulings, and the handful of calls only the founder can make.

---

## Part 1 — The convergent spine (decided; near-unanimous across independent lanes)

These emerged independently from multiple interrogation angles. Treat them as the product's constitution.

### 1. Repair is the product. Generation is the demo.
Generation is episodic (twice a year); mid-year repair is the weekly wound (B5-Q1, C1-Q11, B2-Q20). The single most important user moment is the first successful 90-second repair after a sick call (C1-Q11). Repair quality outranks every feature on every list — one botched Christmas reshuffle reverts the coordinator to Excel and the story outruns marketing in GME's gossipy world (B2-Q20). Engineering priority order: repair correctness → repair explainability → everything else.

### 2. The data model is event-sourced, append-only, and versioned — this is the one decision everything else sits on.
Assignment (person × slot) is the sole atomic editable unit (C2-Q2). One slot object at every grain — rotation, shift, call night differ in duration/type, never in schema — which is what makes "one solver core, two products" true (C2-Q3). Published versions are immutable, content-addressed snapshots in an append-only chain; exactly one published head; drafts are branches (D2-Q3, A4-Q6). Absence is a first-class input that triggers repair, never a deletion (A4-Q6, C2-Q11). Bitemporal (valid + transaction time): "show me the schedule as Dr. Patel saw it March 3 at 9am" is a first-class query (D2-Q14, A4-Q7). Repair, diffs, undo, audit, legal defense, and per-tenant restore all inherit from this or can't exist.

### 3. Solver: CP-SAT, lexicographic tiers, assumption literals, anytime, reproducible.
- CP-SAT (OR-Tools): feasibility-heavy logic fits CP natively; unsat cores enable explainability; Apache license keeps open-core options alive (A4-Q1, D1-Q20).
- Fixed lexicographic order, never numeric weight elicitation: coverage/regulatory (hard) → disruption (repair only) → equity band → preferences (A4-Q16, D1-Q4, D1-Q11). Programs reorder tiers, never tune raw weights.
- Every user-facing rule compiles with a named assumption literal so infeasibility maps back to the rules that caused it — a compiler property, unretrofittable, and the entire differentiation against black-box incumbents (D1-Q1, E2-Q19).
- The word "INFEASIBLE" is banned from the UI. Conflicts render as a minimal plain-language conflict set plus ranked one-click relaxations with visible blast radius ("three ways to make this possible, sorted by pain") (D1-Q2, C3-Q8, E2-Q19).
- The hard-constraint set is tiny (coverage, credentialing, duty hours, approved leave, locks); everything else is soft. Hardness is carried by request *type*, with scarce priority tokens and coordinator-only promotion showing feasibility cost — the intake design that prevents the infeasibility death spiral (D1-Q3, C3-Q5).
- Seed-pinned, input-hashed, bit-for-bit reproducible publish-grade solves. "The solver is stochastic" is not an answer in a grievance (D1-Q12, E4-Q15).
- Anytime solving with real streamed telemetry and genuine stop-and-keep-best (A1-Q9). Budgets: repair p95 <30s (target 10s for urgent holes), full-year generate <5min (A4-Q3, D1-Q15).

### 4. Repair mode, precisely specified.
Lexicographic: (1) satisfy new facts, (2) minimize disruption, (3) fairness, (4) preferences (C3-Q10, D1-Q8). Disruption = notice-weighted changed person-days (changes <7d out ~10×) + per-person-touched fixed charge + hard "touch at most N people" cap even when mathematically worse (A4-Q2, D1-Q8, D3-Q17). Repaired assignments get 30-day soft pins against thrash (D1-Q15). Repair never auto-commits — always a diff preview and a named human acceptor, resisting any enterprise pressure to change this (B5-Q19). The output artifact is the **disruption receipt**: "3 of 1,240 assignments changed · 2 people affected · 0 violations" — the product's proof-of-work, persisted in history (A1-Q11). Regeneration is an explicit escalation (>~15% changes), never a default (D1-Q9).

### 5. An independent validator gates every publish. Safety never depends on solver correctness.
A deterministic rule-checker on a separate code path (no OR-Tools dependency, ideally open-sourced — see Ruling R2) re-verifies every schedule at publish and on every amendment, including hand-built and 2am-emergency edits; no bypass exists, because the pressured edit is when the hole gets introduced (A4-Q5, A5-Q16, D5-Q17). Coverage failures are unpublishable blocks, not warnings (E5-Q20). A nightly sentinel re-validates all published schedules (D5-Q17). Hard-coded deterministic ACGME validators (80h/4wk rolling windows crossing publication boundaries, 1-in-7 averaged, rest minimums) run on every trainee schedule regardless of what rules were captured; violations block publication without a named PD's typed override, which is itself the compliance artifact (E2-Q12, D5-Q1, D1-Q14).

### 6. "LLM proposes, solver disposes" — the AI topology is structural, not policy.
Draft surfaces (extraction, interview, phrasing, intent parsing) may err under human review; commit surfaces (published schedules, coverage, who's-on-call) structurally exclude the LLM — nothing an LLM emits can write to them (B3-Q9, E4-Q16). The LLM emits into a closed, typed constraint DSL — worst case is a wrong rule, never arbitrary behavior (A5-Q16, E4-Q16). **Replay-against-history is the confirmation UI**: every AI-drafted rule is replayed against 12+ months of the program's own imported schedules ("this rule was violated 14 times last year — wrong rule, or known exceptions?"); zero unconfirmed rules reach the solver; no bulk confirm on ambiguous rules (B3-Q1, D1-Q17, E4-Q2/Q7). History import doubles as fairness-ledger seeding — without it the first generated schedule feels arbitrary and loses the room (A4-Q14). Deterministic backstops beneath the LLM: coverage-checklist lint with mandatory jeopardy-tier fields, structural diff flagging disappeared concepts, and an explicit "rules I did NOT find" list (E4-Q4). Explanations are derived from solver artifacts (unsat cores, binding constraints) and only *translated* by the LLM; explanation-faithfulness is a CI gate; confabulated fairness reasoning is the fastest trust-killer (B3-Q7, D1-Q13, E4-Q13). Steady-state operation requires zero LLM calls; every NL flow has a full structured-form equivalent (E4-Q10). No fine-tuning — corrections become regression tests, not weights (B3-Q11). Pinned model versions; the eval suite gates upgrades (B3-Q19, E4-Q19).

### 7. The read path is a separate product with a separate failure domain.
Who's-on-call is CDN-served static artifacts with zero runtime dependency on app/DB/solver, chaos-tested in CI (kill the API, assert the lookup still serves), <50KB, no login, offline-cached with a loud staleness stamp (A4-Q20, A5-Q4, C5-Q16, E1-Q18). SLO split: 99.95% read / 99.9% app — the honest solo-founder architecture: a wedged solver is a morning problem; a wrong 3am on-call answer is a patient-safety problem, and only the second is architected impossible. Display pager/operator/department numbers, never personal cells; org-scoped capability URLs preserve zero-friction lookup without becoming a stalking surface (A5-Q3 ruling).

### 8. The fairness system is a ledger, not a dashboard.
A persistent per-person equity ledger: FTE-pro-rated weighted points, leximin objective (physicians grieve worst-case, not variance), academic-year horizon, 50% annual decay, new hires enter at cohort median (D1-Q5/Q6, B1-Q1). Holiday memory is first-class: worked-Christmas → multi-year exclusion weighting, per-group holiday lists including Eid/Diwali (B1-Q2, D1-Q6). Repairs settle into the ledger; a scheduled quarterly rebalance spends an explicit disruption budget to buy back the largest inequities (D1-Q16). **The amnesty line at onboarding**: history trains rules and holiday-rotation memory, but point balances start at zero unless the group explicitly opts to amortize past debt — "Dr. K owes fourteen Christmases" gets you uninstalled by Friday (D3-Q19, ruling: holiday memory stays on even under amnesty). Leave creates *group* debt repaid by the solver, never personal makeup debt (FMLA-radioactive) (D3-Q13). Religious accommodations are zero-point hard unavailabilities (D3-Q14). No portable "fairness credit score" (B1-Q1).

### 9. Politics is handled by attribution, not prohibition.
Locks are unconditionally solver-hard, named, audited, and survive every re-solve; manual placement auto-locks; the solver's only recourse is pricing the locks ("these two locks cost 3 fairness points") (D1-Q10, A2-Q16, E3-Q17). Private rules yes (redacted reasons), invisible rules never — every rule's effect appears in the audit log and the ledger (D3-Q2). Disadvantaging someone requires an attributed, reviewable rule object — no "weight this person down" slider (D3-Q3). Unwritten privilege surfaces from imported history as explicit named exemption objects with optional sunsets (D3-Q1). A disparity monitor flags anyone in the worst decile across consecutive periods regardless of cause (D3-Q9). Sensitive absence reasons are opaque role-gated codes, excluded from AI processing, never in calendar sync ("out — chemo" must never be plaintext anywhere) (A5-Q10, B3-Q13, D5-Q15).

### 10. Adoption is value-before-configuration, and Excel/Amion are ancestors, not enemies.
Upload Excel → hosted, shareable, calendar-synced schedule in the same session; rules confirmed incrementally over days; 45-minute time-to-first-value managed at P90; unmappable cells go to an explicit "12 cells I couldn't read" queue — a silently dropped call night loses a coordinator forever (A2-Q1, A2-Q15). Mirror-first migration: reproduce their exact grid/wall-printout format before improving anything (E3-Q7, E5-Q6, A2-Q13). Publish TO Amion from day one; the wallboard migrates lookups URL by URL until the Amion upload gets skipped and nobody notices (B2-Q8, D2-Q10, C4-Q13). Coordinator is editor-in-chief, never the replaced clerk — her discretion becomes attributed locks, her unwritten rules become named credited constraints, and she can kill the pilot in a week (E1-Q16, D3-Q15). Zero training for clinicians ("resident asked how to use it" is a UI bug); 2×45min for coordinators inside onboarding (C5-Q18). The 4:45pm-Friday repair on the customer's own uploaded schedule is the demo's closing moment (C4-Q2, E3-Q13).

---

## Part 2 — Contradictions resolved (rulings)

The lanes disagreed in eight places. Rulings below; R1 and R2 need your sign-off (Part 5).

**R1 — Market sequencing: trainee-first. RESOLVED by founder decision 2026-07-11.**
Founder's ruling: the trainee (residency/fellowship) edition is v1 — the attending market is where QGenda-class incumbents live, and the trainee niche is underserved, warmer to us, and traction-friendlier. This *aligns* with what four of five batches independently recommended as the entry path (B2-Q14/Q19, C4-Q11, D4-Q7, E2-Q13): the founder's warm network is fellowship directors; the $2–3k p-card price closes without procurement; the trainee side is where the moat compounds (ACGME rule corpus, resident virality, compliance artifacts — E2-Q7). Product consequence: **one shared core with a group-type selector at setup ("training program" vs "attending group" — the founder's explicit ask, and the schema already guarantees it: C2-Q3, A4-Q19); v1 polishes the trainee edition fully (block generation, ACGME pack, COCATS accrual, jeopardy, repair); the attending edition is the fast-follow on the same engine**, reached through the same division chief who authorized the fellowship deal (B2-Q19's conversion metric still applies, now as the expansion motion). First deployment: the founder's own fellowship program — coordinator + chief fellow as user #1 (C4-Q1). Attending-specific machinery (seniority multipliers UI, contractual FTE clinic templates, comp-formula weight mapping) is designed into the schema now, shipped as the fast-follow skin.

**R2 — Open source: open the language and the referee, keep the engine, decide once, say it publicly.**
Positions ranged from "never" (C4-Q16) through "validator + spec only" (A) to "AGPL engine at v2" (B, D, E variants). Convergent across all: the data format/DSL spec must be open (anti-hostage-taking), and the AI capture pipeline + hosted product never open. Ruling: **at launch — Apache-2.0 on the constraint DSL/schema spec and rule-pack format; open-source the independent deterministic validator** (the referee, not the player: "verify our duty-hour math against real code" is a trust claim no incumbent can match, with near-zero fork value); **engine stays closed at launch, with AGPL-at-v2 explicitly reserved** once interfaces stabilize (B4-Q18 timing). Jurisdictional rule packs (ACGME, NY-405, COCATS) remain a maintained commercial subscription — a stale open compliance file is the one OSS move that hurts people (D5-Q19). Public posture is one clean sentence, decided before launch; "we're considering open source" reads worst of all (E2-Q10).

**R3 — Free-tier boundary: free = the entire Amion job; paid = the living schedule.**
Free forever: hosting, directory, who's-on-call page, ICS feeds, unlimited viewers (the distribution engine — A3-Q14, B1-Q10, C1-Q16). One free full generation as the hook. Paid: repair mode, AI rule capture, swap routing, feasibility-checked vacation, fairness ledger, compliance exports — the paywall lands exactly at the first mid-year crisis (B2-Q3, E3-Q12 over E5-Q15). Small groups get a cheap flat tier, never free access to differentiating features.

**R4 — Pricing: one number per skin, published, no implementation fee.**
Trainee: **$2,400/yr flat per program** (p-card, PD signature, competes with a conference registration). Attending: **$12/provider/month with a $6k/yr division floor** (the floor respects C1-Q3's documented $10–30k discretionary capacity; C4-Q4's $2.9k division price signals hobby-project). Viewers free uncapped. Enterprise tier published at 2–3× so cheap reads as self-serve, not amateur (B2-Q3). Zero implementation fee — the incumbents' implementation revenue is their moat and their wound (D4-Q12). Early design partners: lifetime discount for weekly feedback and referenceability (C4-Q7).

**R5 — Concurrency: single-writer for humans, rebase for the solver.**
Human draft editing is single-writer lock with visible presence and one-click handoff (A2-Q14) — matches the 1–3 coordinator reality and deletes a merge-UX class. Solver output is a proposal pinned to its input version; applying rebases intervening human mutations as locks, human wins by default, conflicts block with explicit resolution (A4-Q8, D2-Q2). CRDT/co-editing rejected permanently — two individually-valid edits can compose into a rule violation (D2-Q1).

**R6 — Fairness visibility: per-unit governance setting with per-skin defaults.**
Trainee default: own full ledger + anonymized group percentiles (hierarchy exposure is real). Attending default: group-visible ledger — the neutral-arbiter pitch collapses if partners can't see the ledger (C's ruling). Non-negotiable everywhere: weights explicit, named, versioned, logged; peer-facing counterfactuals anonymized, named versions admin-only (D1-Q13 vs D3-Q5 ruling).

**R7 — "Hard constraint" has exactly three levels, defined in the spec.**
(1) Solver-infeasible (tiny set), (2) publish-blocking-but-overridable with a named typed waiver (regulatory pattern — duty hours, CBA terms), (3) soft. Without this three-level definition the conflict engine, override waivers, and audit story contradict each other (D's ruling).

**R8 — Pilot shape: 90 days, January anchor, parallel-run mechanics, hard exit.**
90-day free pilot anchored on a January block boundary (never July 1 go-live for a new customer), written success criteria (schedule accepted within 3 cycles, coordinator time −50%, ≥1 live repair event), day-75 decision meeting, named coordinator + exec sponsor, old system dormant one cycle as parachute (E1-Q13 over E5-Q1's year-long run; C5-Q11). The 6-month north-star: % of departments whose working schedule still lives in the product (>80% = system of record; <50% = thesis dead) (E3-Q18).

---

## Part 3 — v1 scope (the solo-founder gate)

B5-Q17 is the gate every feature passes: what one founder (with AI leverage, boards in October, a fellowship, and three other apps) can actually finish. Applying it:

**v1 (the floor):**
- Solver core: generate + repair, CP-SAT, assumption literals, three-tier hardness, anytime, reproducible
- Event-sourced versioned schedule store; diffs; locks; disruption receipts
- Independent validator + publish gate + nightly sentinel; hard-coded ACGME pack
- AI rule capture: Excel/PDF upload → typed DSL draft → replay-against-history confirmation → interview mode for gaps
- Fairness ledger + holiday memory + amnesty line
- Directed rule-checked swaps (request-and-approve; auto-approve rule-clean swaps) — no marketplace
- Hosting + who's-on-call static read path + per-person ICS feeds + server-side PDF/Excel export matching their wall format
- Five polished surfaces and no more: the grid, the repair diff, the swap flow, the fairness ledger, the lookup page (E2-Q17)
- Jeopardy as first-class rotation with one-tap activation, "instant and shallow at night" (A3-Q20, E5-Q10)
- Three cheap generalizations that buy the future: rule packs as versioned data; credential-tagged person model (APPs day one); medicine-ignorant solver core (B4-Q1)

**v1 additions under the trainee-first ruling (R1):** COCATS accrual counters + the requirements board (graduation progress vs projected) move INTO v1 for the cardiology fellowship template; ACGME pack ships enabled by default; jeopardy tiers with response-radius/notice/payback parameters (verified structures — see research/DOMAIN-FINDINGS.md).

**Phase 2 (schema supports now, UI later):** the attending edition skin (seniority multipliers, contractual FTE/clinic templates, comp-formula weight mapping — schema in v1), what-if sandbox (fork-capable versioning schema is v1 — B1-Q12), embeddable on-call widget, vacation draft-day event mode, swap matching/anonymity layers, preference auctions, workload-intensity alerts, paging-system integration.

**The never list (recorded so we stop re-litigating):** nursing rostering, EMS/fire/police, pay computation of any kind, timekeeping/actual-hours surveillance, ACGME auto-reporting, real-money shift markets, patient data (hard line — the moment patient identifiers enter, the lightweight-procurement thesis collapses), patient-acuity staffing (FDA device line), EHR write integration, on-prem, bidirectional calendar/Excel sync, LLM-generated schedules, AI fairness adjudication, autonomous swap negotiation, gamification (except rescue-behavior credit), wearables (A3-Q12, B3-Q12, B4-Q5/Q6/Q12, D3-Q20, D5-Q8/Q20, E2-Q18).

---

## Part 4 — Risk register (documented, then move on)

- **Insurance now:** cyber + tech E&O with the bodily-injury endorsement negotiated explicitly from first commercial pilot — standard tech E&O excludes exactly the patient-harm-adjacent scenario (D5-Q6).
- **Marketing phrase-book:** "ensure/guarantee compliance" is banned (express-warranty exposure survives ToS disclaimers). Approved: "checks every schedule against every rule and shows you every violation before you publish" (D5-Q7).
- **SOC 2:** Type I via Vanta-class when a specific >$25k deal is blocked, not before; until then a one-page trust doc + pre-completed HECVAT Lite/CAIQ; build SOC2-shaped from day one so it's documentation, not re-architecture (C4-Q15, A5-Q8, D4-Q1).
- **Contract floor:** 12-month fee cap (2–3× super-cap), service credits sole remedy, termination-for-convenience with refund; never uncapped indemnity; sign BAAs readily (obligations over an empty set) with a no-PHI rider (D4-Q14, D5-Q4/Q16).
- **Bus factor, answered by mechanism:** continuous export (including the rule model in JSON + plain English), source escrow with release-on-failure, month-to-month terms, 90-day read-only tail, the open validator/spec (C5-Q10, D4-Q15, E1-Q17). First hire: a former program coordinator for implementation/support, the fall before onboardings exceed ~10 — not an engineer, not sales (C5-Q12).
- **Seasonality plan:** cap 8–10 trainee onboardings/season, close intake in March, feature freeze May 15–Jul 15, harden swaps before July (day-one failure mode is swap volume, not the solver) (C5-Q6/Q9).
- **QGenda ships "AI scheduling" within 2–3 years:** their AI sits on an old data model and a services org that profits from configuration pain; response is priced in — transparent pricing, sub-hour onboarding as the public demo, cardiology density; never match discounts in a bake-off (B2-Q13, E2-Q7).
- **Kill criteria, written down now:** rule capture still <90% after 12 months of tuning; pilots exporting to Excel after generation; <10 paying departments after 18 months of cardiologist-to-cardiologist selling; ten design partners with working free schedules drifting back to Excel within two cycles (E3-Q20, B5-Q20).

---

## Part 5 — What's yours to decide

1. ~~Confirm R1~~ **RESOLVED 2026-07-11: trainee-first**, attending edition as fast-follow on the shared core with a group-type selector (see revised R1).
2. **R2 adopted as default** (open validator + open spec, closed engine, AGPL reserved for v2) per founder's "proceed" — reversible until launch; becomes a public commitment then.
3. **R4 adopted as default** ($2,400/yr trainee leads; $12/provider/mo, $6k floor attending fast-follow) per founder's "proceed" — reversible until the first pilot MOU quotes it.
4. **Design partners (open):** 5 named cardiology fellowship programs from your network, one per month starting with your own. Worth starting the list now.
5. **Name the product (open):** the parallel Codex analysis proposed the working name **"Atria"** — cardiology-native, short, domain-friendly. Adopt, or counter-propose; naming unlocks the domain, the "Built with X" footer (the PLG loop), and the design language.

## Competitive teardown v2 — integrated 2026-07-11 (`research/competitors/`, synthesis in `00-COMPETITIVE-SYNTHESIS.md`)

Primary-source verified (vendor docs, app-store reviews, KLAS, forums; every fact labeled). What it changes:

- **Repair is an empty category — verified.** Across ~20 vendors, no one has minimal-disruption mid-year re-solve: Amion's auto-scheduler is a heuristic gap-filler whose own docs say output "typically need[s] some fine-tuning" [docs]; QGenda's documented repair path is manual swaps and grid edits [docs]; Lightning Bolt has no post-publication re-optimization and solver settings are consultant-gated [docs]; MedRez's generator is an add-only "Randomizer" that skips block schedules entirely [docs+forum]; MedHub/New Innovations cannot generate at all [vendor]. The repair demo is the category-defining move — name the category before Thrawn's "re-optimization" framing does.
- **Ownership map corrected:** QGenda belongs to **Hearst** (2024), and — critically — **QGenda acquired New Innovations in July 2025**. The GME system-of-record we plan to publish into is owned by the enterprise incumbent. Coexistence stands (NI publicly accepts third-party feeds; single programs and fellowships get ignored during enterprise integration cycles — the wedge is open *now*), but this sharpens the timeline. Amion = Doximity ($53.5M, 2022) with a publicly stalled next-gen roadmap ("talking about it for years" — KLAS, Apr 2026).
- **Pricing anchors:** Amion $449/yr, MedRez $450/yr, Mesh AI $250–450/mo. Our $2,400 sells as solver+repair value against the $449 anchor — never as a price play. QGenda's ~$10k setups and multi-month implementations [forum/review] are the wound our zero-fee onboarding presses.
- **Mobile is the category's most burned surface:** 2.8★ (Lightning Bolt), 2.56★ (Amion Android), 2.0★ (New Innovations), 1.6★ (Spok). One excellent always-logged-in PWA is durable differentiation — and never ship a regression that breaks muscle memory.
- **The AI-newcomer cohort is concierge, not product:** Scheduling Wizard (YC W26, 3 people) and Thrawn (MIT, ~19 departments) deliver finished Excel files and explicitly punt the live layer — who's-on-call, swaps, mid-year changes — to Amion/QGenda. That live layer is exactly our free tier + repair engine. Window assessment: open, closing within 1–2 YC batches; outside deadline July 2027.
- **Rule-vocabulary adoption:** ingest incumbents' constraint vocabulary (Amion's rule types, Lightning Bolt's taxonomy incl. "Unbreakable" flags, ByteBloc's Prefer/Desire/Dislike/Conflicts) so AI-captured rules read native to switchers.
- **Silent rule failure is the recurring trust-killer** across QGenda/Momentum/MedRez reviews — independent confirmation of the validator + explainability spine.
- **MedRez is the existence proof:** a one-man company at $450/yr has served this market for ~20 years with same-day support. A solo founder can operate here; the open question was never viability, it's ceiling.

## Next steps
1. ~~Competitor teardown~~ Done — integrated above.
2. Write the v1 spec from Part 1 + Part 3 (the spec inherits this brief; every spec section cites its Q-codes).
3. Design exploration for the six lenses (grid, repair diff, swap flow, ledger, requirements board, lookup) — where the Apple/Palantir bar gets cashed.

---

## Addendum (2026-07-11) — Trainee-first pivot + Codex convergence

A parallel analysis by another AI (Codex; `~/Documents/Codex/2026-07-10/i-want-to-make-a-piece/outputs/`) independently converged on our core architecture: repair-first positioning, CP-SAT with independent deterministic validation, "LLM outputs are proposals that pass schema validation + replay + human confirmation," disruption receipts (the identical term), hue-for-families/text-for-identity encoding, and Excel-as-bridge. Independent convergence from a different model raises confidence in the spine. Items **adopted** from the Codex material into our spec inputs:

1. **The product promise, one sentence:** "Change one fact, understand everything affected, compare valid minimal repairs, and publish one trustworthy current schedule."
2. **Three workspaces, not two:** scheduler cockpit + clinician surface + a **leadership workspace** (coverage resilience, structural staffing deficits, schedule stability/recovery-time, denied-request patterns) — the PD/chair view was underweighted in our brief.
3. **"The schedule is a stack, not a calendar":** eight layers (obligation, eligibility, allocation, coverage, call, recovery, change, evidence) — adopted as the spec's data-model narrative frame.
4. **Coverage requirement as a first-class entity** (service, interval, role, min/ideal staffing, capability mix, supervision mix, escalation) distinct from assignments — sharpens our demand model.
5. **Worklist/queue ownership as a coverage primitive** (radiology: coverage = owning a queue, not presence at a location; generalizes to inboxes, transfer calls, tele pools) — new primitive, cheap in the slot model.
6. **Recovery as a first-class layer:** post-call release, callback relief, quick-return protection — enriches our circadian primitives with call-consequence semantics.
7. **Six visual lenses over one schedule:** coverage board, people board, call stack, fairness ledger, **requirements board** (graduation/contract progress — now v1 under trainee-first), change control. Supersedes our five-surface list by adding the requirements board.
8. **Structural-shortage honesty as a principle:** the product must never disguise insufficient staffing as optimization success (formalizes our "say it with arithmetic" ruling).
9. **Ten synthetic validation fixtures** (cardiology parallel services, anesthesia release order, radiology worklists, IM X+Y w/ jeopardy, etc.) — adopted as the solver/importer test-corpus plan, re-prioritized trainee-first.
10. **The vertical-slice demo**, re-flavored for trainee-first: published fellowship month → a fellow goes out Friday–Sunday → affected assignments + uncovered call identified → three valid minimal-repair candidates with fairness/preference/approval impact → diff preview + disruption receipt → publish + targeted notifications.
11. **Modular-monolith module boundaries** (identity / workforce / scheduling / policy / optimization / workflow / communication / integration / audit) with an isolated solver worker — adopted as the starting architecture sketch.
12. **Working name candidate: "Atria"** (pending founder approval).

### Delta-mining round 2 (the remaining Codex documents — full reports in `research/codex-deltas/`)

**Adopted into v1 scope (trainee-critical):**
13. **Publish-to-MedHub/New-Innovations** — the trainee-market analog of publish-to-Amion. The GME systems of record publicly invite third-party schedule feeds (MedHub's own integration docs); the coexistence doctrine extends to them in v1. We author and repair; they keep compliance-reporting custody until trust flips.
14. **Academic-year rollover and succession as first-class operations** — graduation offboarding, PGY eligibility flips on July 1, chief-scheduler handoff where rule ownership survives the person, block calendars versioned per academic year. (Extends C1-Q6/C3-Q19.)
15. **Notification delivery + acknowledgment ledger, explicitly in the v1 floor** — outbox-pattern delivery with retries, per-person delivery/ack tracking, escalation to a phone-call task. The disruption receipt proves the change was *safe*; the ack ledger proves the affected people *know*. (Promotes D2-Q4/C3-Q18 from dossier to named v1 floor item.)
16. **Real trainee policy structures as spec inputs:** Colorado IM's swap-as-policy-evaluation (swap caps, covering-resident clinic-miss limits, duty-hour check at request time), Morehouse's plus/minus jeopardy point ledger (real-world validation of ledger-driven backup selection), WashU's time-dependent call eligibility — **eligibility is a dated competency graph, not a static PGY label**.
17. **Rule-card UX precedent from Lightning Bolt:** rules rendered as editable sentences with an "Unbreakable" flag; plus a named **do-not-auto-schedule (inverse lock)** constraint type. Their giant-number priority system is the human-hostile pattern our lexicographic tiers attack.
18. **Per-person min/target/max triple** (min = contractual, target = fairness objective, max = protection cap, unset-allowed) — into the person model now; the attending fast-follow needs it day one.
19. **Period-boundary context as first-class input** — spacing/consecutive/max rules evaluate across schedule-period boundaries (generalizes the ACGME rolling-window machinery); tells the importer to ingest the prior period first.
20. **The 90-artifact corpus as the importer test plan** — flagship fixtures: ECU cardiology #062 (COCATS totals + clinic collisions), Morehouse #016 (jeopardy ledger), McGovern #002 (mixed 2/4-week blocks), UF-Jax #057 (master roster), Houston Methodist #046 (spreadsheet). Caveat: idealized recruitment templates — good for import/generate tests, useless for repair/ledger flows; URLs need verification and local mirroring.

**Contradictions adjudicated (all resolved in the brief's favor, two with refinements):** Codex's attending-first sequencing (overridden by R1), full-event-sourcing skepticism (kept as a scoping guard: snapshots + event log, not a CQRS framework), multi-editor optimistic locking (R5 stands), org-tunable numeric weights (ban stands; their paired-tradeoff examples salvaged for the policy-ratification UI), authenticated-only lookup (capability URLs stand; adopt their token rotation/access-log hardening), implementation fees (zero-fee stands), open-source-nothing (R2 stands), solver-agnosticism (CP-SAT commitment stands — an abstraction layer forbids the assumption-literal coupling that makes conflicts explainable), hard per-person caps (reclassified through R7's three-level model — hard caps in a six-person pool are the infeasibility death spiral), randomized tie-breaks (reconciled: seed recorded in version metadata — "seed 4711, re-run it yourself"). One carve-out formalized: as-worked retroactive corrections (C3-Q20) are the *only* sanctioned contact with actual-vs-scheduled data; the never-list ban on hours surveillance otherwise stands.
