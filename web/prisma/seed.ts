/**
 * Seed from the bundled, fully-solved program (web/data/program.json) — the
 * complete cardiology sample including its published v1 schedule. Because the
 * schedule is pre-solved, the app boots complete WITHOUT needing the solver at
 * startup (the solver is only used for repair/generate/import at runtime). This
 * is what runs on container start and on `npm run demo:reset`.
 *
 * To regenerate program.json after a solver/fixture change: `npm run data:regen`.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

type Row = Record<string, unknown>;
type Program = {
  people: Row[];
  services: Row[];
  slots: Row[];
  rules: Row[];
  locks: Row[];
  absences: Row[];
  assignments: Row[];
  version: Row | null;
};

async function main() {
  const file = path.resolve(__dirname, "../data/program.json");
  const p: Program = JSON.parse(fs.readFileSync(file, "utf8"));

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
      eligibleServices: x.eligibleServices as object, clinicDay: (x.clinicDay ?? null) as string | null,
    })) as never,
  });
  await prisma.service.createMany({
    data: p.services.map((x) => ({
      id: x.id, name: x.name, code: x.code, family: x.family, kind: x.kind, coverage: x.coverage as object,
    })) as never,
  });
  await prisma.slot.createMany({ data: p.slots as never });
  await prisma.rule.createMany({
    data: p.rules.map((x) => ({
      id: x.id, type: x.type, params: x.params as object, level: x.level,
      tier: (x.tier ?? null) as string | null, scope: x.scope, source: (x.source ?? null) as string | null,
      text: x.text, confirmed: x.confirmed, replay: (x.replay ?? undefined) as object | undefined,
    })) as never,
  });
  await prisma.absence.createMany({
    data: p.absences.map((x) => ({
      id: x.id, personId: x.personId, start: x.start, end: x.end, type: x.type,
      reasonCode: (x.reasonCode ?? "") as string, status: x.status,
    })) as never,
  });
  await prisma.assignment.createMany({ data: p.assignments as never });
  if (p.locks?.length) await prisma.lock.createMany({ data: p.locks as never });
  if (p.version) {
    const v = p.version;
    await prisma.scheduleVersion.create({
      data: {
        version: v.version as number, publishedAt: v.publishedAt as string,
        publishedBy: v.publishedBy as string, parent: (v.parent ?? null) as number | null,
        cause: (v.cause ?? { kind: "generate" }) as object, diff: (v.diff ?? {}) as object,
        inputHash: (v.inputHash ?? null) as string | null, seed: (v.seed ?? null) as number | null,
      },
    });
  }
  console.log(
    `Seeded bundled program: ${p.people.length} people, ${p.slots.length} slots, ` +
      `${p.assignments.length} published assignments, v${p.version?.version ?? "?"}`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
