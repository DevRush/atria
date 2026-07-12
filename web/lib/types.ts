/**
 * Atria shared data contract — mirrors docs/SCHEMA.md exactly.
 * Field names are law: the pydantic models in solver/app/models.py use the
 * same names on the other side of the HTTP boundary.
 *
 * ISO-8601 datetimes with timezone offset; dates as YYYY-MM-DD.
 * IDs are short strings (p_ana, slot_2026-08-03_cath_am).
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export type Level = "F1" | "F2" | "F3" | "Attending";

export type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

/** One of 6 — drives hue (design tokens in app/globals.css). */
export type ServiceFamily =
  | "procedural"
  | "imaging"
  | "inpatient"
  | "consult"
  | "ambulatory"
  | "backup";

export type ServiceKind = "rotation" | "call" | "clinic" | "jeopardy";

/** One slot object, every grain (SPEC §2). */
export type SlotGrain = "block" | "week" | "day" | "call-night" | "halfday";

export type AssignmentStatus = "draft" | "published";

export type AssignmentProvenance = "solver" | "manual" | "swap" | "repair" | "import";

export type AbsenceType = "vacation" | "sick" | "leave" | "away" | "conference";

export type AbsenceStatus = "pending" | "approved" | "denied";

/** hard | blocking (overridable with named waiver) | soft */
export type RuleLevel = "hard" | "blocking" | "soft";

/** Soft rules only. */
export type RuleTier = "must" | "should" | "nice";

/** Rule catalog (v1 types, closed set). The only thing Claude may emit. */
export type RuleType =
  | "min_coverage"
  | "max_consecutive_call"
  | "min_rest_after_call"
  | "one_in_seven_free"
  | "no_call_before_clinic"
  | "clinic_day_protected"
  | "block_requirement"
  | "max_service_gap"
  | "pair_exclusion"
  | "fixed_assignment"
  | "do_not_schedule"
  | "holiday_equity"
  | "call_spacing"
  | "weekend_equity"
  | "jeopardy_payback";

/** Hard-coded ACGME validator checks — always run, regardless of captured rules. */
export type AcgmeCode = "ACGME-24+4" | "ACGME-REST-14H" | "ACGME-1IN7" | "ACGME-Q3-CALL";

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface Person {
  id: string;
  name: string;
  level: Level;
  fte: number;
  /** Service codes this person may staff. */
  eligibleServices: string[];
  /** Fixed weekly continuity-clinic half-day (COCATS — hard weekly overlay). */
  clinicDay: Weekday | null;
}

export interface ServiceCoverage {
  minPerWeekday: number;
  minPerWeekendDay: number;
}

export interface Service {
  id: string;
  name: string;
  /** Text short-code (CATH, ECHO, CCU, JEOP…) — the identity carrier in UI. */
  code: string;
  family: ServiceFamily;
  kind: ServiceKind;
  coverage: ServiceCoverage;
}

/** One assignable unit of demand at any grain. Call-night slots run 17:00→07:00 (+1d). */
export interface Slot {
  id: string;
  serviceId: string;
  /** ISO-8601 datetime with timezone offset. */
  start: string;
  /** ISO-8601 datetime with timezone offset. */
  end: string;
  grain: SlotGrain;
  /** Distinguishes multiple people needed on one service-interval. */
  roleIndex: number;
}

/** Append-only; edits create a new row superseding the old. */
export interface Assignment {
  id: string;
  slotId: string;
  personId: string;
  status: AssignmentStatus;
  locked: boolean;
  provenance: AssignmentProvenance;
  createdInVersion: number;
  supersededInVersion: number | null;
}

export interface Absence {
  id: string;
  personId: string;
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD */
  end: string;
  type: AbsenceType;
  /** Opaque code, never free text (invariant 8: no PHI). */
  reasonCode: string;
  status: AbsenceStatus;
}

export interface Holiday {
  /** YYYY-MM-DD */
  date: string;
  name: string;
}

export interface RuleReplay {
  violationsLastYear: number;
}

/** Typed DSL record — the only thing Claude may emit (invariant 2). */
export interface Rule {
  id: string;
  type: RuleType;
  params: Record<string, unknown>;
  level: RuleLevel;
  /** Soft rules only; null otherwise. */
  tier: RuleTier | null;
  scope: string;
  /** Provenance, e.g. "excel:Sheet1!B4". */
  source: string | null;
  /** Plain-English sentence paired with the typed record. */
  text: string;
  /** Zero unconfirmed rules reach the solver. */
  confirmed: boolean;
  replay: RuleReplay | null;
}

/** Locks are absolute (invariant 4): survive every re-solve, priced, never overridden. */
export interface Lock {
  assignmentId: string;
  by: string;
  reason: string;
  hard: boolean;
}

export interface VersionCause {
  kind: string; // "initial" | "repair" | "amendment" | ...
  absenceId?: string;
}

export interface VersionDiff {
  changed: number;
  peopleTouched: number;
  violations: number;
}

/** Published versions are immutable (invariant 5). Append-only. */
export interface ScheduleVersion {
  version: number;
  /** ISO-8601 datetime. */
  publishedAt: string;
  publishedBy: string;
  parent: number | null;
  cause: VersionCause | null;
  diff: VersionDiff | null;
  inputHash: string | null;
  seed: number | null;
}

// ---------------------------------------------------------------------------
// Solver API (FastAPI, :8000) — docs/SCHEMA.md "Solver API"
// ---------------------------------------------------------------------------

export interface SolveRequest {
  people: Person[];
  services: Service[];
  slots: Slot[];
  rules: Rule[];
  locks: Lock[];
  absences: Absence[];
  /** Program holiday dates (YYYY-MM-DD) — drive holiday-call equity. */
  holidays?: string[];
  seed?: number;
  timeBudgetSec?: number;
}

export interface Relaxation {
  description: string;
  cost: number;
}

/** Conflicts name user rules via assumption literals. NEVER the bare word "infeasible". */
export interface Conflict {
  ruleIds: string[];
  text: string;
  relaxations: Relaxation[];
}

export interface SolveResponseFeasible {
  assignments: Assignment[];
  objective: { tierScores: Record<string, number> };
  feasible: true;
  seed: number;
  inputHash: string;
  telemetry: Record<string, unknown>;
}

export interface SolveResponseInfeasible {
  feasible: false;
  conflicts: Conflict[];
}

export type SolveResponse = SolveResponseFeasible | SolveResponseInfeasible;

export interface RepairEvent {
  kind: "absence";
  absenceId: string;
  now?: string;
}

export interface RepairRequest extends SolveRequest {
  baseAssignments: Assignment[];
  event: RepairEvent;
  maxPeopleTouched?: number;
  maxCandidates: number;
}

export interface DiffChange {
  slotId: string;
  serviceId: string;
  date: string;
  from: string | null; // personId
  to: string | null; // personId
}

export interface RepairCandidateDiff {
  changes: DiffChange[];
  peopleTouched: number;
  disruptionScore: number;
  violations: number;
}

export interface RepairCandidate {
  assignments: Assignment[];
  diff: RepairCandidateDiff;
  explanation: string;
}

export interface RepairResponse {
  feasible: boolean;
  candidates: RepairCandidate[];
  seed?: number;
  inputHash?: string;
  conflicts?: Conflict[];
}

export interface ValidateRequest {
  people: Person[];
  services: Service[];
  slots: Slot[];
  rules: Rule[];
  assignments: Assignment[];
  absences: Absence[];
  holidays?: string[];
}

export interface Violation {
  ruleId?: string;
  acgmeCode?: AcgmeCode | string;
  severity: "block" | "warn";
  text: string;
  slotIds: string[];
  personIds: string[];
}

export interface ValidateResponse {
  ok: boolean;
  violations: Violation[];
  /** Provenance: which validator produced this verdict. */
  validatorVersion?: string;
}

// ---------------------------------------------------------------------------
// Web-side API shapes (web/app/api/*) — built from the entities above
// ---------------------------------------------------------------------------

/** GET /api/state */
export interface StateResponse {
  people: Person[];
  services: Service[];
  slots: Slot[];
  rules: Rule[];
  /** Current published head: status=published, supersededInVersion=null. */
  assignments: Assignment[];
  absences: Absence[];
  locks: Lock[];
  /** Program holidays — drive holiday-call equity and the fairness ledger. */
  holidays: Holiday[];
  /** Latest published version, null before first publish. */
  currentVersion: ScheduleVersion | null;
}

/**
 * The typed override waiver — the ONLY bypass for blocking violations at
 * publish (CLAUDE.md invariant 1; SPEC §3 level-2 rules). A named human,
 * a reason, and explicit acknowledgment of what is being overridden.
 */
export interface PublishOverride {
  by: string;
  reason: string;
}

/** POST /api/publish */
export interface PublishRequest {
  assignments: Array<
    Pick<Assignment, "slotId" | "personId"> &
      Partial<Pick<Assignment, "locked" | "provenance">>
  >;
  publishedBy: string;
  cause?: VersionCause;
  /** From the solve/repair that produced these assignments (reproducibility). */
  inputHash?: string;
  seed?: number;
  override?: PublishOverride;
}

export interface PublishResponseOk {
  ok: true;
  version: ScheduleVersion;
  /** Violations that were overridden (empty on clean publishes). */
  overriddenViolations: Violation[];
}

export interface PublishResponseRefused {
  ok: false;
  error: string;
  violations: Violation[];
}

export type PublishResponse = PublishResponseOk | PublishResponseRefused;

/** POST /api/absences */
export interface CreateAbsenceRequest {
  personId: string;
  start: string;
  end: string;
  type: AbsenceType;
  reasonCode?: string;
  status?: AbsenceStatus;
}
