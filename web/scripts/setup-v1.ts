/**
 * One-time setup: generate the initial fellowship schedule via the solver and
 * persist it as PUBLISHED version 1, so the grid opens on a living schedule.
 * Requires the solver running on :8000. Run: npx tsx scripts/setup-v1.ts
 */
import { getState } from "../lib/state";
import { prisma } from "../lib/db";
import { solverPost } from "../lib/solver";
import type { SolveResponse } from "../lib/types";

async function main() {
  const state = await getState();
  console.log(`Loaded ${state.people.length} people, ${state.slots.length} slots, ${state.rules.length} rules.`);

  // resolve locks -> the (slotId, person) they pin (against ALL rows, incl. draft seeds)
  const lockRows = await prisma.lock.findMany();
  const lockPins: { slotId: string; personId: string; reason: string; by: string }[] = [];
  for (const l of lockRows) {
    const a = await prisma.assignment.findUnique({ where: { id: l.assignmentId } });
    if (a) lockPins.push({ slotId: a.slotId, personId: a.personId, reason: l.reason, by: l.by });
  }
  console.log(`Locks to preserve: ${lockPins.map((p) => `${p.personId}@${p.slotId}`).join(", ") || "none"}`);
  // Pass a SELF-CONSISTENT lock payload: the assignments and the locks that
  // reference them share the same synthetic ids, so lock enforcement works on
  // every run regardless of what the DB lock rows currently point at.
  const lockAssignments = lockPins.map((p, i) => ({
    id: `a_lock_${i + 1}`, slotId: p.slotId, personId: p.personId,
    status: "draft", locked: true, provenance: "manual", createdInVersion: 1, supersededInVersion: null,
  }));
  const lockPayload = lockPins.map((p, i) => ({
    assignmentId: `a_lock_${i + 1}`, by: p.by, reason: p.reason, hard: true,
  }));

  const res = await solverPost<SolveResponse>("/solve", {
    people: state.people,
    services: state.services,
    slots: state.slots,
    rules: state.rules,
    locks: lockPayload,
    assignments: lockAssignments, // ids match lockPayload so locks always enforce
    absences: [],
    seed: 4711,
    timeBudgetSec: 60,
  });
  if (!res.feasible) {
    console.error("Generate infeasible:", res.conflicts);
    process.exit(1);
  }
  console.log(`Generated ${res.assignments.length} assignments in ${res.telemetry?.wallSec}s. Publishing as v1...`);

  // delete in FK-safe order: locks -> versions -> assignments
  await prisma.lock.deleteMany({});
  await prisma.scheduleVersion.deleteMany({});
  await prisma.assignment.deleteMany({});

  const lockedSlotIds = new Set(lockPins.map((p) => p.slotId));

  await prisma.assignment.createMany({
    data: res.assignments.map((a) => ({
      id: a.id,
      slotId: a.slotId,
      personId: a.personId,
      status: "published",
      locked: lockedSlotIds.has(a.slotId),
      provenance: a.provenance,
      createdInVersion: 1,
      supersededInVersion: null,
    })),
  });

  // re-point locks to the freshly generated assignment on each pinned slot
  for (const pin of lockPins) {
    const a = res.assignments.find((x) => x.slotId === pin.slotId);
    if (a) {
      await prisma.lock.create({
        data: { assignmentId: a.id, by: pin.by, reason: pin.reason, hard: true },
      });
    }
  }

  await prisma.scheduleVersion.create({
    data: {
      version: 1,
      publishedAt: new Date().toISOString(),
      publishedBy: "coordinator",
      parent: null,
      cause: JSON.stringify({ kind: "generate" }),
      diff: JSON.stringify({ changed: res.assignments.length, peopleTouched: state.people.length, violations: 0 }),
      inputHash: res.inputHash,
      seed: res.seed,
    },
  });

  console.log(`Published v1 with ${res.assignments.length} assignments (inputHash ${res.inputHash}).`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
