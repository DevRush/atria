import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPublicProjection, verifyStoredProjection } from "../lib/projection";
import type { StateResponse } from "../lib/types";

function fixture(): StateResponse {
  return {
    people: [
      { id: "p_okafor", name: "Adaeze Okafor, MD", level: "F2", fte: 1, eligibleServices: ["CALL", "CATH"], clinicDay: "THU" },
      { id: "p_cohen", name: "Daniel Cohen", level: "F1", fte: 1, eligibleServices: ["CALL"], clinicDay: "MON" },
    ],
    services: [
      { id: "CALL", name: "Overnight Call", code: "CALL", family: "inpatient", kind: "call", coverage: { minPerWeekday: 1, minPerWeekendDay: 1 } },
      { id: "CATH", name: "Cath Lab", code: "CATH", family: "procedural", kind: "rotation", coverage: { minPerWeekday: 2, minPerWeekendDay: 0 } },
    ],
    slots: [
      { id: "slot_2026-09-12_call_1", serviceId: "CALL", start: "2026-09-12T17:00:00-04:00", end: "2026-09-13T07:00:00-04:00", grain: "call-night", roleIndex: 1 },
      { id: "slot_b1_cath_1", serviceId: "CATH", start: "2026-07-01T07:00:00-04:00", end: "2026-07-28T17:00:00-04:00", grain: "block", roleIndex: 1 },
    ],
    rules: [],
    assignments: [
      { id: "a1", slotId: "slot_2026-09-12_call_1", personId: "p_okafor", status: "published", locked: false, provenance: "solver", createdInVersion: 1, supersededInVersion: null },
      { id: "a2", slotId: "slot_b1_cath_1", personId: "p_cohen", status: "published", locked: false, provenance: "solver", createdInVersion: 1, supersededInVersion: null },
    ],
    absences: [],
    locks: [],
    currentVersion: { version: 1, publishedAt: "2026-07-01T00:00:00Z", publishedBy: "coordinator", parent: null, cause: null, diff: null, inputHash: null, seed: 4711 },
  } as StateResponse;
}

test("projection abbreviates names and strips credentials", () => {
  const p = buildPublicProjection(fixture());
  const names = [...p.call.map((c) => c.person), ...p.blocks.map((b) => b.person)];
  assert.ok(names.includes("A. Okafor"), "expected abbreviated trainee name");
  assert.ok(!names.some((n) => n.includes("Adaeze")), "full first name must not appear");
  assert.ok(!names.some((n) => n.includes("MD")), "credential must be stripped");
});

test("projection leaks NOTHING sensitive", () => {
  const json = JSON.stringify(buildPublicProjection(fixture()));
  for (const forbidden of ["p_okafor", "p_cohen", "eligibleServices", "clinicDay", "fte", "reasonCode", "F1", "F2"]) {
    assert.ok(!json.includes(forbidden), `public projection must not contain "${forbidden}"`);
  }
});

test("projection carries the version stamp and content hash", () => {
  const p = buildPublicProjection(fixture());
  assert.equal(p.version, 1);
  assert.match(p.contentHash, /^sha256:[0-9a-f]{32}$/);
});

test("verifyStoredProjection accepts a genuine projection, rejects tampering", () => {
  const proj = buildPublicProjection(fixture());
  assert.equal(verifyStoredProjection(proj), true);
  // altering a rendered name after publish is detected
  const tampered = structuredClone(proj);
  tampered.blocks[0].person = "Z. Hacker";
  assert.equal(verifyStoredProjection(tampered), false);
  // swapping in a different hash is detected
  assert.equal(
    verifyStoredProjection({ ...proj, contentHash: "sha256:deadbeefdeadbeefdeadbeefdeadbeef" }),
    false
  );
});
