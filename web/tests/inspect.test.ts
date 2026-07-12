import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectSlot } from "../lib/inspect";
import type { StateResponse } from "../lib/types";

/** b1: CATH + CONS in the same 4-week block.
 *  p_a → CATH (holder), p_b → CONS (eligible for CATH, would swap),
 *  p_c not credentialed for CATH, p_d credentialed but on approved leave. */
function fixture(): StateResponse {
  return {
    people: [
      { id: "p_a", name: "Ana A", level: "F1", fte: 1, eligibleServices: ["CATH", "CONS"], clinicDay: "MON" },
      { id: "p_b", name: "Ben B", level: "F1", fte: 1, eligibleServices: ["CATH", "CONS"], clinicDay: "TUE" },
      { id: "p_c", name: "Cy C", level: "F2", fte: 1, eligibleServices: ["CONS"], clinicDay: "WED" },
      { id: "p_d", name: "Di D", level: "F2", fte: 1, eligibleServices: ["CATH", "CONS"], clinicDay: "THU" },
    ],
    services: [
      { id: "CATH", name: "Cath Lab", code: "CATH", family: "procedural", kind: "rotation", coverage: { minPerWeekday: 1, minPerWeekendDay: 0 } },
      { id: "CONS", name: "Consults", code: "CONS", family: "consult", kind: "rotation", coverage: { minPerWeekday: 1, minPerWeekendDay: 0 } },
    ],
    slots: [
      { id: "slot_b1_cath_1", serviceId: "CATH", start: "2026-07-01T07:00:00-04:00", end: "2026-07-28T17:00:00-04:00", grain: "block", roleIndex: 1 },
      { id: "slot_b1_cons_1", serviceId: "CONS", start: "2026-07-01T07:00:00-04:00", end: "2026-07-28T17:00:00-04:00", grain: "block", roleIndex: 1 },
    ],
    rules: [],
    assignments: [
      { id: "a1", slotId: "slot_b1_cath_1", personId: "p_a", status: "published", locked: false, provenance: "solver", createdInVersion: 1, supersededInVersion: null },
      { id: "a2", slotId: "slot_b1_cons_1", personId: "p_b", status: "published", locked: false, provenance: "solver", createdInVersion: 1, supersededInVersion: null },
    ],
    absences: [
      { id: "ab1", personId: "p_d", start: "2026-07-10", end: "2026-07-20", type: "leave", reasonCode: "X", status: "approved" },
    ],
    locks: [],
    holidays: [],
    currentVersion: { version: 1, publishedAt: "2026-07-01T00:00:00Z", publishedBy: "coordinator", parent: null, cause: null, diff: null, inputHash: null, seed: 4711 },
  } as StateResponse;
}

test("inspector identifies the holder and their rationale", () => {
  const ins = inspectSlot(fixture(), "slot_b1_cath_1");
  assert.ok(ins, "expected an inspection");
  assert.equal(ins!.holder?.id, "p_a");
  assert.ok(ins!.holderReasons.some((r) => r.includes("eligible for CATH")));
  assert.ok(!ins!.candidates.some((c) => c.person.id === "p_a"), "holder excluded from candidates");
});

test("credentialing rules out the un-credentialed with a concrete reason", () => {
  const ins = inspectSlot(fixture(), "slot_b1_cath_1")!;
  const c = ins.candidates.find((x) => x.person.id === "p_c")!;
  assert.equal(c.eligible, false);
  assert.ok(c.reasons.some((r) => r.includes("not eligible for CATH")));
});

test("approved leave rules a credentialed person out for that block", () => {
  const ins = inspectSlot(fixture(), "slot_b1_cath_1")!;
  const d = ins.candidates.find((x) => x.person.id === "p_d")!;
  assert.equal(d.eligible, false);
  assert.ok(d.reasons.some((r) => r.includes("leave")));
});

test("an eligible alternative shows the swap it would cause, and sorts first", () => {
  const ins = inspectSlot(fixture(), "slot_b1_cath_1")!;
  const b = ins.candidates.find((x) => x.person.id === "p_b")!;
  assert.equal(b.eligible, true);
  assert.equal(b.currentRotation, "CONS");
  assert.ok(b.reasons.some((r) => r.includes("would swap")));
  assert.equal(ins.candidates[0].eligible, true, "eligible candidates sort ahead of ruled-out ones");
});
