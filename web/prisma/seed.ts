/**
 * Seed from the bundled, fully-solved program (web/data/program.json) — the
 * complete cardiology sample including its published v1 schedule. Because the
 * schedule is pre-solved, the app boots complete WITHOUT the solver at startup.
 * Runs on container start and on `npm run demo:reset`. Regenerate the bundle
 * after a solver/fixture change with `npm run data:regen`.
 */
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { loadProgram, seedProgram } from "../lib/seed-program";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }),
});

async function main() {
  const p = loadProgram();
  await seedProgram(prisma, p);
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
