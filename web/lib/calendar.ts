/**
 * Month-calendar view model for on-call. Turns call-night assignments into a real
 * wall-calendar grid — weeks × 7 days, weekends and holidays flagged, each day
 * showing who's on call, their coverage domain, and the shift hours.
 */
import type { StateResponse } from "@/lib/types";

export type CallEntry = { personId: string; person: string; code: string; family: string };
export type DayCell = {
  iso: string; // YYYY-MM-DD ("" for padding days)
  day: number;
  inMonth: boolean;
  weekend: boolean;
  holiday: string | null;
  entries: CallEntry[];
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const monthName = (m: number) => MONTHS[m];

/** Months (0-indexed within a year) that actually have call published. */
export function callMonths(state: StateResponse): { year: number; month: number }[] {
  const seen = new Set<string>();
  const out: { year: number; month: number }[] = [];
  for (const s of state.slots) {
    if (s.grain !== "call-night") continue;
    const d = s.start.slice(0, 10); // YYYY-MM-DD
    const key = d.slice(0, 7);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ year: Number(d.slice(0, 4)), month: Number(d.slice(5, 7)) - 1 });
  }
  return out.sort((a, b) => a.year - b.year || a.month - b.month);
}

/** Build the 6×7 calendar grid for one month, populated with call entries. */
export function buildMonthCalendar(state: StateResponse, year: number, month: number): DayCell[][] {
  const nameById = new Map(state.people.map((p) => [p.id, p.name]));
  const svcById = new Map(state.services.map((s) => [s.id, s]));
  const slotById = new Map(state.slots.map((s) => [s.id, s]));
  const holidays = new Map(state.holidays.map((h) => [h.date, h.name]));

  // date (YYYY-MM-DD) -> call entries
  const byDate = new Map<string, CallEntry[]>();
  for (const a of state.assignments) {
    const s = slotById.get(a.slotId);
    if (!s || s.grain !== "call-night") continue;
    const iso = s.start.slice(0, 10);
    if (iso.slice(0, 7) !== `${year}-${String(month + 1).padStart(2, "0")}`) continue;
    const svc = svcById.get(s.serviceId);
    const arr = byDate.get(iso) ?? [];
    arr.push({
      personId: a.personId,
      person: nameById.get(a.personId) ?? "—",
      code: svc?.code ?? s.serviceId,
      family: svc?.family ?? "inpatient",
    });
    byDate.set(iso, arr);
  }

  const first = new Date(Date.UTC(year, month, 1));
  const startPad = first.getUTCDay(); // 0 = Sunday
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: DayCell[] = [];
  for (let i = 0; i < startPad; i++) cells.push(pad());
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const wd = new Date(Date.UTC(year, month, d)).getUTCDay();
    cells.push({
      iso,
      day: d,
      inMonth: true,
      weekend: wd === 0 || wd === 6,
      holiday: holidays.get(iso) ?? null,
      entries: (byDate.get(iso) ?? []).sort((a, b) => a.code.localeCompare(b.code)),
    });
  }
  while (cells.length % 7 !== 0) cells.push(pad());

  const weeks: DayCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function pad(): DayCell {
  return { iso: "", day: 0, inMonth: false, weekend: false, holiday: null, entries: [] };
}

/** Stable, distinct-but-soft color per person (by roster order). */
const PALETTE = [
  { bg: "#dbeafe", fg: "#1e40af" }, { bg: "#dcfce7", fg: "#166534" },
  { bg: "#fef3c7", fg: "#92400e" }, { bg: "#fce7f3", fg: "#9d174d" },
  { bg: "#e0e7ff", fg: "#3730a3" }, { bg: "#ccfbf1", fg: "#115e59" },
  { bg: "#ffedd5", fg: "#9a3412" }, { bg: "#ede9fe", fg: "#5b21b6" },
  { bg: "#fee2e2", fg: "#991b1b" }, { bg: "#d1fae5", fg: "#065f46" },
  { bg: "#e0f2fe", fg: "#075985" }, { bg: "#fae8ff", fg: "#86198f" },
  { bg: "#f1f5f9", fg: "#334155" }, { bg: "#fef9c3", fg: "#854d0e" },
  { bg: "#cffafe", fg: "#155e75" }, { bg: "#ffe4e6", fg: "#9f1239" },
];
export function personColorMap(state: StateResponse): Map<string, { bg: string; fg: string }> {
  const m = new Map<string, { bg: string; fg: string }>();
  state.people.forEach((p, i) => m.set(p.id, PALETTE[i % PALETTE.length]));
  return m;
}
