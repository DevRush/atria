"use client";
import type { Assignment, StateResponse } from "@/lib/types";
import { buildGrid, FAMILY_CLASS, initials } from "@/lib/view";

const LEVEL_LABEL: Record<string, string> = { F1: "PGY-4", F2: "PGY-5", F3: "PGY-6" };

/** Fellows × 13 blocks. Text short-code is identity; hue is family reinforcement.
 * Changed cells (during a repair preview) are highlighted; locks show a left bar. */
export function ScheduleGrid({
  state,
  assignments,
  changedSlotIds,
}: {
  state: StateResponse;
  assignments?: Assignment[];
  changedSlotIds?: Set<string>;
}) {
  const { blocks, rows } = buildGrid(state, assignments);
  return (
    <div className="overflow-x-auto rounded-r2 border border-border bg-surface">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border-strong bg-surface-raised">
            <th className="sticky left-0 z-10 min-w-[168px] bg-surface-raised px-3 py-1.5 text-left font-medium text-muted-foreground">
              Fellow
            </th>
            {blocks.map((b) => (
              <th
                key={b.start}
                className="border-l border-border px-1 py-1.5 text-center font-medium text-faint-foreground tnum"
                title={`Block ${b.index}: ${b.start} → ${b.end}`}
              >
                <div className="text-[10px] leading-tight">B{b.index}</div>
                <div className="text-[10px] font-normal leading-tight text-faint-foreground">{b.label}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ person, cells }) => (
            <tr key={person.id} className="row-dense border-b border-border last:border-0 hover:bg-surface-raised/50">
              <td className="sticky left-0 z-10 bg-surface px-3 py-0.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-raised text-[9px] font-semibold text-muted-foreground">
                    {initials(person.name)}
                  </span>
                  <span className="truncate font-medium">{person.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-faint-foreground tnum">
                    {LEVEL_LABEL[person.level] ?? person.level}
                  </span>
                </div>
              </td>
              {cells.map((c) => {
                const changed = c.slotId && changedSlotIds?.has(c.slotId);
                return (
                  <td key={c.block.start} className="border-l border-border px-1 py-0.5 text-center">
                    {c.code && c.family ? (
                      <span
                        title={`${c.serviceId}${c.locked ? " · locked" : ""}`}
                        className={`inline-flex h-[19px] min-w-[42px] items-center justify-center rounded-r1 border px-1 font-mono text-[10.5px] font-medium tracking-wide ${FAMILY_CLASS[c.family]} ${
                          c.locked ? "border-l-[3px]" : ""
                        } ${changed ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
                      >
                        {c.code}
                      </span>
                    ) : (
                      <span className="text-faint-foreground">·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GridLegend() {
  const items: { label: string; family: keyof typeof FAMILY_CLASS }[] = [
    { label: "Procedural (CATH/EP)", family: "procedural" },
    { label: "Imaging (ECHO/NUC)", family: "imaging" },
    { label: "Inpatient (CCU/Call)", family: "inpatient" },
    { label: "Consult", family: "consult" },
    { label: "Ambulatory (Research/Clinic)", family: "ambulatory" },
    { label: "Backup (Jeopardy)", family: "backup" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
      {items.map((i) => (
        <span key={i.family} className="inline-flex items-center gap-1.5">
          <span className={`h-3 w-3 rounded-[2px] border ${FAMILY_CLASS[i.family]}`} />
          {i.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[2px] border border-l-[3px] border-border-strong" />
        Locked
      </span>
    </div>
  );
}
