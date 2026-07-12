/**
 * Coordinator exports: the published schedule as CSV (spreadsheet portability)
 * and ICS (calendar subscription). These are internal tools behind the app, so
 * they carry full names — unlike the abbreviated public projection.
 *
 * CSV cells are neutralized against spreadsheet formula injection (a cell that
 * opens with = + - @ or a control char is prefixed with a quote so Excel/Sheets
 * treat it as text, never execute it). Adapted from Codex's import template guard.
 */
import type { StateResponse } from "@/lib/types";

export function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // formula-injection guard
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const KIND: Record<string, string> = {
  block: "Rotation",
  "call-night": "Call",
  week: "Jeopardy",
  halfday: "Clinic",
  day: "Day",
};

export function toCsv(state: StateResponse): string {
  const svc = new Map(state.services.map((s) => [s.id, s]));
  const person = new Map(state.people.map((p) => [p.id, p]));
  const slot = new Map(state.slots.map((s) => [s.id, s]));
  const v = state.currentVersion?.version ?? "";

  const items = state.assignments
    .map((a) => ({ a, s: slot.get(a.slotId) }))
    .filter((x): x is { a: (typeof state.assignments)[number]; s: NonNullable<typeof x.s> } => !!x.s);
  items.sort(
    (x, y) =>
      x.s.start.localeCompare(y.s.start) ||
      (person.get(x.a.personId)?.name ?? "").localeCompare(person.get(y.a.personId)?.name ?? "")
  );

  const rows: (string | number)[][] = [
    ["Person", "Level", "Type", "Service", "Start", "End", "Version"],
  ];
  for (const { a, s } of items) {
    const p = person.get(a.personId);
    const sv = svc.get(s.serviceId);
    rows.push([
      p?.name ?? a.personId,
      p?.level ?? "",
      KIND[s.grain] ?? s.grain,
      sv?.code ?? s.serviceId,
      s.start,
      s.end,
      v,
    ]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

// ---- ICS (RFC 5545) ----

function icsDateTime(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function icsDate(isoDate: string): string {
  return isoDate.slice(0, 10).replace(/-/g, "");
}
function addDay(isoDate: string): string {
  const d = new Date(isoDate.slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function icsEscape(s: string): string {
  return s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
}

export function toIcs(state: StateResponse, opts?: { personId?: string }): string {
  const person = new Map(state.people.map((p) => [p.id, p]));
  const svc = new Map(state.services.map((s) => [s.id, s]));
  const slot = new Map(state.slots.map((s) => [s.id, s]));
  const v = state.currentVersion?.version ?? 1;
  const stamp = icsDateTime(state.currentVersion?.publishedAt ?? "1970-01-01T00:00:00Z");

  const out: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Atria//Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Atria — Schedule",
  ];
  const items = state.assignments.filter((a) => !opts?.personId || a.personId === opts.personId);
  for (const a of items) {
    const s = slot.get(a.slotId);
    if (!s) continue;
    const p = person.get(a.personId);
    const sv = svc.get(s.serviceId);
    const name = p?.name ?? a.personId;
    const code = sv?.code ?? s.serviceId;
    out.push("BEGIN:VEVENT", `UID:${a.slotId}.${a.personId}.v${v}@atria`, `DTSTAMP:${stamp}`);
    if (s.grain === "block" || s.grain === "week") {
      out.push(`DTSTART;VALUE=DATE:${icsDate(s.start)}`, `DTEND;VALUE=DATE:${icsDate(addDay(s.end))}`);
    } else {
      out.push(`DTSTART:${icsDateTime(s.start)}`, `DTEND:${icsDateTime(s.end)}`);
    }
    const summary =
      s.grain === "call-night" ? `On-call: ${name}` : s.grain === "week" ? `Jeopardy: ${name}` : `${code}: ${name}`;
    out.push(
      `SUMMARY:${icsEscape(summary)}`,
      `DESCRIPTION:${icsEscape(`${code} · ${p?.level ?? ""} · Atria v${v}`)}`,
      "END:VEVENT"
    );
  }
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}
