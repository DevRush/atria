/**
 * Export the current DB program (incl. the published v1 schedule) to
 * web/data/program.json — the bundled seed the app boots from. Run after
 * regenerating the schedule (part of `npm run data:regen`).
 */
import fs from "node:fs";
import path from "node:path";
import { getState } from "../lib/state";

async function main() {
  const s = await getState();
  const fx = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../fixtures/fellowship.json"), "utf8"));
  const program = {
    people: s.people, services: s.services, slots: s.slots, rules: s.rules,
    locks: s.locks, absences: s.absences, assignments: s.assignments,
    version: s.currentVersion, blocks: fx.blocks, holidays: fx.holidays,
  };
  const out = path.resolve(__dirname, "../data/program.json");
  fs.writeFileSync(out, JSON.stringify(program));
  console.log(`Wrote ${out}: ${s.people.length} people, ${s.slots.length} slots, ${s.assignments.length} published assignments`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
