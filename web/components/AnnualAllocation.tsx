"use client";
import type { CSSProperties } from "react";
import type { ServiceFamily, StateResponse } from "@/lib/types";
import { buildGrid, initials } from "@/lib/view";

const WEEKS_PER_BLOCK = 4;

const FAMILY_VAR: Record<ServiceFamily, string> = {
  procedural: "var(--family-procedural)",
  imaging: "var(--family-imaging)",
  inpatient: "var(--family-inpatient)",
  consult: "var(--family-consult)",
  ambulatory: "var(--family-ambulatory)",
  backup: "var(--family-backup)",
};

const LEGEND: { label: string; family: ServiceFamily }[] = [
  { label: "Procedural", family: "procedural" },
  { label: "Imaging", family: "imaging" },
  { label: "Inpatient", family: "inpatient" },
  { label: "Consult", family: "consult" },
  { label: "Ambulatory", family: "ambulatory" },
  { label: "Backup", family: "backup" },
];

/** The whole academic year on one screen — each person a row, ~52 week columns
 * colored by the rotation they're on. A "year at a glance" heatmap. */
export function AnnualAllocation({ state }: { state: StateResponse }) {
  const { blocks, rows } = buildGrid(state);
  const isAttending = state.people.some((p) => p.level === "Attending");
  const totalWeeks = blocks.length * WEEKS_PER_BLOCK;
  const ticks = Array.from({ length: Math.floor(totalWeeks / 5) + 1 }, (_, i) => i * 5).filter((t) => t > 0 && t <= totalWeeks);

  return (
    <section className="rounded-r2 border border-border bg-surface p-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            {totalWeeks}-week annual {isAttending ? "service" : "rotation"} allocation
          </h2>
          <p className="text-[11px] text-faint-foreground">
            Every {isAttending ? "attending" : "fellow"}&apos;s year, colored by assignment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {LEGEND.map((l) => (
            <span key={l.family} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: FAMILY_VAR[l.family] }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      {/* week ruler */}
      <div className="mb-1 flex items-center">
        <span className="w-[150px] shrink-0" />
        <div className="relative h-3 flex-1">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute top-0 text-[9px] text-faint-foreground tnum"
              style={{ left: `${(t / totalWeeks) * 100}%`, transform: "translateX(-50%)" }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-[3px]">
        {rows.map((row) => (
          <div key={row.person.id} className="flex items-center">
            <span className="flex w-[150px] shrink-0 items-center gap-1.5 pr-2">
              <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-surface-raised text-[8px] font-semibold text-muted-foreground">
                {initials(row.person.name)}
              </span>
              <span className="truncate text-[11px] font-medium">{row.person.name}</span>
            </span>
            <div className="flex flex-1 overflow-hidden rounded-[3px]">
              {row.cells.flatMap((cell, bi) =>
                Array.from({ length: WEEKS_PER_BLOCK }, (_, wi) => (
                  <span
                    key={`${bi}-${wi}`}
                    className="h-3.5 flex-1 border-r border-surface last:border-r-0"
                    style={{ background: cell.family ? FAMILY_VAR[cell.family] : "var(--surface-raised)" } as CSSProperties}
                    title={cell.code ? `${row.person.name} · ${cell.code} · block ${bi + 1}` : undefined}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
