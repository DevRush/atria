import { prisma } from "@/lib/db";
import type {
  Absence,
  Assignment,
  Lock,
  Person,
  Rule,
  ScheduleVersion,
  Service,
  Slot,
  StateResponse,
} from "@/lib/types";

/**
 * Maps Prisma rows (JSON columns are `unknown`) back onto the SCHEMA.md shapes.
 * This is the single read path: /api/state serves exactly this object, and the
 * /oncall static-read-path page reads the same rows directly.
 */

type Row = Record<string, unknown>;

function toPerson(row: Row): Person {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    fte: row.fte,
    eligibleServices: row.eligibleServices ?? [],
    clinicDay: row.clinicDay ?? null,
  } as Person;
}

function toService(row: Row): Service {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    family: row.family,
    kind: row.kind,
    coverage: row.coverage,
  } as Service;
}

function toSlot(row: Row): Slot {
  return {
    id: row.id,
    serviceId: row.serviceId,
    start: row.start,
    end: row.end,
    grain: row.grain,
    roleIndex: row.roleIndex,
  } as Slot;
}

function toAssignment(row: Row): Assignment {
  return {
    id: row.id,
    slotId: row.slotId,
    personId: row.personId,
    status: row.status,
    locked: row.locked,
    provenance: row.provenance,
    createdInVersion: row.createdInVersion,
    supersededInVersion: row.supersededInVersion ?? null,
  } as Assignment;
}

function toAbsence(row: Row): Absence {
  return {
    id: row.id,
    personId: row.personId,
    start: row.start,
    end: row.end,
    type: row.type,
    reasonCode: row.reasonCode,
    status: row.status,
  } as Absence;
}

function toRule(row: Row): Rule {
  return {
    id: row.id,
    type: row.type,
    params: row.params ?? {},
    level: row.level,
    tier: row.tier ?? null,
    scope: row.scope,
    source: row.source ?? null,
    text: row.text,
    confirmed: row.confirmed,
    replay: row.replay ?? null,
  } as Rule;
}

function toLock(row: Row): Lock {
  return {
    assignmentId: row.assignmentId,
    by: row.by,
    reason: row.reason,
    hard: row.hard,
  } as Lock;
}

export function toScheduleVersion(row: Row | null): ScheduleVersion | null {
  if (!row) return null;
  return {
    version: row.version,
    publishedAt: row.publishedAt,
    publishedBy: row.publishedBy,
    parent: row.parent ?? null,
    cause: row.cause ?? null,
    diff: row.diff ?? null,
    inputHash: row.inputHash ?? null,
    seed: row.seed ?? null,
  } as ScheduleVersion;
}

/** Current published head: status=published, not superseded. */
export async function getPublishedAssignments(): Promise<Assignment[]> {
  const rows = await prisma.assignment.findMany({
    where: { status: "published", supersededInVersion: null },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => toAssignment(r as unknown as Row));
}

export async function getCurrentVersion(): Promise<ScheduleVersion | null> {
  const row = await prisma.scheduleVersion.findFirst({ orderBy: { version: "desc" } });
  return toScheduleVersion(row as unknown as Row | null);
}

export async function getState(): Promise<StateResponse> {
  const [people, services, slots, rules, assignments, absences, locks, holidays, currentVersion] =
    await Promise.all([
      prisma.person.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] }),
      prisma.service.findMany({ orderBy: { id: "asc" } }),
      prisma.slot.findMany({ orderBy: { start: "asc" } }),
      prisma.rule.findMany({ orderBy: { id: "asc" } }),
      getPublishedAssignments(),
      prisma.absence.findMany({ orderBy: { start: "asc" } }),
      prisma.lock.findMany(),
      prisma.holiday.findMany({ orderBy: { date: "asc" } }),
      getCurrentVersion(),
    ]);

  return {
    people: people.map((r) => toPerson(r as unknown as Row)),
    services: services.map((r) => toService(r as unknown as Row)),
    slots: slots.map((r) => toSlot(r as unknown as Row)),
    rules: rules.map((r) => toRule(r as unknown as Row)),
    assignments,
    absences: absences.map((r) => toAbsence(r as unknown as Row)),
    locks: locks.map((r) => toLock(r as unknown as Row)),
    holidays: (holidays as unknown as Row[]).map((h) => ({ date: h.date as string, name: h.name as string })),
    currentVersion,
  };
}
