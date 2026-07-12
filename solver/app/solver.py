"""CP-SAT scheduling engine: generate + minimal-disruption repair.

Design notes (see docs/SPEC-V1.md §3):
- Every HARD/BLOCKING user rule is wrapped in a named assumption literal so an
  infeasible model yields the *specific rules* that conflict, in plain language.
- The solver is deliberately CONSERVATIVE relative to the independent validator:
  where it approximates an ACGME rule it does so with a stronger constraint, so a
  solver-feasible schedule always passes the authoritative validator.
- Determinism: fixed seed + single worker + fixed search → same input, same output.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from ortools.sat.python import cp_model

from .common import (
    WEEKDAY_NAMES,
    absence_days,
    canonical_hash,
    is_weekend,
    parse_date,
    parse_dt,
    scope_matches,
    weekday_code,
)
from .models import (
    Assignment,
    Conflict,
    DiffChange,
    Person,
    Relaxation,
    RepairCandidate,
    RepairDiff,
    RepairRequest,
    RepairResponse,
    Rule,
    Slot,
    SolveRequest,
    SolveResponse,
    ValidateRequest,
)
# Solver self-checks its repair candidates with the independent validator before
# returning them, so a repair can never propose something that fails publish.
# (The independence rule is one-way: the validator never imports the solver.)
from .validator import validate as run_validate

TIER_WEIGHT = {"must": 1000, "should": 40, "nice": 5}


class Index:
    """Precomputed views over the problem instance."""

    def __init__(self, req: SolveRequest):
        self.people = {p.id: p for p in req.people}
        self.services = {s.id: s for s in req.services}
        self.slots = {s.id: s for s in req.slots}
        self.rules = req.rules
        self.absences = req.absences

        self.block_slots = [s for s in req.slots if s.grain == "block"]
        self.call_slots = [s for s in req.slots if s.grain == "call-night"]
        self.jeop_slots = [s for s in req.slots if s.grain == "week"]

        # block period key -> slots; and set of period boundaries
        self.periods = sorted({(parse_date(s.start), parse_date(s.end)) for s in self.block_slots})
        self.period_of = {}
        for s in self.block_slots:
            self.period_of[s.id] = (parse_date(s.start), parse_date(s.end))

        # per-person absence day sets
        self.absent_days: dict[str, set[date]] = defaultdict(set)
        for a in req.absences:
            if a.status == "approved":
                self.absent_days[a.personId] |= absence_days(a.start, a.end)

        # program holiday dates (YYYY-MM-DD) — a call night landing on one of these
        # is holiday call, spread for equity in the objective (never a weekend proxy)
        self.holiday_dates: set[date] = {parse_date(h) for h in getattr(req, "holidays", [])}

    def eligible(self, slot: Slot) -> list[Person]:
        svc = slot.serviceId
        out = []
        for p in self.people.values():
            if svc in p.eligibleServices:
                out.append(p)
        return out

    def call_date(self, slot: Slot) -> date:
        return parse_dt(slot.start).date()


def _person_absent_on(idx: Index, person_id: str, d: date) -> bool:
    return d in idx.absent_days.get(person_id, set())


def build_generate(req: SolveRequest, idx: Index):
    """Returns (model, x, assume, meta) for a generation solve."""
    m = cp_model.CpModel()
    x: dict[tuple[str, str], cp_model.IntVar] = {}
    assume: dict[str, cp_model.IntVar] = {}  # rule_id/structural key -> literal

    def lit(key: str) -> cp_model.IntVar:
        if key not in assume:
            assume[key] = m.NewBoolVar(f"assume_{key}")
            # NOT fixed to 1 — added as a solver assumption so an infeasible model
            # yields the minimal conflicting subset via the assumptions core API.
        return assume[key]

    # decision vars for block, call, jeop slots
    decision_slots = idx.block_slots + idx.call_slots + idx.jeop_slots
    for s in decision_slots:
        for p in idx.eligible(s):
            # a person absent for the whole slot cannot take it
            if s.grain == "call-night" and _person_absent_on(idx, p.id, idx.call_date(s)):
                continue
            x[(s.id, p.id)] = m.NewBoolVar(f"x_{s.id}_{p.id}")

    def slot_vars(slot: Slot):
        return [x[(slot.id, p.id)] for p in idx.eligible(slot) if (slot.id, p.id) in x]

    # ---- structural: fill requirements ----
    for s in idx.block_slots:
        vs = slot_vars(s)
        svc = idx.services[s.serviceId]
        if svc.id == "RESEARCH":
            m.Add(sum(vs) <= 1)  # research is flexible; absorbs slack, may be unfilled
        else:
            m.Add(sum(vs) == 1).OnlyEnforceIf(lit("struct_block_fill"))
    for s in idx.call_slots + idx.jeop_slots:
        vs = slot_vars(s)
        if vs:
            m.Add(sum(vs) == 1).OnlyEnforceIf(lit("struct_fill"))

    # each person: exactly one block assignment per period (a fellow is one place per block)
    by_person_period: dict[tuple[str, tuple], list] = defaultdict(list)
    for s in idx.block_slots:
        for p in idx.eligible(s):
            if (s.id, p.id) in x:
                by_person_period[(p.id, idx.period_of[s.id])].append(x[(s.id, p.id)])
    for (pid, _per), vs in by_person_period.items():
        m.Add(sum(vs) == 1).OnlyEnforceIf(lit("struct_one_block_per_period"))

    # jeopardy tiers within one week must be distinct people (tier-1 != tier-2)
    jeop_by_week: dict[tuple[str, str], list] = defaultdict(list)
    for s in idx.jeop_slots:
        for p in idx.eligible(s):
            if (s.id, p.id) in x:
                jeop_by_week[(s.start, p.id)].append(x[(s.id, p.id)])
    for (_wk, _pid), vs in jeop_by_week.items():
        if len(vs) > 1:
            m.Add(sum(vs) <= 1).OnlyEnforceIf(lit("struct_distinct_jeopardy"))

    # ---- user rules ----
    _apply_rules(m, x, idx, lit)

    # ---- locks (absolute — SPEC invariant 4): fix the locked (slot, person) ----
    assign_by_id = {a.id: a for a in getattr(req, "assignments", [])}
    for lk in getattr(req, "locks", []):
        a = assign_by_id.get(lk.assignmentId)
        if not a:
            continue
        if (a.slotId, a.personId) in x:
            m.Add(x[(a.slotId, a.personId)] == 1).OnlyEnforceIf(lit("lock_" + a.slotId))

    # ---- objective: equity ----
    obj_terms = _equity_objective(m, x, idx, req.rules)

    return m, x, assume, obj_terms


def _apply_rules(m, x, idx: Index, lit):
    """Compile the typed rule catalog into constraints under assumption literals."""
    for r in idx.rules:
        L = lit(r.id)
        t = r.type
        if t == "block_requirement":
            svc = r.params.get("serviceId")
            mn = int(r.params.get("minBlocks", 0))
            for p in idx.people.values():
                if not scope_matches(r.scope, p):
                    continue
                terms = [x[(s.id, p.id)] for s in idx.block_slots
                         if s.serviceId == svc and (s.id, p.id) in x]
                if terms:
                    m.Add(sum(terms) >= mn).OnlyEnforceIf(L)
                # if no terms and mn>0, structurally impossible for that person -> will surface
        elif t == "min_coverage":
            svc = r.params.get("serviceId")
            mn = int(r.params.get("min", 1))
            # per block period, coverage of svc >= mn
            per_terms = defaultdict(list)
            for s in idx.block_slots:
                if s.serviceId == svc:
                    for p in idx.eligible(s):
                        if (s.id, p.id) in x:
                            per_terms[idx.period_of[s.id]].append(x[(s.id, p.id)])
            for _per, terms in per_terms.items():
                m.Add(sum(terms) >= mn).OnlyEnforceIf(L)
        elif t == "no_call_before_clinic":
            for p in idx.people.values():
                if not p.clinicDay:
                    continue
                for s in idx.call_slots:
                    if (s.id, p.id) not in x:
                        continue
                    nxt = idx.call_date(s) + timedelta(days=1)
                    if weekday_code(nxt) == p.clinicDay:
                        m.Add(x[(s.id, p.id)] == 0).OnlyEnforceIf(L)
        elif t == "call_spacing":
            gap = int(r.params.get("minGapNights", 3))
            _call_spacing(m, x, idx, gap, L)
        elif t in ("min_rest_after_call",):
            # no back-to-back call nights (stronger than a bare 14h rest); validator does exact
            _call_spacing(m, x, idx, 2, L)
        elif t == "clinic_day_protected":
            pass  # clinic is fixed context (not a decision var) -> always satisfied
        elif t == "one_in_seven_free":
            _max_consecutive_call(m, x, idx, 5, L)  # conservative proxy; validator authoritative
        elif t == "max_consecutive_call":
            _call_spacing(m, x, idx, 2, L)
        # weekend_equity / holiday_equity handled in objective; pair_exclusion/fixed below
        elif t == "pair_exclusion":
            a, b = r.params.get("a"), r.params.get("b")
            for s in idx.block_slots:
                if (s.id, a) in x and (s.id, b) in x:
                    m.Add(x[(s.id, a)] + x[(s.id, b)] <= 1).OnlyEnforceIf(L)
        elif t == "do_not_schedule":
            pid = r.params.get("personId"); svc = r.params.get("serviceId")
            for s in idx.slots.values():
                if s.serviceId == svc and (s.id, pid) in x:
                    m.Add(x[(s.id, pid)] == 0).OnlyEnforceIf(L)


def _call_spacing(m, x, idx: Index, gap: int, L):
    """At most one call per rolling `gap`-night window, per person."""
    calls_by_person: dict[str, list[tuple[date, cp_model.IntVar]]] = defaultdict(list)
    for s in idx.call_slots:
        for p in idx.people.values():
            if (s.id, p.id) in x:
                calls_by_person[p.id].append((idx.call_date(s), x[(s.id, p.id)]))
    for pid, lst in calls_by_person.items():
        lst.sort(key=lambda t: t[0])  # by date only — never compare IntVars (multi-domain call shares nights)
        n = len(lst)
        for i in range(n):
            window = [lst[i][1]]
            j = i + 1
            while j < n and (lst[j][0] - lst[i][0]).days < gap:
                window.append(lst[j][1])
                j += 1
            if len(window) > 1:
                m.Add(sum(window) <= 1).OnlyEnforceIf(L)


def _max_consecutive_call(m, x, idx: Index, maxrun: int, L):
    calls_by_person: dict[str, dict[date, cp_model.IntVar]] = defaultdict(dict)
    for s in idx.call_slots:
        for p in idx.people.values():
            if (s.id, p.id) in x:
                calls_by_person[p.id][idx.call_date(s)] = x[(s.id, p.id)]
    for pid, dmap in calls_by_person.items():
        days = sorted(dmap)
        for i in range(len(days) - maxrun):
            run = days[i:i + maxrun + 1]
            if all((run[k] - run[0]).days == k for k in range(len(run))):
                m.Add(sum(dmap[d] for d in run) <= maxrun).OnlyEnforceIf(L)


def _equity_objective(m, x, idx: Index, rules: list[Rule]):
    """Minimize spread of weekend-call and holiday-call and total-call across people.
    Returns list of (weight, IntVar) terms; caller sets Minimize."""
    terms = []
    people = list(idx.people.values())

    def count_var(name, pred):
        cvars = {}
        for p in people:
            items = [x[(s.id, p.id)] for s in idx.call_slots
                     if (s.id, p.id) in x and pred(s)]
            cv = m.NewIntVar(0, len(idx.call_slots), f"{name}_{p.id}")
            m.Add(cv == sum(items)) if items else m.Add(cv == 0)
            cvars[p.id] = cv
        return cvars

    total = count_var("call_total", lambda s: True)
    weekend = count_var("call_wknd", lambda s: is_weekend(idx.call_date(s)))
    holiday = count_var("call_hol", lambda s: idx.call_date(s) in idx.holiday_dates)

    def spread(cvars, weight, label):
        mx = m.NewIntVar(0, len(idx.call_slots), f"max_{label}")
        mn = m.NewIntVar(0, len(idx.call_slots), f"min_{label}")
        for v in cvars.values():
            m.Add(mx >= v)
            m.Add(mn <= v)
        sp = m.NewIntVar(0, len(idx.call_slots), f"spread_{label}")
        m.Add(sp == mx - mn)
        terms.append((weight, sp))

    # weekend + holiday equity weighted 'should'; total call balance 'nice'.
    # holiday spread is a no-op when the program declares no holidays (all-zero vars).
    spread(weekend, TIER_WEIGHT["should"], "wknd")
    spread(holiday, TIER_WEIGHT["should"], "hol")
    spread(total, TIER_WEIGHT["nice"], "total")
    return terms


def _solve(m, obj_terms, assume, seed: int, time_limit: float, enumerate_all=False):
    solver = cp_model.CpSolver()
    solver.parameters.random_seed = seed
    solver.parameters.num_search_workers = 1
    solver.parameters.max_time_in_seconds = time_limit
    if obj_terms:
        m.Minimize(sum(w * v for w, v in obj_terms))
    if assume:
        m.AddAssumptions(list(assume.values()))
    status = solver.Solve(m)
    return solver, status


def solve_generate(req: SolveRequest) -> SolveResponse:
    idx = Index(req)
    m, x, assume, obj_terms = build_generate(req, idx)

    # apply locks: fix seed assignments that are locked
    locked_pairs = set()
    assignment_by_id = {}  # not provided in SolveRequest; locks resolved via slot in future
    for lk in req.locks:
        locked_pairs.add(lk.assignmentId)

    solver, status = _solve(m, obj_terms, assume, req.seed, req.timeBudgetSec)

    in_hash = canonical_hash({
        "people": [p.model_dump() for p in req.people],
        "slots": [s.model_dump() for s in req.slots],
        "rules": [r.model_dump() for r in req.rules],
        "seed": req.seed,
    })

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = _extract(x, solver, idx, version=1, provenance="solver")
        obj = {"status": solver.StatusName(status),
               "objective": solver.ObjectiveValue() if obj_terms else 0}
        return SolveResponse(feasible=True, assignments=assignments, objective=obj,
                             seed=req.seed, inputHash=in_hash,
                             telemetry={"wallSec": round(solver.WallTime(), 2),
                                        "branches": solver.NumBranches(),
                                        "decisionSlots": len(idx.block_slots) + len(idx.call_slots) + len(idx.jeop_slots)})
    # infeasible -> diagnose via assumption cores
    conflicts = _diagnose(solver, assume, idx)
    return SolveResponse(feasible=False, conflicts=conflicts, seed=req.seed, inputHash=in_hash,
                         telemetry={"status": solver.StatusName(status)})


def _extract(x, solver, idx: Index, version: int, provenance: str,
             base: Optional[dict] = None) -> list[Assignment]:
    out = []
    n = 0
    for (slot_id, pid), var in x.items():
        if solver.Value(var) == 1:
            n += 1
            out.append(Assignment(
                id=f"a_{slot_id}",
                slotId=slot_id, personId=pid,
                status="draft", locked=False, provenance=provenance,
                createdInVersion=version))
    return out


def _diagnose(solver, assume, idx: Index) -> list[Conflict]:
    core_keys = []
    try:
        core = solver.SufficientAssumptionsForInfeasibility()
        inv = {v.Index(): k for k, v in assume.items()}
        for lit_index in core:
            key = inv.get(lit_index) or inv.get(abs(lit_index))
            if key:
                core_keys.append(key)
    except Exception:
        pass
    rule_by_id = {r.id: r for r in idx.rules}
    conflicts = []
    named = [k for k in core_keys if k in rule_by_id]
    struct = [k for k in core_keys if k not in rule_by_id]
    if named:
        texts = [rule_by_id[k].text or k for k in named]
        conflicts.append(Conflict(
            ruleIds=named,
            text="These rules can't all hold at once: " + "; ".join(texts),
            relaxations=[Relaxation(description=f"Relax or soften: {rule_by_id[k].text or k}", cost=1.0)
                         for k in named]))
    if struct and not named:
        conflicts.append(Conflict(
            ruleIds=[],
            text=("There aren't enough eligible fellows to cover every required service "
                  "in at least one block — this is a staffing shortage, not a rule conflict."),
            relaxations=[Relaxation(description="Reduce a coverage minimum, or widen who is eligible for the short service.", cost=1.0)]))
    if not conflicts:
        conflicts.append(Conflict(ruleIds=[], text="No feasible schedule was found within the time budget.",
                                  relaxations=[Relaxation(description="Increase the time budget or relax soft targets.", cost=1.0)]))
    return conflicts


# ------------------------- REPAIR -------------------------

def solve_repair(req: RepairRequest) -> RepairResponse:
    idx = Index(req)
    in_hash = canonical_hash({"base": [a.model_dump() for a in req.baseAssignments],
                              "event": req.event.model_dump(), "seed": req.seed})

    # find the absence and the person it hits
    absence = next((a for a in req.absences if a.id == req.event.absenceId), None)
    if absence is None:
        return RepairResponse(feasible=False, seed=req.seed, inputHash=in_hash,
                              conflicts=[Conflict(ruleIds=[], text="Absence not found.")])
    victim = absence.personId
    adays = absence_days(absence.start, absence.end)

    base_by_slot = {a.slotId: a for a in req.baseAssignments}
    slot_by_id = idx.slots

    # slots the victim must vacate: their base assignments whose slot overlaps absence days
    vacated: list[Slot] = []
    for a in req.baseAssignments:
        if a.personId != victim:
            continue
        s = slot_by_id.get(a.slotId)
        if not s:
            continue
        if s.grain == "call-night" and idx.call_date(s) in adays:
            vacated.append(s)
        elif s.grain == "week":
            ws, we = parse_date(s.start), parse_date(s.end)
            if any(ws <= d < we for d in adays):
                vacated.append(s)
        # block slots: a short absence does not vacate a 4-week block assignment

    if not vacated:
        return RepairResponse(feasible=True, candidates=[], seed=req.seed, inputHash=in_hash)

    # locked/started assignments cannot move; everyone else stays put by default
    locked_slotids = {lk.assignmentId for lk in req.locks}
    # Build candidate reassignments: for each vacated slot pick a new eligible person
    # who is free that night and not the victim, honoring spacing vs their base calls.
    candidates: list[RepairCandidate] = []
    forbidden_solutions: list[frozenset] = []

    # precompute each person's base call dates (for spacing) and their absence
    base_call_dates: dict[str, set[date]] = defaultdict(set)
    for a in req.baseAssignments:
        s = slot_by_id.get(a.slotId)
        if s and s.grain == "call-night":
            base_call_dates[a.personId].add(idx.call_date(s))

    # base call load per person — repair should prefer fellows below their fair share
    base_call_count: dict[str, int] = defaultdict(int)
    for a in req.baseAssignments:
        s = slot_by_id.get(a.slotId)
        if s and s.grain == "call-night":
            base_call_count[a.personId] += 1

    # jeopardy (backup) fellow per date — activating them is the intended, near-zero-cost fix
    jeop_by_date: dict[date, set[str]] = defaultdict(set)
    for a in req.baseAssignments:
        s = slot_by_id.get(a.slotId)
        if s and s.grain == "week":
            ws, we = parse_date(s.start), parse_date(s.end)
            d = ws
            while d < we:
                jeop_by_date[d].add(a.personId)
                d += timedelta(days=1)

    attempt = 0
    while len(candidates) < req.maxCandidates and attempt < req.maxCandidates * 4:
        attempt += 1
        m = cp_model.CpModel()
        y: dict[tuple[str, str], cp_model.IntVar] = {}
        for s in vacated:
            for p in idx.eligible(s):
                if p.id == victim:
                    continue
                d = idx.call_date(s) if s.grain == "call-night" else parse_date(s.start)
                if s.grain == "call-night" and d in idx.absent_days.get(p.id, set()):
                    continue
                # not already on call that same night in base
                if s.grain == "call-night" and d in base_call_dates.get(p.id, set()):
                    continue
                # never put a substitute on call the night before their clinic day
                if s.grain == "call-night" and p.clinicDay and \
                        weekday_code(d + timedelta(days=1)) == p.clinicDay:
                    continue
                y[(s.id, p.id)] = m.NewBoolVar(f"y_{s.id}_{p.id}")
        # each vacated slot gets exactly one new person
        for s in vacated:
            vs = [y[(s.id, p.id)] for p in idx.eligible(s) if (s.id, p.id) in y]
            if not vs:
                return RepairResponse(feasible=False, seed=req.seed, inputHash=in_hash,
                                      conflicts=[Conflict(ruleIds=[], text=(
                                          "No eligible, available fellow can cover a vacated "
                                          "call night — activate a jeopardy tier or widen eligibility."))])
            m.Add(sum(vs) == 1)
        # spacing: a person shouldn't be given a night within 3 of one of their base calls
        for (sid, pid), var in y.items():
            s = slot_by_id[sid]
            if s.grain == "call-night":
                d = idx.call_date(s)
                if any(abs((d - bd).days) < 3 for bd in base_call_dates.get(pid, set())):
                    m.Add(var == 0)  # protect rest/spacing of the substitute

        # disruption objective: fewer distinct people touched is better; prefer jeopardy family later
        people_touched = {}
        touched_vars = []
        for p in idx.people.values():
            pv = m.NewBoolVar(f"touch_{p.id}")
            mine = [y[(s.id, p.id)] for s in vacated if (s.id, p.id) in y]
            if mine:
                m.AddMaxEquality(pv, mine)
            else:
                m.Add(pv == 0)
            people_touched[p.id] = pv
            touched_vars.append(pv)
        if req.maxPeopleTouched:
            m.Add(sum(touched_vars) <= req.maxPeopleTouched)

        # jeopardy bonus + equity: prefer the week's backup fellow, then whoever is
        # currently below their fair call share (fewest existing calls).
        pref_terms = []
        for (sid, pid), var in y.items():
            s = slot_by_id[sid]
            d = idx.call_date(s) if s.grain == "call-night" else parse_date(s.start)
            reward = base_call_count.get(pid, 0)          # lower load -> lower cost (added)
            if pid in jeop_by_date.get(d, set()):
                reward -= 50                              # designated backup: strong preference
            pref_terms.append(reward * var)

        # forbid previous solutions for diversity
        for fs in forbidden_solutions:
            m.Add(sum(y[k] for k in fs if k in y) <= len(fs) - 1)

        # minimize people touched (×100), then equity/jeopardy preference
        m.Minimize(100 * sum(touched_vars) + sum(pref_terms))
        solver = cp_model.CpSolver()
        solver.parameters.random_seed = req.seed + attempt
        solver.parameters.num_search_workers = 1
        solver.parameters.max_time_in_seconds = 10
        status = solver.Solve(m)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            break

        chosen = frozenset(k for k, v in y.items() if solver.Value(v) == 1)
        if chosen in forbidden_solutions:
            break
        forbidden_solutions.append(chosen)

        # build the candidate's full assignment set + diff
        changes = []
        touched = set()
        new_assignments = list(req.baseAssignments)  # copy
        idx_by_slot = {a.slotId: i for i, a in enumerate(new_assignments)}
        for (sid, pid) in chosen:
            s = slot_by_id[sid]
            old = base_by_slot.get(sid)
            d = idx.call_date(s) if s.grain == "call-night" else parse_date(s.start)
            changes.append(DiffChange(slotId=sid, serviceId=s.serviceId, date=str(d),
                                      **{"from": old.personId if old else None}, to=pid))
            touched.add(pid)
            if old:
                touched.add(old.personId)
                new_assignments[idx_by_slot[sid]] = Assignment(
                    id=f"a_{sid}_r", slotId=sid, personId=pid, status="draft",
                    provenance="repair", createdInVersion=(old.createdInVersion + 1))

        # backstop: run the independent validator on the full candidate; never
        # return one that would be refused at publish (block-severity violations).
        vres = run_validate(ValidateRequest(
            people=req.people, services=req.services, slots=req.slots,
            rules=req.rules, assignments=new_assignments, absences=[absence]))
        blocks = [v for v in vres.violations if v.severity == "block"]
        if blocks:
            continue  # discard; keep searching for a clean repair

        score = _disruption_score(changes, req, base_call_count, jeop_by_date, idx)
        expl = _repair_explanation(vacated, chosen, slot_by_id, idx, victim, jeop_by_date)
        candidates.append(RepairCandidate(
            assignments=new_assignments,
            diff=RepairDiff(changes=changes, peopleTouched=len(touched),
                            disruptionScore=score, violations=0),
            explanation=expl))

    candidates.sort(key=lambda c: c.diff.disruptionScore)
    return RepairResponse(feasible=True, candidates=candidates, seed=req.seed, inputHash=in_hash)


def _disruption_score(changes: list[DiffChange], req: RepairRequest,
                      base_call_count=None, jeop_by_date=None, idx=None) -> float:
    """Notice-weighted disruption + fairness. Nearer-term and unfair picks cost more;
    activating the designated backup (jeopardy) fellow is nearly free."""
    base_call_count = base_call_count or {}
    jeop_by_date = jeop_by_date or {}
    now = parse_date(req.event.now) if req.event.now else None
    mean_load = (sum(base_call_count.values()) / len(base_call_count)) if base_call_count else 0
    score = 0.0
    for c in changes:
        w = 1.0
        if now:
            days_out = (parse_date(c.date) - now).days
            if days_out < 7:
                w = 10.0
            elif days_out < 30:
                w = 4.0
        # fairness: assigning to someone above their fair share adds cost; below subtracts
        load_delta = base_call_count.get(c.to, 0) - mean_load
        w += 0.5 * load_delta
        # jeopardy activation is the intended, low-cost path
        d = parse_date(c.date)
        if c.to in jeop_by_date.get(d, set()):
            w = max(0.5, w - 3.0)
        score += w
    people = {c.to for c in changes} | {c.frm for c in changes if c.frm}
    return round(score + 0.5 * len(people), 2)


def _repair_explanation(vacated, chosen, slot_by_id, idx: Index, victim, jeop_by_date=None) -> str:
    jeop_by_date = jeop_by_date or {}
    vp = idx.people.get(victim)
    vname = vp.name if vp else victim
    picks = []
    for (sid, pid) in chosen:
        s = slot_by_id[sid]
        p = idx.people.get(pid)
        d = idx.call_date(s) if s.grain == "call-night" else parse_date(s.start)
        is_jeop = pid in jeop_by_date.get(d, set())
        tag = " (already this week's backup/jeopardy fellow)" if is_jeop else ""
        picks.append(f"{p.name if p else pid} covers {s.serviceId} on {d}{tag}")
    return (f"{vname} is out, vacating {len(vacated)} assignment(s). "
            + "; ".join(picks) + ". No other assignments were moved.")
