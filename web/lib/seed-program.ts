/**
 * Load the bundled sample program (data/program.json) into the database,
 * replacing whatever is there. Shared by the boot seed (prisma/seed.ts) and the
 * in-app "reset to sample" action (/api/reset) so a judge can always recover a
 * clean demo — even after importing their own spreadsheet.
 */
import fs from "node:fs";
import path from "node:path";

type Row = Record<string, unknown>;
export type Program = {
  people: Row[];
  services: Row[];
  slots: Row[];
  rules: Row[];
  locks: Row[];
  absences: Row[];
  assignments: Row[];
  version: Row | null;
};

export function loadProgram(): Program {
  // works both at repo root (dev) and inside the container (cwd = /app)
  const candidates = [
    path.resolve(process.cwd(), "data/program.json"),
    path.resolve(process.cwd(), "web/data/program.json"),
    path.resolve(__dirname, "../data/program.json"),
  ];
  const file = candidates.find((c) => fs.existsSync(c));
  if (!file) throw new Error("data/program.json not found");
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
  if (p.version) {
    const v = p.version;
    await prisma.scheduleVersion.create({
      data: {
        version: v.version, publishedAt: v.publishedAt, publishedBy: v.publishedBy,
        parent: v.parent ?? null, cause: v.cause ?? { kind: "generate" }, diff: v.diff ?? {},
        inputHash: v.inputHash ?? null, seed: v.seed ?? null,
      },
    });
  }
}
