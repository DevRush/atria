"""Pydantic models mirroring docs/SCHEMA.md exactly. Field names are the contract."""
from __future__ import annotations

from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class Person(BaseModel):
    id: str
    name: str
    level: str  # F1 | F2 | F3
    fte: float = 1.0
    eligibleServices: list[str]
    clinicDay: Optional[str] = None  # MON..FRI


class Coverage(BaseModel):
    minPerWeekday: int = 0
    minPerWeekendDay: int = 0


class Service(BaseModel):
    id: str
    name: str
    code: str
    family: str  # procedural|imaging|inpatient|consult|ambulatory|backup
    kind: str    # rotation|call|clinic|jeopardy
    coverage: Coverage = Field(default_factory=Coverage)


class Slot(BaseModel):
    id: str
    serviceId: str
    start: str  # ISO-8601 with tz
    end: str
    grain: str  # block|week|day|call-night|halfday
    roleIndex: int = 1


class Assignment(BaseModel):
    id: str
    slotId: str
    personId: str
    status: str = "draft"
    locked: bool = False
    provenance: str = "solver"  # solver|manual|swap|repair|import
    createdInVersion: int = 1
    supersededInVersion: Optional[int] = None


class Absence(BaseModel):
    id: str
    personId: str
    start: str  # YYYY-MM-DD
    end: str
    type: str
    reasonCode: Optional[str] = None
    status: str = "approved"


class Rule(BaseModel):
    id: str
    type: str
    params: dict[str, Any] = Field(default_factory=dict)
    level: str  # hard|blocking|soft
    tier: Optional[str] = None  # must|should|nice (soft only)
    scope: str = "all"  # all | level:F1 | person:p_x
    source: Optional[str] = None
    text: str = ""
    confirmed: bool = True
    replay: Optional[dict[str, Any]] = None


class Lock(BaseModel):
    assignmentId: str
    by: str = "coordinator"
    reason: str = ""
    hard: bool = True


# ---- API payloads ----

class SolveRequest(BaseModel):
    people: list[Person]
    services: list[Service]
    slots: list[Slot]
    rules: list[Rule] = []
    locks: list[Lock] = []
    assignments: list[Assignment] = []  # existing assignments locks resolve against
    absences: list[Absence] = []
    seed: int = 4711
    timeBudgetSec: float = 60.0


class RepairEvent(BaseModel):
    kind: str = "absence"  # absence
    absenceId: Optional[str] = None
    now: Optional[str] = None  # ISO datetime treated as "current moment"


class RepairRequest(SolveRequest):
    baseAssignments: list[Assignment] = []
    event: RepairEvent
    maxPeopleTouched: Optional[int] = None
    maxCandidates: int = 3


class ValidateRequest(BaseModel):
    people: list[Person]
    services: list[Service]
    slots: list[Slot]
    rules: list[Rule] = []
    assignments: list[Assignment]
    absences: list[Absence] = []


class Relaxation(BaseModel):
    description: str
    cost: float


class Conflict(BaseModel):
    ruleIds: list[str]
    text: str
    relaxations: list[Relaxation] = []


class SolveResponse(BaseModel):
    feasible: bool
    assignments: list[Assignment] = []
    objective: dict[str, Any] = {}
    conflicts: list[Conflict] = []
    seed: int = 4711
    inputHash: str = ""
    telemetry: dict[str, Any] = {}


class DiffChange(BaseModel):
    slotId: str
    serviceId: str
    date: str
    frm: Optional[str] = Field(default=None, alias="from")
    to: Optional[str] = None

    model_config = {"populate_by_name": True}


class RepairDiff(BaseModel):
    changes: list[DiffChange] = []
    peopleTouched: int = 0
    disruptionScore: float = 0.0
    violations: int = 0


class RepairCandidate(BaseModel):
    assignments: list[Assignment] = []
    diff: RepairDiff
    explanation: str = ""


class RepairResponse(BaseModel):
    feasible: bool
    candidates: list[RepairCandidate] = []
    seed: int = 4711
    inputHash: str = ""
    conflicts: list[Conflict] = []


class Violation(BaseModel):
    ruleId: Optional[str] = None
    acgmeCode: Optional[str] = None
    severity: str  # block | warn
    text: str
    slotIds: list[str] = []
    personIds: list[str] = []


class ValidateResponse(BaseModel):
    ok: bool
    violations: list[Violation] = []
