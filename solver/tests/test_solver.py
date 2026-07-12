"""Verification for the Atria solver. Small inline fixture keeps tests fast;
one test exercises the real fellowship fixture end-to-end."""
import json
import time
from datetime import date, timedelta
from pathlib import Path

import pytest

from app.models import (
    RepairEvent,
    RepairRequest,
    SolveRequest,
    ValidateRequest,
)
from app.solver import solve_generate, solve_repair
from app.validator import validate

FIXTURE = Path(__file__).parent.parent.parent / "fixtures" / "fellowship.json"


# ---------- tiny inline instance: 4 fellows, 2 rotations, one week of call ----------

def tiny():
    people = [
        {"id": "p_a", "name": "A", "level": "F1", "fte": 1.0,
         "eligibleServices": ["WARD", "CONS", "CALL"], "clinicDay": "MON"},
        {"id": "p_b", "name": "B", "level": "F1", "fte": 1.0,
         "eligibleServices": ["WARD", "CONS", "CALL"], "clinicDay": "TUE"},
        {"id": "p_c", "name": "C", "level": "F2", "fte": 1.0,
         "eligibleServices": ["WARD", "CONS", "CALL"], "clinicDay": "WED"},
        {"id": "p_d", "name": "D", "level": "F2", "fte": 1.0,
         "eligibleServices": ["WARD", "CONS", "CALL"], "clinicDay": "THU"},
    ]
    services = [
        {"id": "WARD", "name": "Wards", "code": "WARD", "family": "inpatient", "kind": "rotation",
         "coverage": {"minPerWeekday": 1, "minPerWeekendDay": 1}},
        {"id": "CONS", "name": "Consults", "code": "CONS", "family": "consult", "kind": "rotation",
         "coverage": {"minPerWeekday": 1, "minPerWeekendDay": 0}},
        {"id": "CALL", "name": "Call", "code": "CALL", "family": "inpatient", "kind": "call",
         "coverage": {"minPerWeekday": 1, "minPerWeekendDay": 1}},
    ]
    slots = []
    # one 4-week block, 2 WARD + 2 CONS role slots
    for svc, n in [("WARD", 2), ("CONS", 2)]:
        for r in range(1, n + 1):
            slots.append({"id": f"slot_b1_{svc.lower()}_{r}", "serviceId": svc,
                          "start": "2026-07-01T07:00:00-04:00", "end": "2026-07-28T17:00:00-04:00",
                          "grain": "block", "roleIndex": r})
    # 28 nightly call slots
    d0 = date(2026, 7, 1)
    for i in range(28):
        d = d0 + timedelta(days=i)
        slots.append({"id": f"slot_{d}_call_1", "serviceId": "CALL",
                      "start": f"{d}T17:00:00-04:00", "end": f"{d + timedelta(days=1)}T07:00:00-04:00",
                      "grain": "call-night", "roleIndex": 1})
    rules = [
        {"id": "r1", "type": "call_spacing", "params": {"minGapNights": 3}, "level": "soft",
         "tier": "should", "scope": "all", "text": "Space call >=3 nights."},
        {"id": "r2", "type": "no_call_before_clinic", "params": {}, "level": "hard",
         "tier": None, "scope": "all", "text": "No call the night before clinic."},
    ]
    return dict(people=people, services=services, slots=slots, rules=rules, locks=[], absences=[])


def test_generate_feasible_and_valid():
    d = tiny()
    res = solve_generate(SolveRequest(**d, seed=1, timeBudgetSec=15))
    assert res.feasible, res.conflicts
    v = validate(ValidateRequest(people=d["people"], services=d["services"], slots=d["slots"],
                                 rules=d["rules"], assignments=[a.model_dump() for a in res.assignments]))
    assert v.ok, [x.text for x in v.violations if x.severity == "block"]


def test_determinism():
    d = tiny()
    a = solve_generate(SolveRequest(**d, seed=7, timeBudgetSec=15))
    b = solve_generate(SolveRequest(**d, seed=7, timeBudgetSec=15))
    assert a.inputHash == b.inputHash
    sig = lambda r: sorted((x.slotId, x.personId) for x in r.assignments)
    assert sig(a) == sig(b)


def test_infeasibility_is_named_not_bare():
    d = tiny()
    # impossible: everyone must do >=3 blocks of WARD but there is only one block
    d["rules"].append({"id": "r_bad", "type": "block_requirement",
                       "params": {"serviceId": "WARD", "minBlocks": 3}, "level": "hard",
                       "tier": None, "scope": "all", "text": "Everyone needs 3 ward blocks."})
    res = solve_generate(SolveRequest(**d, seed=1, timeBudgetSec=15))
    assert res.feasible is False
    assert res.conflicts
    joined = " ".join(c.text for c in res.conflicts).lower()
    assert "infeasible" not in joined  # never the bare word
    assert any(c.relaxations for c in res.conflicts)


def test_repair_minimal_and_fast():
    d = tiny()
    res = solve_generate(SolveRequest(**d, seed=3, timeBudgetSec=15))
    assert res.feasible
    # find a call night someone holds, make them absent that day
    call = [a for a in res.assignments if a.slotId.endswith("_call_1") and "call" in a.slotId]
    victim = call[0].personId
    vdate = call[0].slotId.split("_")[1]
    absence = {"id": "ab1", "personId": victim, "start": vdate, "end": vdate,
               "type": "sick", "status": "approved"}
    t = time.time()
    rr = solve_repair(RepairRequest(**{**d, "absences": [absence]},
                                    baseAssignments=[a.model_dump() for a in res.assignments],
                                    event=RepairEvent(kind="absence", absenceId="ab1", now=vdate),
                                    maxCandidates=3, seed=3))
    assert time.time() - t < 10
    assert rr.feasible and rr.candidates
    c0 = rr.candidates[0]
    assert c0.diff.peopleTouched <= 4
    assert len(c0.diff.changes) >= 1
    # the victim no longer holds the vacated night
    assert all(not (a.personId == victim and a.slotId == call[0].slotId) for a in c0.assignments)


def test_locks_survive_repair():
    d = tiny()
    res = solve_generate(SolveRequest(**d, seed=5, timeBudgetSec=15))
    ward = next(a for a in res.assignments if "ward" in a.slotId)
    locked_person, locked_slot = ward.personId, ward.slotId
    d["locks"] = [{"assignmentId": ward.id, "by": "coordinator", "reason": "PD", "hard": True}]
    # absent someone else's call night; the locked ward assignment must remain
    call = next(a for a in res.assignments if a.slotId.endswith("_call_1") and a.personId != locked_person)
    vdate = call.slotId.split("_")[1]
    absence = {"id": "ab2", "personId": call.personId, "start": vdate, "end": vdate,
               "type": "sick", "status": "approved"}
    rr = solve_repair(RepairRequest(**{**d, "absences": [absence]},
                                    baseAssignments=[a.model_dump() for a in res.assignments],
                                    event=RepairEvent(kind="absence", absenceId="ab2", now=vdate),
                                    maxCandidates=1, seed=5))
    assert rr.feasible
    for cand in rr.candidates:
        assert any(a.slotId == locked_slot and a.personId == locked_person for a in cand.assignments)


def test_validator_catches_injected_violation():
    d = tiny()
    res = solve_generate(SolveRequest(**d, seed=2, timeBudgetSec=15))
    assignments = [a.model_dump() for a in res.assignments]
    # inject back-to-back call nights for one person -> ACGME rest violation
    p = res.assignments[0].personId
    calls = sorted([s for s in d["slots"] if s["grain"] == "call-night"], key=lambda s: s["start"])
    assignments = [a for a in assignments if not (
        s_is_call(a, d) )]  # drop existing call assignments
    for i in range(2):  # two consecutive nights, same person
        assignments.append({"id": f"inj{i}", "slotId": calls[i]["id"], "personId": p,
                            "status": "draft", "provenance": "manual", "createdInVersion": 1,
                            "supersededInVersion": None})
    v = validate(ValidateRequest(people=d["people"], services=d["services"], slots=d["slots"],
                                 rules=d["rules"], assignments=assignments))
    assert not v.ok
    assert any(x.acgmeCode == "ACGME-REST-14H" for x in v.violations)


def s_is_call(a, d):
    slot = next((s for s in d["slots"] if s["id"] == a["slotId"]), None)
    return bool(slot and slot["grain"] == "call-night")


def test_holiday_equity_is_wired_not_a_no_op():
    """Regression guard: holiday_dates must be threaded from the request into the
    engine (it was once hardcoded to an empty set, making holiday_equity a silent
    no-op) and generation must stay feasible/valid with holidays supplied."""
    from app.solver import Index
    d = tiny()
    hols = ["2026-07-03", "2026-07-07", "2026-07-11", "2026-07-15"]  # >=3 nights apart
    req = SolveRequest(**d, holidays=hols, seed=1, timeBudgetSec=15)
    # the request actually reaches the engine index (the line that used to be set())
    assert {x.isoformat() for x in Index(req).holiday_dates} == set(hols)
    res = solve_generate(req)
    assert res.feasible, res.conflicts
    v = validate(ValidateRequest(people=d["people"], services=d["services"], slots=d["slots"],
                                 rules=d["rules"], assignments=[a.model_dump() for a in res.assignments]))
    assert v.ok, [x.text for x in v.violations if x.severity == "block"]
    # every holiday night is covered, and equity keeps any one fellow from hoarding them
    share: dict[str, int] = {}
    for a in res.assignments:
        parts = a.slotId.split("_")
        if a.slotId.endswith("_call_1") and len(parts) >= 2 and parts[1] in set(hols):
            share[a.personId] = share.get(a.personId, 0) + 1
    assert sum(share.values()) == len(hols)
    assert max(share.values()) <= 2


def test_validator_independence():
    """The validator must not depend on ortools or the solver (trust keystone)."""
    import ast
    src = (Path(__file__).parent.parent / "app" / "validator.py").read_text()
    tree = ast.parse(src)
    imported = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported += [n.name for n in node.names]
        elif isinstance(node, ast.ImportFrom):
            imported.append(node.module or "")
    assert not any("ortools" in m for m in imported), "validator must not import ortools"
    assert not any("solver" in m for m in imported), "validator must not import the solver"


@pytest.mark.skipif(not FIXTURE.exists(), reason="real fixture not generated")
def test_real_fixture_end_to_end():
    fx = json.loads(FIXTURE.read_text())
    t = time.time()
    res = solve_generate(SolveRequest(people=fx["people"], services=fx["services"], slots=fx["slots"],
                                      rules=fx["rules"], locks=fx["locks"], absences=[], seed=4711,
                                      timeBudgetSec=60))
    gen_time = time.time() - t
    assert res.feasible, [c.text for c in res.conflicts]
    assert gen_time < 60, f"generate took {gen_time:.1f}s"
    v = validate(ValidateRequest(people=fx["people"], services=fx["services"], slots=fx["slots"],
                                 rules=fx["rules"], assignments=[a.model_dump() for a in res.assignments]))
    assert v.ok, [x.text for x in v.violations if x.severity == "block"]
    # repair the planted absence
    absence = fx["absences"][0]
    t = time.time()
    rr = solve_repair(RepairRequest(people=fx["people"], services=fx["services"], slots=fx["slots"],
                                    rules=fx["rules"], locks=fx["locks"], absences=[absence],
                                    baseAssignments=[a.model_dump() for a in res.assignments],
                                    event=RepairEvent(kind="absence", absenceId=absence["id"], now="2026-11-13"),
                                    maxCandidates=3, seed=4711))
    assert time.time() - t < 10
    assert rr.feasible and rr.candidates
    assert rr.candidates[0].diff.peopleTouched <= 4
