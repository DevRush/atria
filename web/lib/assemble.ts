/**
 * Turn an editable program (roster + per-rotation coverage counts) into a solver
 * request. This is what makes the "Build a schedule" flow real: the coordinator's
 * inputs become the exact demand the CP-SAT engine solves against.
 *
 * We rebuild only the block-rotation demand from the coverage counts; the flex
 * rotation (RESEARCH) absorbs whatever headcount is left so each person lands
 * exactly one rotation per block. Jeopardy/backup demand is carried from the base
 * program. On-call (365 nights) is generated separately — it's the slow part.
 */
import type { Person, Slot, SolveRequest, StateResponse } from "@/lib/types";

export const FLEX_SERVICE = "RESEARCH";

export type Coverage = { serviceId: string; code: string; name: string; count: number; flex: boolean };

/** Block periods (the fixed academic-year skeleton) from the base program. */
function blockPeriods(base: StateResponse) {
  return [
    ...new Map(
      base.slots
        .filter((s) => s.grain === "block")
        .map((s) => [`${s.start}|${s.end}`, { start: s.start, end: s.end }])
    ).values(),
  ].sort((a, b) => a.start.localeCompare(b.start));
}

/** Default per-rotation coverage = how many block slots each rotation has in a
 * period today. RESEARCH is the flex bucket (fills the remainder), not a fixed count. */
export function rotationCoverage(base: StateResponse): Coverage[] {
  const firstStart = base.slots.filter((s) => s.grain === "block").map((s) => s.start).sort()[0];
  const perService = new Map<string, number>();
  for (const s of base.slots)
    if (s.grain === "block" && s.start === firstStart)
      perService.set(s.serviceId, (perService.get(s.serviceId) ?? 0) + 1);
  return base.services
    .filter((s) => s.kind === "rotation")
    .map((s) => ({
      serviceId: s.id,
      code: s.code,
      name: s.name,
      count: perService.get(s.id) ?? 0,
      flex: s.id === FLEX_SERVICE,
    }));
}

/** Eligibility templates per level, learned from the base roster (so a fellow we
 * add gets the same rotations their PGY peers can staff — F1s don't get research). */
export function eligibilityByLevel(base: StateResponse): Record<string, string[]> {
  const out: Record<string, Set<string>> = {};
  for (const p of base.people) {
    (out[p.level] ??= new Set()).add("__");
    for (const svc of p.eligibleServices) out[p.level].add(svc);
  }
  const result: Record<string, string[]> = {};
  for (const [lvl, set] of Object.entries(out)) {
    set.delete("__");
    result[lvl] = [...set];
  }
  return result;
}

/** Assemble a rotation (block + jeopardy) solve request from edited inputs. */
export function assembleRotationRequest(
  base: StateResponse,
  people: Person[],
  counts: Record<string, number>
): { request: SolveRequest; slots: Slot[] } {
  const periods = blockPeriods(base);
  const rotationIds = base.services.filter((s) => s.kind === "rotation").map((s) => s.id);
  const requiredIds = rotationIds.filter((id) => id !== FLEX_SERVICE);
  const sumRequired = requiredIds.reduce((a, id) => a + Math.max(0, counts[id] ?? 0), 0);
  const flexCount = Math.max(0, people.length - sumRequired);

  const slots: Slot[] = [];
  periods.forEach((p, pi) => {
    for (const id of requiredIds) {
      for (let i = 1; i <= Math.max(0, counts[id] ?? 0); i++) slots.push(mk(pi, p, id, i));
    }
    for (let i = 1; i <= flexCount; i++) slots.push(mk(pi, p, FLEX_SERVICE, i));
  });
  // carry jeopardy/backup demand unchanged
  for (const s of base.slots) if (s.grain === "week") slots.push(s);

  const request: SolveRequest = {
    people,
    services: base.services,
    slots,
    rules: base.rules,
    locks: [],
    absences: [],
    seed: 4711,
    timeBudgetSec: 12,
  };
  return { request, slots };
}

function mk(pi: number, p: { start: string; end: string }, serviceId: string, i: number): Slot {
  return { id: `bslot_${pi}_${serviceId}_${i}`, serviceId, start: p.start, end: p.end, grain: "block", roleIndex: i };
}
