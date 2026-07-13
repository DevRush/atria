"use client";
import type { CSSProperties } from "react";
import type { Assignment, StateResponse } from "@/lib/types";
import { buildGrid, FAMILY_CLASS, GridCell, initials } from "@/lib/view";

const LEVEL_LABEL: Record<string, string> = { F1: "PGY-4", F2: "PGY-5", F3: "PGY-6" };

/** Fellows × 13 blocks. Text short-code is identity; hue is family reinforcement.
 * In editable mode, click a cell then a cell in the SAME block to swap the two
 * fellows' rotations; drag also works. Edited cells are ringed and auto-locked. */
export function ScheduleGrid({
  state,
  assignments,
  changedSlotIds,
  editable = false,
  selectedSlotId = null,
  editedSlotIds,
  animateIn = false,
  onCellActivate,
  onCellDrop,
}: {
  state: StateResponse;
  assignments?: Assignment[];
  changedSlotIds?: Set<string>;
  editable?: boolean;
  selectedSlotId?: string | null;
  editedSlotIds?: Set<string>;
  /** When true, cells cascade in (used right after a fresh Generate). */
  animateIn?: boolean;
  onCellActivate?: (cell: GridCell) => void;
  onCellDrop?: (sourceSlotId: string, targetSlotId: string) => void;
}) {
  const { blocks, rows } = buildGrid(state, assignments);
  const rosterLabel = state.people.some((p) => p.level === "Attending") ? "Physician" : "Fellow";
  const selectedBlock = selectedSlotId
    ? rows.flatMap((r) => r.cells).find((c) => c.slotId === selectedSlotId)?.block.start
    : null;

  return (
    <div className="overflow-x-auto rounded-r2 border border-border bg-surface">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-border-strong bg-surface-raised">
            <th className="sticky left-0 z-10 min-w-[168px] bg-surface-raised px-3 py-1.5 text-left font-medium text-muted-foreground">
              {rosterLabel}
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
          {rows.map(({ person, cells }, ri) => (
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
                const edited = c.slotId && editedSlotIds?.has(c.slotId);
                const selected = c.slotId && c.slotId === selectedSlotId;
                const isSwapTarget =
                  editable && selectedSlotId && selectedBlock === c.block.start && c.slotId !== selectedSlotId && c.slotId;
                return (
                  <td
                    key={c.block.start}
                    className={`border-l border-border px-1 py-0.5 text-center ${
                      isSwapTarget ? "bg-accent/[0.06]" : ""
                    }`}
                    onClick={editable && c.slotId ? () => onCellActivate?.(c) : undefined}
                    onDragOver={editable ? (e) => e.preventDefault() : undefined}
                    onDrop={
                      editable && c.slotId
                        ? (e) => {
                            e.preventDefault();
                            const src = e.dataTransfer.getData("text/slot");
                            if (src && src !== c.slotId) onCellDrop?.(src, c.slotId!);
                          }
                        : undefined
                    }
                  >
                    {c.code && c.family ? (
                      <span
                        draggable={editable && !!c.slotId}
                        onDragStart={
                          editable && c.slotId
                            ? (e) => e.dataTransfer.setData("text/slot", c.slotId!)
                            : undefined
                        }
                        title={`${c.serviceId}${c.locked ? " · locked" : ""}${editable ? " · click to swap" : ""}`}
                        style={animateIn ? ({ "--bp-delay": `${(c.block.index - 1) * 38 + ri * 9}ms` } as CSSProperties) : undefined}
                        className={`inline-flex h-[19px] min-w-[42px] items-center justify-center rounded-r1 border px-1 font-mono text-[10.5px] font-medium tracking-wide ${FAMILY_CLASS[c.family]} ${
                          animateIn ? "bp-cell-animate" : ""
                        } ${
                          c.locked ? "border-l-[3px]" : ""
                        } ${editable ? "cursor-pointer" : ""} ${
                          selected ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""
                        } ${changed || edited ? "ring-2 ring-accent ring-offset-1 ring-offset-surface" : ""}`}
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
