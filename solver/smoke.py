"""Smoke test: generate on the real fixture, validate, then repair the demo absence."""
import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from app.models import SolveRequest, RepairRequest, ValidateRequest, RepairEvent
from app.solver import solve_generate, solve_repair
from app.validator import validate

fx = json.load(open(Path(__file__).parent.parent / "fixtures" / "fellowship.json"))

req = SolveRequest(people=fx["people"], services=fx["services"], slots=fx["slots"],
                   rules=fx["rules"], locks=fx["locks"], absences=[], seed=4711, timeBudgetSec=60)

t = time.time()
res = solve_generate(req)
print(f"GENERATE feasible={res.feasible} wall={time.time()-t:.1f}s telemetry={res.telemetry}")
if not res.feasible:
    for c in res.conflicts:
        print("  CONFLICT:", c.text, "rules=", c.ruleIds)
    sys.exit(1)
print(f"  assignments={len(res.assignments)}")

# validate the generated schedule
vres = validate(ValidateRequest(people=fx["people"], services=fx["services"], slots=fx["slots"],
                                rules=fx["rules"], assignments=[a.model_dump() for a in res.assignments],
                                absences=[]))
blocks = [v for v in vres.violations if v.severity == "block"]
warns = [v for v in vres.violations if v.severity == "warn"]
print(f"VALIDATE ok={vres.ok} blocks={len(blocks)} warns={len(warns)}")
for v in blocks[:8]:
    print("  BLOCK:", v.acgmeCode or v.ruleId, v.text)

# what is p_okafor assigned around the absence?
absence = fx["absences"][0]
print(f"\nDEMO ABSENCE: {absence['personId']} {absence['start']}..{absence['end']}")
okafor = [a for a in res.assignments if a.personId == absence["personId"]]
slotmap = {s["id"]: s for s in fx["slots"]}
from app.common import parse_date, absence_days
adays = absence_days(absence["start"], absence["end"])
hits = []
for a in okafor:
    s = slotmap[a.slotId]
    if s["grain"] == "call-night" and parse_date(s["start"]) in adays:
        hits.append((s["serviceId"], s["start"][:10]))
    elif s["grain"] == "week":
        ws, we = parse_date(s["start"]), parse_date(s["end"])
        if any(ws <= d < we for d in adays):
            hits.append((s["serviceId"], s["start"][:10]))
print(f"  okafor total assignments={len(okafor)}; overlapping absence: {hits}")

# repair
rreq = RepairRequest(people=fx["people"], services=fx["services"], slots=fx["slots"],
                     rules=fx["rules"], locks=fx["locks"], absences=[absence],
                     baseAssignments=[a.model_dump() for a in res.assignments],
                     event=RepairEvent(kind="absence", absenceId=absence["id"], now="2026-11-13"),
                     maxCandidates=3, seed=4711)
t = time.time()
rr = solve_repair(rreq)
print(f"\nREPAIR feasible={rr.feasible} wall={time.time()-t:.1f}s candidates={len(rr.candidates)}")
for i, c in enumerate(rr.candidates):
    print(f"  cand{i}: touched={c.diff.peopleTouched} score={c.diff.disruptionScore} changes={len(c.diff.changes)}")
    print(f"         {c.explanation}")
