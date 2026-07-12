"use client";
import { useEffect } from "react";
import type { StateResponse } from "@/lib/types";
import { inspectSlot } from "@/lib/inspect";
import { initials } from "@/lib/view";

/**
 * "Inspect the solver": why this person holds this rotation, and who else could —
 * every reason derived from eligibility, approved leave, clinic, and locks (the
 * same facts the engine uses). Opens as a right-hand sheet over the grid.
 */
export function AssignmentInspector({
  state,
  slotId,
  onClose,
}: {
  state: StateResponse;
  slotId: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ins = inspectSlot(state, slotId);
  if (!ins) return null;
  const eligible = ins.candidates.filter((c) => c.eligible);
  const ineligible = ins.candidates.filter((c) => !c.eligible);

  return (
    <div className="fixed inset-0 z-30 flex justify-end" role="dialog" aria-modal="true">
      <button
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
        aria-label="Close inspector"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-[380px] flex-col overflow-y-auto border-l border-border bg-surface shadow-xl">
        {/* header */}
        <div className="sticky top-0 z-10 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[10.5px] font-medium uppercase tracking-wide text-faint-foreground">
                Why this assignment
              </div>
              <h2 className="mt-0.5 text-[14px] font-semibold tracking-tight">
                {ins.service.code}
                <span className="ml-1.5 text-[12px] font-normal text-muted-foreground">
                  · Block {ins.blockIndex} ({ins.blockLabel})
                </span>
              </h2>
            </div>
            <button
              onClick={onClose}
              className="rounded-r1 border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Esc
            </button>
          </div>
        </div>

        <div className="space-y-4 px-4 py-3">
          {/* holder */}
          {ins.holder ? (
            <div className="rounded-r2 border border-accent/40 bg-accent/[0.04] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-raised text-[9px] font-semibold text-muted-foreground">
                  {initials(ins.holder.name)}
                </span>
                <span className="text-[13px] font-semibold">{ins.holder.name}</span>
                {ins.locked && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-r1 border border-border-strong px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <span className="text-[9px]">🔒</span> locked
                  </span>
                )}
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {ins.holderReasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                    <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-status-ok" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-r2 border border-status-warn-border bg-status-warn-bg/50 px-3 py-2 text-[12px] text-muted-foreground">
              This block is currently unfilled.
            </div>
          )}

          {/* eligible alternatives */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10.5px] font-medium uppercase tracking-wide text-faint-foreground">
                Could cover · {eligible.length}
              </span>
              <span className="text-[10px] text-faint-foreground">call · wknd · hol</span>
            </div>
            <ul className="space-y-1">
              {eligible.map((c) => (
                <li
                  key={c.person.id}
                  className="flex items-center gap-2 rounded-r1 border border-border px-2.5 py-1.5 text-[12px]"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-status-ok" />
                  <span className="min-w-0">
                    <span className="font-medium">{c.person.name}</span>
                    <span className="ml-1.5 text-[10.5px] text-muted-foreground">{c.reasons[0]}</span>
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-faint-foreground tnum">
                    {c.load.call}·{c.load.weekend}·{c.load.holiday}
                  </span>
                </li>
              ))}
              {eligible.length === 0 && (
                <li className="px-1 text-[11.5px] text-muted-foreground">
                  No one else is {ins.isAttending ? "privileged" : "eligible"} for {ins.service.code} and free this block.
                </li>
              )}
            </ul>
          </section>

          {/* ineligible, with reasons */}
          <section>
            <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wide text-faint-foreground">
              Ruled out · {ineligible.length}
            </div>
            <ul className="space-y-1">
              {ineligible.map((c) => (
                <li
                  key={c.person.id}
                  className="flex items-center gap-2 px-2.5 py-1 text-[11.5px] text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-faint-foreground/50" />
                  <span className="font-medium text-foreground/70">{c.person.name}</span>
                  <span className="ml-auto text-right text-[10.5px] text-faint-foreground">
                    {c.reasons.join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <p className="border-t border-border pt-2 text-[10.5px] text-faint-foreground">
            Reasons are computed from eligibility, approved leave, continuity clinic, and locks — the
            same facts the solver constrains on. Loads are this year&apos;s call · weekend · holiday counts.
          </p>
        </div>
      </aside>
    </div>
  );
}
