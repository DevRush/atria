# Verified Domain Research — Regulatory Constraints, Real Schedule Structures, Fairness Systems, Solver Literature
**Date:** 2026-07-11 · **Method:** deep-research workflow (113 agents; 6 search angles; 30 sources fetched; 150 claims extracted; top 25 adversarially verified by 3-vote panels → 24 confirmed, 1 refuted)
**Scope note:** This is the domain-requirements half of the research brief. The competitor-teardown half (Stream 1) produced no claims that survived adversarial verification — its sources were largely competitor marketing blogs and unverifiable review snippets — and is being re-run against primary sources (see `research/competitors/` when it lands).

---

## 1. The ACGME hard-constraint set (verified against the July 2026 Common Program Requirements)

These are the rules the solver's trainee pack must encode as hard constraints, verified verbatim against the current primary source (ACGME CPR Residency, effective 2026-07-01):

| Rule | Spec | Citation |
|---|---|---|
| 24+4 | Continuous scheduled clinical assignments ≤24h; up to 4 additional hours only for transitions/education; **no new patient-care responsibilities** in the +4 | §6.22/6.22.a |
| Post-call rest | ≥14 hours free of clinical work and education after 24h of in-house call | §6.21.a |
| One-in-seven | ≥1 day in 7 free of clinical work and education, **averaged over 4 weeks**; at-home call cannot be assigned on free days (home call blocks a day from counting as "off") | §6.21.b |
| Call frequency | In-house call no more than every third night, averaged over 4 weeks | §6.27 |
| Home call | Exempt from the every-third-night limit but must still satisfy one-in-seven; counts toward the 80-hour limit only for actual patient-care time | §6.28 |

**Solver implication (new spec detail):** in-house call and at-home call are *formally distinct constraint classes* — different frequency rules, different hour-counting semantics, and home call interacts with the free-day rule. The constraint DSL needs both as first-class types.

**⚠️ The one refuted claim — handle with care.** The framing "80 hours/week averaged over 4 weeks = a rolling 320-hour budget including home clinical work and all moonlighting" was voted down 0–3 *as worded*. The 80-hour averaged cap is real, but its precise scope (home clinical work, moonlighting inclusion) and the currently **suspended 88-hour exception mechanism (§6.24)** must be re-verified against live 2026 text before encoding. Do not reuse the refuted framing.

**⚠️ Regulatory flux is a product requirement.** ACGME renumbered everything in the 2025/2026 reformatting (VI.F.2.a → 6.21.b) and issued a **Feb 2026 interim suspension of several requirements** (not the ones above). A compliance engine must consume a *versioned rules source with effective dates and citations* — this independently validates the decision brief's "rule packs as versioned data with a named maintainer" (D5-Q9, B1-Q20) as load-bearing, not optional.

## 2. COCATS 4 — cardiology fellowship scheduling is a three-dimensional accrual problem

Verified by direct extraction from the ACC COCATS 4 unified document (no COCATS 5 exists as of July 2026; 2019–2026 ACC statements supplement rather than replace):

1. **Continuity clinic:** every general fellow needs longitudinal clinic ≥1 half-day/week for ≥40 weeks in *each* of the 3 years — a hard recurring-weekly constraint layered over block rotations (cardiology's analog of X+Y).
2. **Cath:** duration AND volume paired — Level I ≈4 months + ≥100 diagnostic caths (≥50 with coronary angiography); Level II ≈6 cumulative months + ~300 procedures; **only one Level I trainee claims credit per procedure** (a slot-capacity constraint, not just a counter).
3. **Echo:** cumulative 3-month tiers with paired study minimums — Level I: 3mo, 75 performed/150 interpreted; Level II: 6mo, 150/300; Level III: 9mo, 300/750.

**Solver implication:** a fellowship engine needs per-rotation-type cumulative month counters and per-trainee procedure/study accrual **across all 3 years** — the "counters" primitive already in the core spec (A4-Q19), now with verified semantics. Month durations are "approximately/expected" (competency-based); study counts are explicit minimums — encode months as soft-with-warning, counts as hard-for-graduation.

## 3. Verified real-world schedule structures (= importer + data-model test cases)

- **7-on/7-off dominates hospitalist medicine:** 56.1% of groups (2020 SoHM), >60% by 2023 and growing; variable schedules 27%; M–F+rotating weekends only 3.2%. Week-block cadence must be native, not simulated from daily shifts — supports the circadian/shift-template primitives already in the spec (B4-Q3).
- **SHM's variable-schedule rule pattern:** blocks may start any weekday, but enforce a minimum consecutive-daytime-shift run (e.g., ≥5) for continuity — a named, recurring constraint type for the DSL. Peer-reviewed corroboration links consecutive hospitalist days to better outcomes.
- **Real residency blocks are heterogeneous:** UTHealth IM mixes 4-week (Wards, CCU, MICU, Nocturnist), 2-week (Ambulatory, Consults, Jeopardy/Night-Float), and 2–4-week electives in one year; recurring 2-week ambulatory blocks interleave in a de facto ~4+2 X+Y pattern the program never calls X+Y. **Jeopardy appears as a dedicated scheduled block in every PGY template** — first-class rotation status (A3-Q20/C2-Q20) is verified practice, not our invention.
- **Jeopardy is tiered and rule-dense:** CU Anschutz runs two tiers — Active (stay in metro area, report within 45 min of page) and Backup (≥24h notice before conversion to Active; travel allowed if returnable in 24h, no air travel). Missing an activation triggers a codified **3:1 payback penalty**; ASA documents 2:1 in anesthesiology; enforcement varies (UCSF Surgery explicitly doesn't enforce). **Spec addition:** jeopardy tier objects need response-radius/notice parameters and configurable activation-penalty rules.
- **SHM best practice names swaps as core:** "Develop a user-friendly system for hospitalists to swap shifts or parts of blocks... ideally hospitalist-to-hospitalist without additional time or coordination from the scheduler." Self-service peer-to-peer swaps (including **partial-block swaps**) are validated as a core feature — and "ideally scheduler-free" supports our rule-clean-auto-approve default (A2-Q9).

## 4. Fairness: verified field practice

- **The fairness spectrum is real and must be configurable at both ends:** SHM names point systems (shift-type differentials), pods, and seniority/grandfathering/life-stage differentials on one end, deliberate "full equity" on the other; less-desirable shifts (location, resident coverage) must count toward equity. Validates the weighted-points + strict-equity dual configuration and the explicit seniority-multiplier ruling (D3-Q6).
- **Weighted call-points with outcome evidence:** Montefiore/Einstein neurosurgery's Resident Call Points system — each call shift has a point value; **equity is measured as the statistical variance of accumulated points**; post-implementation, workload variance fell significantly and self-reported duty-hour violations dropped 34% → 11.1% (p<0.001). (Medium confidence: single-site retrospective, 2011 ACGME-overhaul confounder.) **Spec adoption:** variance-of-points is a ready-made, literature-grounded equity metric for the fairness ledger display.

## 5. Solver literature (directly reusable architecture)

- **The field-standard model matches ours:** hard constraints (exact coverage, qualifications, mandatory rest, absences, min staffing, block integrity) + soft constraints as weighted penalty terms (preferences, fair distribution, free weekends, continuity) — verified from a deployed MIP framework (arXiv 2511.14536, in daily production in a hospital cardiology department) and Wickert et al. 2020 (real ICU data).
- **Reusable taxonomy for the rule-authoring UI:** four top-level constraint categories — physician preferences, legal restrictions, hospital requirements, workload balance (Wickert 2020).
- **Fairness "pools":** target duty count per physician prorated by employment rate × non-absent days — part-time and leave scale the target rather than fairness being per-head. Independently validates our FTE-pro-rated ledger (D1-Q5, D3-Q7) with a published formula.
- **Five-level preference scale** (strongly desired / desired / indifferent / undesired / impossible) across duty-specific, weekly, and weekend preference types — a proven elicitation pattern; composes with our budgeted-preference mechanism (D3-Q4).
- **Non-expert reconfiguration GUI** is the deployed framework's pitched differentiator (2-1 vote — parameterizes predefined constraint families, not free-form authoring). Our AI rule capture attacks the same cliff from a stronger angle.
- **Burke et al. 2004 (canonical survey, ~1,040 citations):** the objectives triad — efficient utilization, balanced workload, individual preferences — plus decades of precedent for both exact (CP/MIP) and heuristic approaches. CP-SAT choice sits on solid ground.

## 6. What this changes in the decision brief

**Validated (no change):** rule-packs-as-versioned-data; hard/soft tier model; FTE-prorated ledger; jeopardy as first-class rotation; swap workflows as core; week-block cadences; seniority-as-explicit-policy; counters primitive.
**Additions to spec:**
1. Home call as a distinct constraint class (frequency-exempt, free-day-blocking, care-time-only hours).
2. Jeopardy tier parameters: response radius/time, conversion notice, travel rules, configurable payback-penalty rules.
3. Partial-block swaps in the swap engine.
4. COCATS accrual counters: cumulative months (soft) + procedure/study counts (hard), 3-year horizon, one-Level-I-credit-per-procedure slot capacity.
5. Variance-of-points as the shipped equity metric; five-level preference scale as the elicitation default.
6. Minimum-consecutive-shift-run as a named DSL constraint type.
7. Re-verify the 80-hour rule's exact scope + §6.24 suspension status before encoding (assigned to Stream-1 re-run).

## 7. Open questions (carried into the competitor re-run)

1. Incumbent teardowns with primary evidence (vendor docs, app-store reviews, forums) — Stream 1 in full.
2. Precise 2026 scope of the 80-hour cap (home clinical work, moonlighting; suspended 88-hour exception).
3. Attending private-practice fairness codification (holiday-rotation memory across years, weighted holiday/weekend points) — no claims verified despite being in the brief.
4. AI-native newcomers: existence signals found (Scheduling Wizard — YC W26, managed-service, claims "mathematically guaranteed ACGME compliance," delivers Excel; MeshAI; Calerity GME; ScheduleForward) but all unverified vendor self-claims. The why-now window is real and at least one funded team sees it — verify capabilities and models in the re-run.

## Sources (verified findings only)
- ACGME Common Program Requirements (Residency), 2026: acgme.org/globalassets/pfassets/programrequirements/2026-prs/cprresidency_2026.pdf
- CU Anschutz GME summary of ACGME work-hour rules (2022): medschool.cuanschutz.edu (GME document library)
- ACC COCATS 4 unified document (2015): acc.org guidelines PDF
- SHM Schedule Management for Hospital Medicine resource: hospitalmedicine.org (pm-23-0003)
- UTHealth Houston IM residency block schedule sample: med.uth.edu
- CU Anschutz IM jeopardy guidelines: medschool.cuanschutz.edu
- Montefiore/Einstein RCP study: Am J Surg 2026 (PMID 42025398)
- Meier/Boeckmann/Thielen MIP framework: arXiv 2511.14536
- Wickert et al.: Annals of Operations Research 2020 (10.1007/s10479-020-03552-5)
- Burke et al., "The State of the Art of Nurse Rostering," J Scheduling 2004
