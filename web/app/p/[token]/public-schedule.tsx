import type { PublicProjection } from "@/lib/projection";

const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtFull = (iso: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";
const monthOf = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });

export function PublicSchedule({ p }: { p: PublicProjection }) {
  // group call by month
  const byMonth = new Map<string, typeof p.call>();
  for (const c of p.call) {
    const m = monthOf(c.date);
    (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(c);
  }

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6">
      <header className="mb-5 border-b border-border pb-4">
        <div className="text-[11px] uppercase tracking-wide text-faint-foreground">{p.programDisplayName}</div>
        <h1 className="text-[20px] font-semibold tracking-tight">{p.scheduleTitle}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-muted-foreground tnum">
          {p.version != null && <span>Version {p.version}</span>}
          <span>Published {fmtFull(p.publishedAt ?? "")}</span>
          {p.effectiveStart && <span>Covers {fmtDate(p.effectiveStart)} – {fmtDate(p.effectiveEnd)}</span>}
          <span>{p.timezone}</span>
        </div>
        <p className="mt-2 text-[11px] text-faint-foreground">
          Read-only shared view · names are shown as initials · a printed copy may be out of date — always
          check the live link.
        </p>
      </header>

      {/* On-call roster */}
      <section className="mb-6">
        <h2 className="mb-2 text-[13px] font-semibold">On-call roster</h2>
        <div className="space-y-4">
          {[...byMonth.entries()].map(([month, days]) => (
            <div key={month}>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint-foreground">{month}</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 sm:grid-cols-3">
                {days.map((c) => (
                  <div key={c.date} className="flex items-baseline gap-2 text-[12.5px]">
                    <span className="w-16 shrink-0 text-muted-foreground tnum">
                      {c.weekday} {fmtDate(c.date)}
                    </span>
                    <span className="font-medium">{c.person}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rotation grid */}
      <section>
        <h2 className="mb-2 text-[13px] font-semibold">Block rotations</h2>
        <div className="overflow-x-auto rounded-r2 border border-border">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border-strong bg-surface-raised">
                <th className="sticky left-0 bg-surface-raised px-2 py-1 text-left font-medium text-muted-foreground">Fellow</th>
                {p.blockLabels.map((l, i) => (
                  <th key={i} className="border-l border-border px-1 py-1 text-center font-medium text-faint-foreground tnum">
                    B{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {p.blocks.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="sticky left-0 bg-surface px-2 py-0.5 font-medium">{row.person}</td>
                  {row.cells.map((c, j) => (
                    <td key={j} className="border-l border-border px-1 py-0.5 text-center font-mono text-[10px] text-muted-foreground">
                      {c ?? "·"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="mt-6 text-center text-[10.5px] text-faint-foreground">
        Shared securely · no login · {p.contentHash}
      </footer>
    </div>
  );
}
