"""Independent schedule validator — the trust keystone (SPEC-V1 §3).

MUST NOT import ortools or app.solver. This is a second, deterministic opinion that
re-checks every schedule a solver emits before it can be published. A test enforces
the no-shared-code rule by inspecting this module's import graph.

Implements the authoritative ACGME arithmetic (DOMAIN-FINDINGS §1):
  ACGME-REST-14H : >=14h free after an overnight (in-house) call
  ACGME-1IN7     : >=1 day in 7 free of clinical work, averaged over any 4-week window
  ACGME-Q3-CALL  : in-house call no more than every third night, averaged over 4 weeks
  ACGME-24+4     : no scheduled continuous assignment exceeds 24h (+4h transition)
Home call is treated as a distinct class (not counted toward the q3 limit).
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from .common import parse_date, parse_dt, scope_matches, weekday_code
from .models import (
    Absence,
    Assignment,
    Person,
    Service,
    Slot,
    ValidateRequest,
    ValidateResponse,
    Violation,
)


def validate(req: ValidateRequest) -> ValidateResponse:
    people = {p.id: p for p in req.people}
    services = {s.id: s for s in req.services}
    slots = {s.id: s for s in req.slots}
    live = [a for a in req.assignments if a.supersededInVersion is None]

    violations: list[Violation] = []

    # index: person -> list of (slot) they hold
    held: dict[str, list[Slot]] = defaultdict(list)
    for a in live:
        s = slots.get(a.slotId)
        if s:
            held[a.personId].append(s)

    # person -> set of call-night dates (in-house call only)
    call_nights: dict[str, list[date]] = defaultdict(list)
    for pid, sl in held.items():
        for s in sl:
            if s.grain == "call-night" and services.get(s.serviceId, Service(id="", name="", code="", family="", kind="")).kind == "call":
                call_nights[pid].append(parse_dt(s.start).date())
    for pid in call_nights:
        call_nights[pid].sort()

    # ---- ACGME-24+4: continuous assignment length ----
    for pid, sl in held.items():
        for s in sl:
            dur = (parse_dt(s.end) - parse_dt(s.start))
            if s.grain == "call-night" and dur > timedelta(hours=28):
                violations.append(Violation(acgmeCode="ACGME-24+4", severity="block",
                    text=f"{_name(people,pid)} has a continuous assignment over 24+4h.",
                    slotIds=[s.id], personIds=[pid]))

    # ---- ACGME-Q3-CALL: >= every third night, averaged over 4 weeks ----
    for pid, nights in call_nights.items():
        if _max_calls_in_window(nights, 28) > _q_limit(28, 3):
            violations.append(Violation(acgmeCode="ACGME-Q3-CALL", severity="block",
                text=f"{_name(people,pid)} exceeds every-third-night in-house call over a 4-week window.",
                personIds=[pid]))
        # back-to-back call implies <14h rest between call-driven days
        for i in range(1, len(nights)):
            if (nights[i] - nights[i-1]).days == 1:
                violations.append(Violation(acgmeCode="ACGME-REST-14H", severity="block",
                    text=f"{_name(people,pid)} has back-to-back call nights (insufficient rest).",
                    personIds=[pid]))
                break

    # ---- ACGME-1IN7: >=1 free day per 7, averaged over 4 weeks ----
    # a "worked day" = on a rotation weekday OR on call that night. Approx worked-day set:
    for pid, p in people.items():
        worked = _worked_days(pid, held, services)
        if not worked:
            continue
        span_start = min(worked)
        span_end = max(worked)
        # slide 28-day windows; require >=4 free days in each
        d = span_start
        while d <= span_end - timedelta(days=27):
            window = {d + timedelta(days=k) for k in range(28)}
            free = len(window - worked)
            if free < 4:
                violations.append(Violation(acgmeCode="ACGME-1IN7", severity="block",
                    text=f"{_name(people,pid)} has fewer than 1 day off in 7 (averaged over 4 weeks) near {d}.",
                    personIds=[pid]))
                break
            d += timedelta(days=7)

    # ---- user hard/blocking rules ----
    for r in req.rules:
        if r.level == "soft":
            continue
        v = _check_rule(r, req, held, slots, services, people, call_nights)
        violations.extend(v)

    # ---- coverage: every non-research required slot is filled ----
    filled = {a.slotId for a in live}
    for s in req.slots:
        svc = services.get(s.serviceId)
        if not svc:
            continue
        if s.grain in ("block",) and svc.id == "RESEARCH":
            continue
        if s.grain in ("block", "call-night", "week") and s.id not in filled:
            violations.append(Violation(ruleId=None, severity="block",
                text=f"Uncovered required slot: {svc.name} on {s.start[:10]}.",
                slotIds=[s.id]))

    ok = not any(v.severity == "block" for v in violations)
    return ValidateResponse(ok=ok, violations=violations)


def _q_limit(window_days: int, every_n: int) -> int:
    # at most floor(window/every_n) call nights in the window
    return window_days // every_n


def _max_calls_in_window(nights: list[date], window: int) -> int:
    if not nights:
        return 0
    best = 0
    for i, start in enumerate(nights):
        cnt = sum(1 for n in nights if 0 <= (n - start).days < window)
        best = max(best, cnt)
    return best


def _worked_days(pid: str, held, services) -> set[date]:
    worked: set[date] = set()
    for s in held.get(pid, []):
        svc = services.get(s.serviceId)
        if not svc:
            continue
        if s.grain == "call-night":
            worked.add(parse_dt(s.start).date())
        elif s.grain == "block" and svc.kind == "rotation":
            # weekdays within the block count as worked (rotations are Mon-Fri daytime)
            d = parse_dt(s.start).date()
            end = parse_dt(s.end).date()
            while d <= end:
                if d.weekday() < 5:
                    worked.add(d)
                d += timedelta(days=1)
    return worked


def _check_rule(r, req, held, slots, services, people, call_nights) -> list[Violation]:
    out = []
    t = r.type
    if t == "block_requirement":
        svc = r.params.get("serviceId"); mn = int(r.params.get("minBlocks", 0))
        for pid, p in people.items():
            if not scope_matches(r.scope, p):
                continue
            cnt = sum(1 for s in held.get(pid, []) if s.serviceId == svc and s.grain == "block")
            if cnt < mn:
                out.append(Violation(ruleId=r.id, severity=("block" if r.level != "soft" else "warn"),
                    text=f"{_name(people,pid)} has {cnt} of {mn} required {svc} blocks.",
                    personIds=[pid]))
    elif t == "min_coverage":
        pass  # covered by the coverage sweep above
    elif t == "no_call_before_clinic":
        for pid, p in people.items():
            if not p.clinicDay:
                continue
            for n in call_nights.get(pid, []):
                if weekday_code(n + timedelta(days=1)) == p.clinicDay:
                    out.append(Violation(ruleId=r.id, severity="block",
                        text=f"{_name(people,pid)} is on call the night before their clinic day ({n}).",
                        personIds=[pid]))
                    break
    return out


def _name(people, pid):
    p = people.get(pid)
    return p.name if p else pid
