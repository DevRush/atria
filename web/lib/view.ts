/**
 * View-model derivation: turn the flat StateResponse into the shapes the UI
 * renders — the block grid, the call calendar, and the fairness ledger.
 * One schedule graph, many views (SPEC §2).
 */
import type {
  Assignment,
  Person,
  Service,
  ServiceFamily,
  Slot,
  StateResponse,
} from "@/lib/types";

export type Block = { index: number; start: string; end: string; label: string };

export function deriveBlocks(slots: Slot[]): Block[] {
  const seen = new Map<string, Block>();
  for (const s of slots) {
    if (s.grain !== "block") continue;
    const key = `${s.start}|${s.end}`;
    if (!seen.has(key)) {
      const start = s.start.slice(0, 10);
      seen.set(key, { index: 0, start, end: s.end.slice(0, 10), label: monthAbbr(start) });
    }
  }
  const blocks = [...seen.values()].sort((a, b) => a.start.localeCompare(b.start));
  blocks.forEach((b, i) => (b.index = i + 1));
  return blocks;
}

function monthAbbr(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleString("en-US", { month: "short" }) + " " + d.getDate();
}

export const FAMILY_OF: Record<string, ServiceFamily> = {};

export function serviceIndex(services: Service[]): Map<string, Service> {
  const m = new Map<string, Service>();
  for (const s of services) m.set(s.id, s);
  return m;
}

export type GridCell = {
  personId: string;
  block: Block;
  serviceId: string | null;
  family: ServiceFamily | null;
  code: string | null;
  slotId: string | null;
  locked: boolean;
};

export function buildGrid(state: StateResponse, overrideAssignments?: Assignment[]) {
  const blocks = deriveBlocks(state.slots);
  const svc = serviceIndex(state.services);
  const slotById = new Map(state.slots.map((s) => [s.id, s]));
  const assignments = overrideAssignments ?? state.assignments;
  const lockedSlotIds = new Set(
    state.locks
      .map((l) => assignments.find((a) => a.id === l.assignmentId)?.slotId)
      .filter(Boolean) as string[]
  );
  // also treat assignment.locked flag
  for (const a of assignments) if (a.locked) lockedSlotIds.add(a.slotId);

  // (personId, blockStart) -> assignment on a block slot
  const cellOf = new Map<string, GridCell>();
  for (const a of assignments) {
    const s = slotById.get(a.slotId);
    if (!s || s.grain !== "block") continue;
    const service = svc.get(s.serviceId);
    const block = blocks.find((b) => b.start === s.start.slice(0, 10));
    if (!block || !service) continue;
    cellOf.set(`${a.personId}|${block.start}`, {
      personId: a.personId,
      block,
      serviceId: service.id,
      family: service.family,
      code: service.code,
      slotId: s.id,
      locked: lockedSlotIds.has(s.id),
    });
  }

  const rows = state.people.map((p) => ({
    person: p,
    cells: blocks.map(
      (b) =>
        cellOf.get(`${p.id}|${b.start}`) ?? {
          personId: p.id,
          block: b,
          serviceId: null,
          family: null,
          code: null,
          slotId: null,
          locked: false,
        }
    ),
  }));

  return { blocks, rows };
}

/** Fairness ledger: weighted call + weekend + holiday counts per person. */
export function buildFairness(state: StateResponse, overrideAssignments?: Assignment[]) {
  const slotById = new Map(state.slots.map((s) => [s.id, s]));
  const assignments = overrideAssignments ?? state.assignments;
  const counts = new Map<string, { call: number; weekend: number; holiday: number; jeop: number }>();
  for (const p of state.people) counts.set(p.id, { call: 0, weekend: 0, holiday: 0, jeop: 0 });
  const holidays = new Set<string>(); // could be passed; weekend proxy below
  for (const a of assignments) {
    const s = slotById.get(a.slotId);
    if (!s) continue;
    const c = counts.get(a.personId);
    if (!c) continue;
    if (s.grain === "call-night") {
      c.call += 1;
      const d = new Date(s.start);
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) c.weekend += 1;
    } else if (s.grain === "week") {
      c.jeop += 1;
    }
  }
  const rows = state.people.map((p) => ({ person: p, ...counts.get(p.id)! }));
  const callVals = rows.map((r) => r.call);
  const maxVal = Math.max(...callVals);
  const minVal = Math.min(...callVals);
  return { rows, callSpread: maxVal - minVal, max: Math.max(maxVal, 1) };
}

/** Who is on call / jeopardy for a given date (the who's-on-call read path). */
export function onCallFor(state: StateResponse, isoDate: string, assignments?: Assignment[]) {
  const slotById = new Map(state.slots.map((s) => [s.id, s]));
  const personById = new Map(state.people.map((p) => [p.id, p]));
  const as = assignments ?? state.assignments;
  const result: { service: string; person: Person | undefined; kind: string }[] = [];
  for (const a of as) {
    const s = slotById.get(a.slotId);
    if (!s) continue;
    const startDay = s.start.slice(0, 10);
    const endDay = s.end.slice(0, 10);
    if (s.grain === "call-night" && startDay === isoDate) {
      result.push({ service: "On-Call (in-house)", person: personById.get(a.personId), kind: "call" });
    } else if (s.grain === "week" && startDay <= isoDate && isoDate < endDay) {
      result.push({ service: "Jeopardy / Backup", person: personById.get(a.personId), kind: "jeop" });
    }
  }
  return result;
}

export const FAMILY_CLASS: Record<ServiceFamily, string> = {
  procedural: "text-family-procedural bg-family-procedural-bg border-family-procedural-border",
  imaging: "text-family-imaging bg-family-imaging-bg border-family-imaging-border",
  inpatient: "text-family-inpatient bg-family-inpatient-bg border-family-inpatient-border",
  consult: "text-family-consult bg-family-consult-bg border-family-consult-border",
  ambulatory: "text-family-ambulatory bg-family-ambulatory-bg border-family-ambulatory-border",
  backup: "text-family-backup bg-family-backup-bg border-family-backup-border",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
