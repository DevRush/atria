"use client";
import type { StateResponse } from "@/lib/types";
import { buildFairness } from "@/lib/view";

/** At-a-glance answer to the first question a coordinator (or buyer) asks: is this
 * schedule complete and fair? Coverage completeness is computed from the published
 * assignments; the call-equity spread is the same number the Fairness ledger shows. */
export function ScheduleStatus({ state }: { state: StateResponse }) {
  const isAttending = state.people.some((p) => p.level === "Attending");
  const slotById = new Map(state.slots.map((s) => [s.id, s]));
  const grainOf = (id: string) => slotById.get(id)?.grain;

  const nBlocks = new Set(state.slots.filter((s) => s.grain === "block").map((s) => s.start.slice(0, 10))).size;
  const callNights = state.slots.filter((s) => s.grain === "call-night").length;
  const weeks = state.slots.filter((s) => s.grain === "week").length;

  const blockAssigned = state.assignments.filter((a) => grainOf(a.slotId) === "block").length;
  const callAssigned = state.assignments.filter((a) => grainOf(a.slotId) === "call-night").length;
  const weekAssigned = state.assignments.filter((a) => grainOf(a.slotId) === "week").length;

  // every person holds exactly one rotation per block; every call night + jeopardy week is staffed
  const gaps =
    Math.max(0, state.people.length * nBlocks - blockAssigned) +
    (callNights - callAssigned) +
    (weeks - weekAssigned);
  const complete = gaps === 0;

  const { callSpread, homogeneous } = buildFairness(state);

  const stats: { value: number; label: string }[] = [
    { value: state.people.length, label: isAttending ? "attendings" : "fellows" },
    { value: nBlocks, label: "blocks" },
    { value: callAssigned, label: "call nights" },
    ...(weeks > 0 ? [{ value: weekAssigned, label: "jeopardy wks" }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-r2 border border-border bg-surface px-4 py-2.5">
      <span
        className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${
          complete ? "text-status-ok" : "text-status-block"
        }`}
      >
        <span
          className={`grid h-[18px] w-[18px] place-items-center rounded-full ${
            complete ? "bg-status-ok-bg" : "bg-status-block-bg"
          }`}
        >
          {complete ? (
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.5 10.6 3.9 8a.8.8 0 0 0-1.1 1.1l3.1 3.1a.8.8 0 0 0 1.1 0l6.2-6.2A.8.8 0 0 0 12.1 5L6.5 10.6Z" />
            </svg>
          ) : (
            <span className="text-[11px] font-bold">!</span>
          )}
        </span>
        {complete ? "All coverage filled" : `${gaps} coverage gap${gaps > 1 ? "s" : ""}`}
      </span>

      <span className="h-4 w-px bg-border" />

      {stats.map((s) => (
        <span key={s.label} className="text-[12.5px] text-muted-foreground">
          <span className="font-semibold text-foreground tnum">{s.value}</span> {s.label}
        </span>
      ))}

      {homogeneous && (
        <span
          className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-muted-foreground"
          title="Difference between the busiest and lightest call load — smaller is fairer"
        >
          call spread
          <span className="rounded-r1 bg-surface-raised px-1.5 py-0.5 font-semibold text-status-ok tnum">±{callSpread}</span>
        </span>
      )}
    </div>
  );
}
