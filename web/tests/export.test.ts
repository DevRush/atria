import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, toCsv, toIcs } from "../lib/export";
import type { StateResponse } from "../lib/types";

function fixture(): StateResponse {
  return {
    people: [
      { id: "p_a", name: "Ana Alvarez, MD", level: "F2", fte: 1, eligibleServices: ["CATH", "CALL"], clinicDay: "MON" },
    ],
    services: [
      { id: "CATH", name: "Cath Lab", code: "CATH", family: "procedural", kind: "rotation", coverage: { minPerWeekday: 1, minPerWeekendDay: 0 } },
      { id: "CALL", name: "Call", code: "CALL", family: "inpatient", kind: "call", coverage: { minPerWeekday: 1, minPerWeekendDay: 1 } },
    ],
    slots: [
      { id: "slot_b1_cath_1", serviceId: "CATH", start: "2026-07-01T07:00:00-04:00", end: "2026-07-28T17:00:00-04:00", grain: "block", roleIndex: 1 },
      { id: "slot_2026-09-12_call_1", serviceId: "CALL", start: "2026-09-12T17:00:00-04:00", end: "2026-09-13T07:00:00-04:00", grain: "call-night", roleIndex: 1 },
    ],
    rules: [],
    assignments: [
      { id: "a1", slotId: "slot_b1_cath_1", personId: "p_a", status: "published", locked: false, provenance: "solver", createdInVersion: 1, supersededInVersion: null },
      { id: "a2", slotId: "slot_2026-09-12_call_1", personId: "p_a", status: "published", locked: false, provenance: "solver", createdInVersion: 1, supersededInVersion: null },
    ],
    absences: [],
    locks: [],
    holidays: [],
    currentVersion: { version: 3, publishedAt: "2026-07-01T00:00:00Z", publishedBy: "coordinator", parent: null, cause: null, diff: null, inputHash: null, seed: 4711 },
  } as StateResponse;
}

test("csvCell neutralizes spreadsheet formula injection", () => {
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("-2"), "'-2");
  assert.equal(csvCell("@cmd"), "'@cmd");
  assert.equal(csvCell("Ana Alvarez"), "Ana Alvarez");
  // quoting for embedded commas/quotes still applies
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('he said "hi"'), '"he said ""hi"""');
});

test("toCsv emits a header + one row per assignment with the version", () => {
  const csv = toCsv(fixture());
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "Person,Level,Type,Service,Start,End,Version");
  assert.equal(lines.length, 3);
  assert.ok(lines.some((l) => l.includes("Call") && l.includes("CALL")));
  assert.ok(lines.every((l) => l.endsWith(",3") || l.endsWith("Version")));
});

test("toIcs produces a valid calendar with one VEVENT per assignment", () => {
  const ics = toIcs(fixture());
  assert.ok(ics.startsWith("BEGIN:VCALENDAR"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  // call night is a timed UTC event (17:00 EDT -> 21:00Z); block is all-day
  assert.ok(ics.includes("DTSTART:20260912T210000Z"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20260701"));
  assert.ok(ics.includes("SUMMARY:On-call: Ana Alvarez\\, MD"));
});

test("toIcs can filter to one person", () => {
  const ics = toIcs(fixture(), { personId: "p_none" });
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 0);
});
