/**
 * Assignment inspector: for one block assignment, explain *why* this person holds
 * it and who else could — every reason derived from the same facts the solver
 * uses (eligibility/privileges, approved leave, continuity clinic, one-rotation-
 * per-block, locks), never a hand-waved score. Powers the "inspect the solver"
 * panel. Pure and synchronous — no solver round-trip.
 */
import type { Person, Service, StateResponse } from "@/lib/types";
import { buildFairness, deriveBlocks } from "@/lib/view";

export type InspectLoad = { call: number; weekend: number; holiday: number };

export type InspectCandidate = {
  person: Person;
  eligible: boolean;
  /** Ordered, human-readable reasons (why eligible, or why not). */
  reasons: string[];
  /** Their current rotation this block (so a swap is visible), or null. */
  currentRotation: string | null;
  load: InspectLoad;
};

export type Inspection = {
  slotId: string;
  service: Service;
  blockIndex: number;
  blockLabel: string;
  blockStart: string;
  blockEnd: string;
  holder: Person | null;
  holderReasons: string[];
  locked: boolean;
  /** Everyone except the holder, eligible first then by name. */
  candidates: InspectCandidate[];
  isAttending: boolean;
};

export function inspectSlot(state: StateResponse, slotId: string): Inspection | null {
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot || slot.grain !== "block") return null;
  const service = state.services.find((s) => s.id === slot.serviceId);
  if (!service) return null;

  const blockStart = slot.start.slice(0, 10);
  const blockEnd = slot.end.slice(0, 10);
  const block = deriveBlocks(state.slots).find((b) => b.start === blockStart);
  const isAttending = state.people.some((p) => p.level === "Attending");
  const word = isAttending ? "privileged for" : "eligible for"; // attendings are credentialed; trainees eligible

  const holderAssign = state.assignments.find((a) => a.slotId === slotId);
  const holder = holderAssign
    ? state.people.find((p) => p.id === holderAssign.personId) ?? null
    : null;
  const locked =
    !!holderAssign?.locked ||
    (holderAssign != null && state.locks.some((l) => l.assignmentId === holderAssign.id));

  // per-person call load (reuse the fairness ledger so numbers match the app)
  const fair = buildFairness(state);
  const loadOf = new Map<string, InspectLoad>(
    fair.rows.map((r) => [r.person.id, { call: r.call, weekend: r.weekend, holiday: r.holiday }])
  );

  // each person's current rotation THIS block (for swap visibility)
  const slotById = new Map(state.slots.map((s) => [s.id, s]));
  const svcById = new Map(state.services.map((s) => [s.id, s]));
  const rotationThisBlock = new Map<string, string>();
  for (const a of state.assignments) {
    const s = slotById.get(a.slotId);
    if (s && s.grain === "block" && s.start.slice(0, 10) === blockStart) {
      const sv = svcById.get(s.serviceId);
      if (sv) rotationThisBlock.set(a.personId, sv.code);
    }
  }

  const absentDuringBlock = (pid: string) =>
    state.absences.some(
      (ab) => ab.personId === pid && ab.status !== "denied" && ab.start <= blockEnd && ab.end >= blockStart
    );

  const holderReasons: string[] = [];
  if (holder) {
    holderReasons.push(`${word} ${service.code}`);
    if (holder.clinicDay) holderReasons.push(`continuity clinic ${holder.clinicDay}`);
    if (locked) holderReasons.push("locked by coordinator — protected across re-solves");
  }

  const candidates: InspectCandidate[] = [];
  for (const p of state.people) {
    if (holder && p.id === holder.id) continue;
    const reasons: string[] = [];
    let eligible = true;
    if (!p.eligibleServices.includes(service.id)) {
      eligible = false;
      reasons.push(`not ${word} ${service.code}`);
    }
    if (absentDuringBlock(p.id)) {
      eligible = false;
      reasons.push("on approved leave during this block");
    }
    const cur = rotationThisBlock.get(p.id) ?? null;
    if (eligible) reasons.push(cur ? `currently on ${cur} — would swap` : "unassigned this block");
    candidates.push({
      person: p,
      eligible,
      reasons,
      currentRotation: cur,
      load: loadOf.get(p.id) ?? { call: 0, weekend: 0, holiday: 0 },
    });
  }
  candidates.sort(
    (a, b) => Number(b.eligible) - Number(a.eligible) || a.person.name.localeCompare(b.person.name)
  );

  return {
    slotId,
    service,
    blockIndex: block?.index ?? 0,
    blockLabel: block?.label ?? blockStart,
    blockStart,
    blockEnd,
    holder,
    holderReasons,
    locked,
    candidates,
    isAttending,
  };
}
