"use client";
import { useMemo, useState } from "react";
import type { StateResponse } from "@/lib/types";
import { buildMonthCalendar, callMonths, monthName, personColorMap } from "@/lib/calendar";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const lastName = (n: string) => n.replace(/,?\s*(MD|DO|MBBS)\.?$/i, "").trim().split(/\s+/).slice(-1)[0];

/** A real wall-calendar month view of the on-call schedule: weekends shaded,
 * holidays flagged, each physician a stable color, coverage domain + shift hours
 * on every day. The month-to-month view a coordinator actually reads. */
export function MonthCalendar({ state }: { state: StateResponse }) {
  const months = useMemo(() => callMonths(state), [state]);
  const colors = useMemo(() => personColorMap(state), [state]);
  const [idx, setIdx] = useState(() => {
    const sep = months.findIndex((m) => m.year === 2026 && m.month === 8);
    return sep >= 0 ? sep : 0;
  });
  const cur = months[idx];

  if (!cur) {
    return (
      <div className="rounded-r2 border border-border bg-surface px-4 py-8 text-center text-[13px] text-muted-foreground">
        No on-call schedule published yet — generate one on the Build tab.
      </div>
    );
  }

  const weeks = buildMonthCalendar(state, cur.year, cur.month);
  const onThisMonth = [
    ...new Map(weeks.flatMap((w) => w.flatMap((d) => d.entries)).map((e) => [e.personId, e])).values(),
  ].sort((a, b) => a.person.localeCompare(b.person));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx <= 0}
          className="rounded-r1 border border-border px-2 py-1 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h2 className="text-[15px] font-semibold tracking-tight tnum">
          {monthName(cur.month)} {cur.year}
        </h2>
        <button
          onClick={() => setIdx((i) => Math.min(months.length - 1, i + 1))}
          disabled={idx >= months.length - 1}
          className="rounded-r1 border border-border px-2 py-1 text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="overflow-hidden rounded-r2 border border-border bg-surface">
        <div className="grid grid-cols-7 border-b border-border bg-surface-raised">
          {WD.map((w, i) => (
            <div key={w} className={`px-2 py-1.5 text-[10.5px] font-medium uppercase tracking-wide ${i === 0 || i === 6 ? "text-accent" : "text-faint-foreground"}`}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((cell, i) => (
            <div
              key={i}
              className={`min-h-[92px] border-b border-r border-border p-1.5 last:border-r-0 ${
                !cell.inMonth ? "bg-surface-raised/30" : cell.weekend ? "bg-accent/[0.035]" : "bg-surface"
              } ${cell.holiday ? "bg-status-warn-bg/40" : ""}`}
            >
              {cell.inMonth && (
                <>
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-[11px] tnum ${cell.weekend ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {cell.day}
                    </span>
                    {cell.holiday && (
                      <span className="rounded bg-status-warn-bg px-1 py-px text-[8px] font-medium uppercase tracking-wide text-status-warn" title={cell.holiday}>
                        holiday
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {cell.entries.map((e, j) => {
                      const c = colors.get(e.personId);
                      return (
                        <div
                          key={j}
                          className="rounded px-1.5 py-0.5 leading-tight"
                          style={{ background: c?.bg, color: c?.fg }}
                          title={`${e.person} · ${e.code} · on-call 17:00 → 07:00`}
                        >
                          <div className="truncate text-[10.5px] font-semibold">{lastName(e.person)}</div>
                          <div className="text-[8.5px] opacity-80">{e.code} · 17–07</div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-0.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[2px] bg-accent/[0.15]" /> weekend</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[2px] bg-status-warn-bg" /> holiday</span>
        <span className="text-faint-foreground">·</span>
        {onThisMonth.map((e) => {
          const c = colors.get(e.personId);
          return (
            <span key={e.personId} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10.5px] font-medium" style={{ background: c?.bg, color: c?.fg }}>
              {lastName(e.person)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
