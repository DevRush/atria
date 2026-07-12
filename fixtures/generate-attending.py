#!/usr/bin/env python3
"""Deterministic attending cardiology division fixture (attending.json).

Mirrors the trainee fixture's shape so the app reuses everything: service-week
allocation as blocks (attending x block -> service line) + two nightly call
domains (Interventional/STEMI, privilege-gated; General/CICU, all) that the
CP-SAT solver fills. AY 2026-27, deterministic.
"""
import json
from datetime import date, timedelta
from pathlib import Path

OFF = "-04:00"
AY_START = date(2026, 7, 1)

# 16 attendings: (last, first, fte, privileges)
ATTENDINGS = [
    ("Okonkwo", "Chidi", 1.0, ["interventional"]),
    ("Bianchi", "Marco", 1.0, ["interventional"]),
    ("Nakamura", "Yuki", 0.8, ["interventional"]),
    ("Delacroix", "Louis", 1.0, ["interventional"]),
    ("Rahimi", "Nadia", 0.8, ["interventional"]),
    ("Oyelaran", "Bola", 1.0, ["interventional"]),
    ("Weiss", "Hannah", 0.6, ["ep"]),
    ("Fitzgerald", "Sean", 1.0, ["ep"]),
    ("Krishnan", "Meera", 0.8, ["ep"]),
    ("Abara", "Ngozi", 1.0, ["ep"]),
    ("Sokolov", "Dmitri", 1.0, ["imaging"]),
    ("Marchetti", "Elena", 0.6, ["imaging"]),
    ("Park", "Jin", 0.8, ["imaging"]),
    ("Thornton", "Grace", 1.0, ["general"]),
    ("Vasquez", "Ramon", 0.5, ["general"]),
    ("Osei", "Kwabena", 1.0, ["general"]),
]

WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI"]

# service lines used as blocks (families reuse the app's 6-hue system)
SERVICES = [
    ("CONSULT", "Consults", "consult", "rotation", 3),
    ("CICU", "CICU", "inpatient", "rotation", 2),
    ("IMAGING", "Imaging / TEE", "imaging", "rotation", 2),
    ("CATH", "Cath Lab", "procedural", "rotation", 2),
    ("EP", "EP Lab", "procedural", "rotation", 2),
    ("CLINIC", "Clinic", "ambulatory", "rotation", 0),   # weekly overlay, few
    ("ADMIN", "Admin / Teaching", "ambulatory", "rotation", 5),  # absorbs slack
]
# call domains (kind=call): (code, name, family)
CALL_DOMAINS = [
    ("STEMICALL", "Interventional / STEMI Call", "procedural"),
    ("GENCALL", "General / CICU Call", "inpatient"),
]


def pid(last):
    return "p_" + last.lower()


def eligible_block(privs):
    # everyone can do CONSULT/CICU/IMAGING/ADMIN/CLINIC; privilege gates CATH/EP
    svc = ["CONSULT", "CICU", "IMAGING", "ADMIN", "CLINIC"]
    if "interventional" in privs:
        svc.append("CATH")
    if "ep" in privs:
        svc.append("EP")
    if "imaging" in privs and "IMAGING" not in svc:
        svc.append("IMAGING")
    return svc


def main():
    people = []
    for i, (last, first, fte, privs) in enumerate(ATTENDINGS):
        elig = eligible_block(privs) + ["GENCALL"]
        if "interventional" in privs:
            elig.append("STEMICALL")
        people.append({
            "id": pid(last), "name": f"{first} {last}", "level": "Attending",
            "fte": fte, "eligibleServices": sorted(set(elig)),
            "clinicDay": WEEKDAYS[i % len(WEEKDAYS)],
        })

    services = [{"id": c, "name": n, "code": c, "family": f, "kind": k,
                "coverage": {"minPerWeekday": mn, "minPerWeekendDay": 0}}
               for (c, n, f, k, mn) in SERVICES]
    services += [{"id": c, "name": n, "code": c, "family": f, "kind": "call",
                 "coverage": {"minPerWeekday": 1, "minPerWeekendDay": 1}}
                for (c, n, f) in CALL_DOMAINS]

    # 13 four-week blocks
    blocks = []
    for b in range(13):
        s = AY_START + timedelta(days=28 * b)
        blocks.append({"index": b + 1, "start": s.isoformat(), "end": (s + timedelta(days=27)).isoformat()})

    slots = []
    # block slots: distribute coverage so each of 16 attendings has exactly one/block
    for b in blocks:
        s, e = b["start"], b["end"]
        for (code, _n, _f, _k, mn) in SERVICES:
            for r in range(1, mn + 1):
                slots.append({"id": f"slot_b{b['index']}_{code.lower()}_{r}", "serviceId": code,
                              "start": f"{s}T07:00:00{OFF}", "end": f"{e}T17:00:00{OFF}",
                              "grain": "block", "roleIndex": r})
    # nightly call slots per domain
    for i in range(365):
        d = AY_START + timedelta(days=i)
        nxt = d + timedelta(days=1)
        for (code, _n, _f) in CALL_DOMAINS:
            slots.append({"id": f"slot_{d.isoformat()}_{code.lower()}_1", "serviceId": code,
                          "start": f"{d.isoformat()}T17:00:00{OFF}", "end": f"{nxt.isoformat()}T07:00:00{OFF}",
                          "grain": "call-night", "roleIndex": 1})

    rules = [
        {"id": "a_r01", "type": "min_rest_after_call", "params": {"minHours": 14}, "level": "blocking",
         "tier": None, "scope": "all", "text": "≥14h rest after overnight call.", "confirmed": True, "replay": {"violationsLastYear": 0}},
        {"id": "a_r02", "type": "no_call_before_clinic", "params": {}, "level": "hard",
         "tier": None, "scope": "all", "text": "No call the night before a clinic day.", "confirmed": True, "replay": {"violationsLastYear": 0}},
        {"id": "a_r03", "type": "call_spacing", "params": {"minGapNights": 4}, "level": "soft",
         "tier": "should", "scope": "all", "text": "Space call ≥4 nights apart.", "confirmed": True, "replay": {"violationsLastYear": 1}},
        {"id": "a_r04", "type": "weekend_equity", "params": {"maxSpread": 2}, "level": "soft",
         "tier": "should", "scope": "all", "text": "Balance weekend call across attendings.", "confirmed": True, "replay": {"violationsLastYear": 0}},
        {"id": "a_r05", "type": "holiday_equity", "params": {"maxSpread": 1}, "level": "soft",
         "tier": "must", "scope": "all", "text": "Rotate holiday call fairly.", "confirmed": True, "replay": {"violationsLastYear": 0}},
    ]

    holidays = [
        {"date": "2026-07-04", "name": "Independence Day"}, {"date": "2026-09-07", "name": "Labor Day"},
        {"date": "2026-11-26", "name": "Thanksgiving"}, {"date": "2026-12-25", "name": "Christmas"},
        {"date": "2027-01-01", "name": "New Year's Day"}, {"date": "2027-05-31", "name": "Memorial Day"},
    ]

    fixture = {
        "meta": {"name": "Cardiology Division (Attending)", "academicYear": "2026-2027",
                 "start": AY_START.isoformat(), "end": "2027-06-30", "timezone": "America/New_York",
                 "groupType": "attending", "generator": "generate-attending.py", "schema": 1},
        "seed": 4711, "groupType": "attending", "blocks": blocks, "holidays": holidays,
        "people": people, "services": services, "slots": slots,
        "rules": rules, "locks": [], "assignments": [], "absences": [
            {"id": "abs_a1", "personId": "p_okonkwo", "start": "2026-10-16", "end": "2026-10-18",
             "type": "leave", "reasonCode": "OPAQUE-A1", "status": "approved"}
        ],
    }
    out = Path(__file__).parent / "attending.json"
    json.dump(fixture, open(out, "w"), indent=2)
    nblock = sum(1 for s in slots if s["grain"] == "block")
    ncall = sum(1 for s in slots if s["grain"] == "call-night")
    print(f"wrote {out}: {len(people)} attendings, {len(services)} services, "
          f"{nblock} block slots, {ncall} call slots ({len(CALL_DOMAINS)} domains)")


if __name__ == "__main__":
    main()
