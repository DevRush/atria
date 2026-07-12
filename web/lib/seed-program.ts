/**
 * Load the bundled sample program (data/program.json) into the database,
 * replacing whatever is there. Shared by the boot seed (prisma/seed.ts) and the
 * in-app "reset to sample" action (/api/reset) so a judge can always recover a
 * clean demo — even after importing their own spreadsheet.
 */
import fs from "node:fs";
import path from "node:path";
import type { StateResponse } from "@/lib/types";
import { storeProjection } from "@/lib/projection-store";

type Row = Record<string, unknown>;
export type Program = {
  people: Row[];
  services: Row[];
  slots: Row[];
  rules: Row[];
  locks: Row[];
  absences: Row[];
  assignments: Row[];
  holidays?: { date: string; name: string }[];
  version: Row | null;
};

export type Edition = "training" | "attending";

export function loadProgram(edition: Edition = "training"): Program {
  const name = edition === "attending" ? "attending-program.json" : "program.json";
  // works both at repo root (dev) and inside the container (cwd = /app)
  const candidates = [
    path.resolve(process.cwd(), "data", name),
    path.resolve(process.cwd(), "web/data", name),
    path.resolve(__dirname, "../data", name),
  ];
  const file = candidates.find((c) => fs.existsSync(c));
  if (!file) throw new Error(`data/${name} not found`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function seedProgram(prisma: any, p: Program): Promise<void> {
  // FK-safe wipe
  await prisma.lock.deleteMany();
  await prisma.scheduleVersion.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.service.deleteMany();
  await prisma.person.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.publicProjection.deleteMany();

  await prisma.person.createMany({
    data: p.people.map((x) => ({
      id: x.id, name: x.name, level: x.level, fte: x.fte,
      eligibleServices: x.eligibleServices, clinicDay: x.clinicDay ?? null,
    })),
  });
  await prisma.service.createMany({
    data: p.services.map((x) => ({
      id: x.id, name: x.name, code: x.code, family: x.family, kind: x.kind, coverage: x.coverage,
    })),
  });
  await prisma.slot.createMany({ data: p.slots });
  await prisma.rule.createMany({
    data: p.rules.map((x) => ({
      id: x.id, type: x.type, params: x.params, level: x.level, tier: x.tier ?? null,
      scope: x.scope, source: x.source ?? null, text: x.text, confirmed: x.confirmed,
      replay: x.replay ?? undefined,
    })),
  });
  await prisma.absence.createMany({
    data: p.absences.map((x) => ({
      id: x.id, personId: x.personId, start: x.start, end: x.end, type: x.type,
      reasonCode: x.reasonCode ?? "", status: x.status,
    })),
  });
  await prisma.assignment.createMany({ data: p.assignments });
  if (p.locks?.length) await prisma.lock.createMany({ data: p.locks });
  if (p.holidays?.length)
    await prisma.holiday.createMany({
      data: p.holidays.map((h) => ({ date: h.date, name: h.name })),
    });
  if (p.version) {
    const v = p.version;
    await prisma.scheduleVersion.create({
      data: {
        version: v.version, publishedAt: v.publishedAt, publishedBy: v.publishedBy,
        parent: v.parent ?? null, cause: v.cause ?? { kind: "generate" }, diff: v.diff ?? {},
        inputHash: v.inputHash ?? null, seed: v.seed ?? null,
      },
    });
    // freeze the public projection for the seeded version, same as a real publish
    const stateLike = {
      people: p.people, services: p.services, slots: p.slots, rules: [],
      assignments: p.assignments, absences: [], locks: [],
      holidays: (p.holidays ?? []) as { date: string; name: string }[],
      currentVersion: {
        version: v.version as number, publishedAt: v.publishedAt as string,
        publishedBy: v.publishedBy as string, parent: null, cause: null, diff: null,
        inputHash: null, seed: null,
      },
    } as unknown as StateResponse;
    await storeProjection(prisma, stateLike);
  }
  // mark the data source (append-only audit): this is the illustrative sample,
  // not a real imported roster. Cleared implicitly when an import logs later.
  await prisma.scheduleEvent.create({
    data: { actor: "system", eventType: "seed", detail: { source: "sample-bundle" }, createdAt: new Date().toISOString() },
  });
}
