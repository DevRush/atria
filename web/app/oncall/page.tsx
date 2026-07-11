import { AppShell } from "@/components/AppShell";
import { getState } from "@/lib/state";
import { initials, onCallFor } from "@/lib/view";

export const dynamic = "force-dynamic";

/**
 * Who's-on-call — the read path (SPEC §1, §7). In production this is a static,
 * CDN-served artifact in a separate failure domain from the solver and app: it
 * stays up at 3am even if everything else is down. Here it reads the published
 * head directly. It reflects repairs the moment they publish.
 */
export default async function OnCallPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const state = await getState();
  const sp = await searchParams;
  const date = sp.d ?? "2026-09-12";
  const roster = onCallFor(state, date);

  // the demo week: Sep 16–22
  const week = ["2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15"];

  return (
    <AppShell version={state.currentVersion} active="oncall">
      <div className="mx-auto max-w-[720px] px-4 py-6">
        <div className="mb-1 text-[12px] uppercase tracking-wide text-faint-foreground">Who&apos;s on call</div>
        <h1 className="text-[22px] font-semibold tracking-tight tnum">
          {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h1>
        <p className="mb-5 text-[12px] text-muted-foreground">
          Cardiology fellowship · in-house call &amp; backup · updates the instant a repair publishes.
        </p>

        <div className="space-y-2">
          {roster.length === 0 && (
            <div className="rounded-r2 border border-border bg-surface px-4 py-6 text-center text-[13px] text-muted-foreground">
              No call assignment published for this date.
            </div>
          )}
          {roster.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-r2 border border-border bg-surface px-4 py-3"
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-[12px] font-semibold ${
                  r.kind === "call"
                    ? "bg-family-inpatient-bg text-family-inpatient"
                    : "bg-family-backup-bg text-family-backup"
                }`}
              >
                {r.person ? initials(r.person.name) : "—"}
              </span>
              <div>
                <div className="text-[12px] text-muted-foreground">{r.service}</div>
                <div className="text-[15px] font-semibold">{r.person?.name ?? "Unfilled"}</div>
              </div>
              <div className="ml-auto text-right text-[11px] text-faint-foreground">
                <div>pager 5-2100</div>
                <div className="tnum">17:00 → 07:00</div>
              </div>
            </div>
          ))}
        </div>

        {/* week strip */}
        <div className="mt-6">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
            This week
          </div>
          <div className="overflow-hidden rounded-r2 border border-border">
            {week.map((d, i) => {
              const call = onCallFor(state, d).find((r) => r.kind === "call");
              const isSel = d === date;
              return (
                <a
                  key={d}
                  href={`/oncall?d=${d}`}
                  className={`flex items-center gap-3 border-b border-border px-4 py-2 text-[12.5px] last:border-0 ${
                    isSel ? "bg-surface-raised" : "hover:bg-surface-raised/50"
                  }`}
                >
                  <span className="w-24 text-muted-foreground tnum">
                    {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </span>
                  <span className="font-medium">{call?.person?.name ?? "—"}</span>
                  {isSel && <span className="ml-auto text-[10px] text-accent">viewing</span>}
                </a>
              );
            })}
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] text-faint-foreground">
          Static read path · no login · {state.currentVersion ? `source v${state.currentVersion.version}` : "unpublished"}
        </p>
      </div>
    </AppShell>
  );
}
