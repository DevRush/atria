"""Shared helpers: time parsing, canonical hashing, scope matching."""
from __future__ import annotations

import hashlib
import json
from datetime import date, datetime, timedelta
from typing import Iterable

from .models import Person, Slot

WEEKDAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]


def parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s)


def parse_date(s: str) -> date:
    return date.fromisoformat(s[:10])


def slot_start(slot: Slot) -> datetime:
    return parse_dt(slot.start)


def slot_end(slot: Slot) -> datetime:
    return parse_dt(slot.end)


def weekday_code(d: date) -> str:
    return WEEKDAY_NAMES[d.weekday()]


def is_weekend(d: date) -> bool:
    return d.weekday() >= 5


def daterange(start: date, end: date) -> Iterable[date]:
    cur = start
    while cur <= end:
        yield cur
        cur += timedelta(days=1)


def scope_matches(scope: str, person: Person) -> bool:
    if scope in ("all", "", None):
        return True
    if scope.startswith("level:"):
        return person.level == scope.split(":", 1)[1]
    if scope.startswith("person:"):
        return person.id == scope.split(":", 1)[1]
    return True


def canonical_hash(payload: dict) -> str:
    """Stable sha256 over canonicalized JSON — the reproducibility anchor."""
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return "sha256:" + hashlib.sha256(blob.encode()).hexdigest()[:32]


def absence_days(start: str, end: str) -> set[date]:
    return set(daterange(parse_date(start), parse_date(end)))
