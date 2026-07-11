/**
 * Atria seed — loads fixtures/fellowship.json (repo root) into SQLite.
 *
 * The fixture is read LAZILY at run time: the fixtures agent builds it in
 * parallel with this scaffold. If the file is absent, a deterministic
 * 2-person stub is seeded instead so every page and API route renders real
 * data end-to-end. Re-running the fixture seed later simply replaces the stub
 * (the seed is idempotent: wipe, then insert).
 *
 * Run: npx prisma db seed   (or: npx tsx prisma/seed.ts)
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import type {
  Absence,
  Assignment,
  Lock,
  Person,
  Rule,
  ScheduleVersion,
  Service,
  Slot,
} from "../lib/types";

const FIXTURE_PATH = path.resolve(__dirname, "../../fixtures/fellowship.json");

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  }),
});

interface FixtureShape {
  people?: Person[];
  services?: Service[];
  slots?: Slot[];
  rules?: Rule[];
  locks?: Lock[];
  absences?: Absence[];
  /** Optional: a pre-solved published schedule (v1). */
  assignments?: Assignment[];
  version?: Partial<ScheduleVersion>;
}

/** ISO-8601 with the machine's local offset (contract: datetimes carry offsets). */
function localIso(d: Date): string {
  const pad = (n: number, w = 2) => String(Math.abs(n)).padStart(w, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:00` +
    `${sign}${pad(Math.trunc(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
  );
}

function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Deterministic 2-person stub (synthetic names — never real people).
 * Includes a block schedule, tonight's call + jeopardy, one pending absence,
 * and a published v1 so /api/state, /schedule and /oncall all show real data.
 */
function buildStub(): Required<Omit<FixtureShape, "version">> & {
  version: Partial<ScheduleVersion>;
} {
  const people: Person[] = [
    {
      id: "p_okafor",
      name: "Adaeze Okafor",
      level: "F2",
      fte: 1.0,
      eligibleServices: ["CATH", "ECHO", "CCU", "CONSULT", "CLINIC", "CALL", "JEOP"],
      clinicDay: "THU",
    },
    {
      id: "p_lindqvist",
      name: "Nils Lindqvist",
      level: "F1",
      fte: 1.0,
      eligibleServices: ["ECHO", "CCU", "CONSULT", "CLINIC", "CALL", "JEOP"],
      clinicDay: "TUE",
    },
  ];

  const services: Service[] = [
    { id: "CATH", name: "Cath Lab", code: "CATH", family: "procedural", kind: "rotation", coverage: { minPerWeekday: 1, minPerWeekendDay: 0 } },
    { id: "ECHO", name: "Echocardiography", code: "ECHO", family: "imaging", kind: "rotation", coverage: { minPerWeekday: 1, minPerWeekendDay: 0 } },
    { id: "CCU", name: "Coronary Care Unit", code: "CCU", family: "inpatient", kind: "rotation", coverage: { minPerWeekday: 1, minPerWeekendDay: 1 } },
    { id: "CONSULT", name: "Consult Service", code: "CONS", family: "consult", kind: "rotation", coverage: { minPerWeekday: 0, minPerWeekendDay: 0 } },
    { id: "CLINIC", name: "Continuity Clinic", code: "CLIN", family: "ambulatory", kind: "clinic", coverage: { minPerWeekday: 0, minPerWeekendDay: 0 } },
    { id: "CALL", name: "Overnight Call", code: "CALL", family: "inpatient", kind: "call", coverage: { minPerWeekday: 1, minPerWeekendDay: 1 } },
    { id: "JEOP", name: "Jeopardy Backup", code: "JEOP", family: "backup", kind: "jeopardy", coverage: { minPerWeekday: 1, minPerWeekendDay: 1 } },
  ];

  // Two four-week blocks bracketing today, plus tonight's call + jeopardy.
  const now = new Date();
  const blockStart = new Date(now);
  blockStart.setDate(blockStart.getDate() - 14);
  blockStart.setHours(7, 0, 0, 0);
  const blockMid = new Date(blockStart);
  blockMid.setDate(blockMid.getDate() + 28);
  const blockEnd = new Date(blockMid);
  blockEnd.setDate(blockEnd.getDate() + 28);

  const callStart = new Date(now);
  callStart.setHours(17, 0, 0, 0);
  const callEnd = new Date(callStart);
  callEnd.setDate(callEnd.getDate() + 1);
  callEnd.setHours(7, 0, 0, 0);

  const b1 = ymd(blockStart);
  const b2 = ymd(blockMid);
  const slots: Slot[] = [
    { id: `slot_${b1}_cath_1`, serviceId: "CATH", start: localIso(blockStart), end: localIso(new Date(blockMid.getTime() - 14 * 3600_000)), grain: "block", roleIndex: 1 },
    { id: `slot_${b1}_ccu_1`, serviceId: "CCU", start: localIso(blockStart), end: localIso(new Date(blockMid.getTime() - 14 * 3600_000)), grain: "block", roleIndex: 1 },
    { id: `slot_${b2}_echo_1`, serviceId: "ECHO", start: localIso(blockMid), end: localIso(new Date(blockEnd.getTime() - 14 * 3600_000)), grain: "block", roleIndex: 1 },
    { id: `slot_${b2}_consult_1`, serviceId: "CONSULT", start: localIso(blockMid), end: localIso(new Date(blockEnd.getTime() - 14 * 3600_000)), grain: "block", roleIndex: 1 },
    { id: `slot_${ymd(callStart)}_call_1`, serviceId: "CALL", start: localIso(callStart), end: localIso(callEnd), grain: "call-night", roleIndex: 1 },
    { id: `slot_${ymd(callStart)}_jeop_1`, serviceId: "JEOP", start: localIso(callStart), end: localIso(callEnd), grain: "call-night", roleIndex: 1 },
  ];

  const assignments: Assignment[] = [
    { id: "a_1", slotId: slots[0].id, personId: "p_okafor", status: "published", locked: false, provenance: "import", createdInVersion: 1, supersededInVersion: null },
    { id: "a_2", slotId: slots[1].id, personId: "p_lindqvist", status: "published", locked: false, provenance: "import", createdInVersion: 1, supersededInVersion: null },
    { id: "a_3", slotId: slots[2].id, personId: "p_lindqvist", status: "published", locked: false, provenance: "import", createdInVersion: 1, supersededInVersion: null },
    { id: "a_4", slotId: slots[3].id, personId: "p_okafor", status: "published", locked: true, provenance: "manual", createdInVersion: 1, supersededInVersion: null },
    { id: "a_5", slotId: slots[4].id, personId: "p_okafor", status: "published", locked: false, provenance: "import", createdInVersion: 1, supersededInVersion: null },
    { id: "a_6", slotId: slots[5].id, personId: "p_lindqvist", status: "published", locked: false, provenance: "import", createdInVersion: 1, supersededInVersion: null },
  ];

  const rules: Rule[] = [
    {
      id: "r_1",
      type: "min_coverage",
      params: { serviceId: "CCU", min: 1, daily: true },
      level: "hard",
      tier: null,
      scope: "all",
      source: "stub",
      text: "CCU must always have one fellow on service.",
      confirmed: true,
      replay: { violationsLastYear: 0 },
    },
    {
      id: "r_2",
      type: "clinic_day_protected",
      params: {},
      level: "blocking",
      tier: null,
      scope: "all",
      source: "stub",
      text: "Continuity clinic half-days are protected from other assignments.",
      confirmed: true,
      replay: { violationsLastYear: 2 },
    },
  ];

  const locks: Lock[] = [
    { assignmentId: "a_4", by: "coordinator", reason: "PD directive", hard: true },
  ];

  const inTen = new Date(now);
  inTen.setDate(inTen.getDate() + 10);
  const inTwelve = new Date(now);
  inTwelve.setDate(inTwelve.getDate() + 12);
  const absences: Absence[] = [
    {
      id: "abs_1",
      personId: "p_okafor",
      start: ymd(inTen),
      end: ymd(inTwelve),
      type: "sick",
      reasonCode: "OPAQUE-01",
      status: "pending",
    },
  ];

  return {
    people,
    services,
    slots,
    rules,
    locks,
    absences,
    assignments,
    version: { publishedBy: "seed", cause: { kind: "initial" } },
  };
}

function loadFixture(): { data: FixtureShape; source: "fixture" | "stub" } {
  if (fs.existsSync(FIXTURE_PATH)) {
    const raw = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as FixtureShape;
    return { data: raw, source: "fixture" };
  }
  return { data: buildStub(), source: "stub" };
}

async function main() {
  const { data, source } = loadFixture();
  const people = data.people ?? [];
  const services = data.services ?? [];
  const slots = data.slots ?? [];
  const rules = data.rules ?? [];
  const locks = data.locks ?? [];
  const absences = data.absences ?? [];
  const assignments = data.assignments ?? [];

  // Idempotent: wipe in FK-safe order, then insert.
  await prisma.lock.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.scheduleVersion.deleteMany();
  await prisma.person.deleteMany();
  await prisma.service.deleteMany();

  for (const p of people) {
    await prisma.person.create({
      data: {
        id: p.id,
        name: p.name,
        level: p.level,
        fte: p.fte,
        eligibleServices: p.eligibleServices,
        clinicDay: p.clinicDay ?? null,
      },
    });
  }
  for (const s of services) {
    await prisma.service.create({
      data: {
        id: s.id,
        name: s.name,
        code: s.code,
        family: s.family,
        kind: s.kind,
        coverage: s.coverage as object,
      },
    });
  }
  for (const s of slots) {
    await prisma.slot.create({
      data: {
        id: s.id,
        serviceId: s.serviceId,
        start: s.start,
        end: s.end,
        grain: s.grain,
        roleIndex: s.roleIndex,
      },
    });
  }
  for (const r of rules) {
    await prisma.rule.create({
      data: {
        id: r.id,
        type: r.type,
        params: r.params as object,
        level: r.level,
        tier: r.tier ?? null,
        scope: r.scope,
        source: r.source ?? null,
        text: r.text,
        confirmed: r.confirmed,
        replay: (r.replay ?? undefined) as object | undefined,
      },
    });
  }
  for (const a of absences) {
    await prisma.absence.create({
      data: {
        id: a.id,
        personId: a.personId,
        start: a.start,
        end: a.end,
        type: a.type,
        reasonCode: a.reasonCode,
        status: a.status,
      },
    });
  }

  // Published v1 if the fixture (or stub) ships pre-solved assignments.
  if (assignments.length > 0) {
    for (const a of assignments) {
      await prisma.assignment.create({
        data: {
          id: a.id,
          slotId: a.slotId,
          personId: a.personId,
          status: a.status ?? "published",
          locked: a.locked ?? false,
          provenance: a.provenance ?? "import",
          createdInVersion: a.createdInVersion ?? 1,
          supersededInVersion: a.supersededInVersion ?? null,
        },
      });
    }
    for (const l of locks) {
      await prisma.lock.create({
        data: {
          assignmentId: l.assignmentId,
          by: l.by,
          reason: l.reason,
          hard: l.hard,
        },
      });
    }
    await prisma.scheduleVersion.create({
      data: {
        version: data.version?.version ?? 1,
        publishedAt: new Date().toISOString(),
        publishedBy: data.version?.publishedBy ?? "seed",
        parent: null,
        cause: (data.version?.cause as object) ?? { kind: "initial" },
        diff: { changed: assignments.length, peopleTouched: people.length, violations: 0 },
        inputHash: data.version?.inputHash ?? null,
        seed: data.version?.seed ?? null,
      },
    });
  }

  console.log(
    `Seeded from ${source}: ${people.length} people, ${services.length} services, ` +
      `${slots.length} slots, ${rules.length} rules, ${assignments.length} assignments, ` +
      `${absences.length} absences, ${locks.length} locks` +
      (source === "stub" ? " (fixtures/fellowship.json absent — stub used)" : "")
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
