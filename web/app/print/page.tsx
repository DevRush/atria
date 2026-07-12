import { getState } from "@/lib/state";
import { buildGrid } from "@/lib/view";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/**
 * Emergency / offline coverage roster — a standalone, grayscale-safe,
 * version-stamped page. Print it, or save the page to keep an offline copy that
 * still works at 3am if everything else is down. Deliberately monochrome and
 * border-driven so it is legible on a fax/printout with no color (adapted from
 * Codex's emergency-export + grayscale-print guidance).
 */
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmt = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const monthOf = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });

export default async function PrintRosterPage() {
  const state = await getState();
  const generatedAt = new Date().toISOString();
  const isAttending = state.people.some((p) => p.level === "Attending");
  const personById = new Map(state.people.map((p) => [p.id, p]));
  const slotById = new Map(state.slots.map((s) => [s.id, s]));

  // call nights, grouped by month
  const calls: { date: string; weekday: string; person: string }[] = [];
  for (const a of state.assignments) {
    const s = slotById.get(a.slotId);
    if (s?.grain !== "call-night") continue;
    const d = s.start.slice(0, 10);
    calls.push({ date: d, weekday: WD[new Date(d + "T12:00:00Z").getUTCDay()], person: personById.get(a.personId)?.name ?? "—" });
  }
  calls.sort((a, b) => a.date.localeCompare(b.date));
  const byMonth = new Map<string, typeof calls>();
  for (const c of calls) (byMonth.get(monthOf(c.date)) ?? byMonth.set(monthOf(c.date), []).get(monthOf(c.date))!).push(c);

  const { blocks, rows } = buildGrid(state);
  const v = state.currentVersion?.version ?? "—";

  return (
    <div className="mx-auto max-w-[900px] bg-white px-6 py-6 text-black print:max-w-none print:px-0">
      <style>{`@media print { @page { margin: 12mm; } body { background: #fff; } .avoid-break { break-inside: avoid; } }`}</style>

      {/* header */}
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">
            {isAttending ? "Cardiology Division" : "Cardiology Fellowship"} — Coverage Roster
          </h1>
          <div className="mt-0.5 text-[11px] text-neutral-600 tnum">
            Published version {v} · America/New_York · Generated{" "}
            {new Date(generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        </div>
        <PrintButton />
      </div>

      <div className="mt-2 border border-black/40 bg-neutral-50 px-3 py-1.5 text-[11px] print:bg-white">
        <strong>Emergency / offline copy.</strong> A printed or saved copy may be out of date — verify
        against the live schedule before relying on it. Call runs 17:00 → 07:00 the following morning.
      </div>

      {/* call roster */}
      <section className="mt-5">
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide">In-house call</h2>
        <div className="space-y-3">
          {[...byMonth.entries()].map(([month, days]) => (
            <div key={month} className="avoid-break">
              <div className="mb-1 border-b border-black/30 text-[11px] font-semibold uppercase tracking-wide">{month}</div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 sm:grid-cols-3">
                {days.map((c) => (
                  <div key={c.date} className="flex items-baseline gap-2 text-[11.5px]">
                    <span className="w-14 shrink-0 text-neutral-600 tnum">{c.weekday} {fmt(c.date)}</span>
                    <span className="font-medium">{c.person}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {calls.length === 0 && <div className="text-[12px] text-neutral-600">No call published.</div>}
        </div>
      </section>

      {/* block grid */}
      <section className="mt-6 avoid-break">
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide">
          {isAttending ? "Service-week assignments" : "Block rotations"}
        </h2>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="border border-black/40 bg-neutral-100 px-1.5 py-1 text-left print:bg-white">
                {isAttending ? "Attending" : "Fellow"}
              </th>
              {blocks.map((b) => (
                <th key={b.start} className="border border-black/40 bg-neutral-100 px-1 py-1 text-center tnum print:bg-white">
                  B{b.index}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ person, cells }) => (
              <tr key={person.id}>
                <td className="border border-black/40 px-1.5 py-0.5 font-medium">{person.name}</td>
                {cells.map((c, j) => (
                  <td key={j} className="border border-black/40 px-1 py-0.5 text-center font-mono">
                    {c.code ?? "·"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-5 text-center text-[10px] text-neutral-500">
        Atria · version {v} · generated {new Date(generatedAt).toLocaleString("en-US")} · this copy is a point-in-time snapshot
      </div>
    </div>
  );
}
