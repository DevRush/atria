import { AppShell } from "@/components/AppShell";
import { getState } from "@/lib/state";
import { buildFairness, initials } from "@/lib/view";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<string, string> = { F1: "PGY-4", F2: "PGY-5", F3: "PGY-6" };

/**
 * Fairness ledger (SPEC §3). Weighted call / weekend / jeopardy load per fellow.
 * The equity spread is a first-class, explainable number — the neutral-arbiter
 * the schedule is built to be. Repairs settle into this ledger.
 */
export default async function FairnessPage() {
  const state = await getState();
  const { rows, callSpread, homogeneous } = buildFairness(state);
  const sorted = [...rows].sort((a, b) => b.call - a.call);
  const isAttending = state.people.some((p) => p.level === "Attending");
  const roster = isAttending ? "Physician" : "Fellow";
  const mean = rows.length ? rows.reduce((a, r) => a + r.call, 0) / rows.length : 0;
  // full bar = 3 calls off the average; adapts upward if a real outlier exceeds that.
  // so a tightly balanced schedule reads as short bars, an unfair one as long ones.
  const maxAbs = Math.max(3, ...rows.map((r) => Math.abs(r.call - mean)));

  return (
    <AppShell version={state.currentVersion} active="fairness">
      <div className="mx-auto max-w-[760px] px-4 py-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">Fairness Ledger</h1>
            <p className="text-[12px] text-muted-foreground">
              In-house call load across the year. Equity is measured, named, and logged — never a
              hidden score.
            </p>
          </div>
          {homogeneous && (
            <div className="text-right">
              <div className="text-[11px] text-faint-foreground">call spread (max − min)</div>
              <div className="text-[20px] font-semibold text-status-ok tnum">±{callSpread}</div>
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-r2 border border-border bg-surface">
          <div className="grid grid-cols-[1fr_3rem_4rem_3.5rem_10rem] gap-4 border-b border-border-strong bg-surface-raised px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-wide text-faint-foreground">
            <span>{roster}</span>
            <span className="text-right">Call</span>
            <span className="text-right">Weekend</span>
            <span className="text-right">Holiday</span>
            <span className="w-40">{homogeneous ? "vs. average" : "FTE"}</span>
          </div>
          {sorted.map((r) => (
            <div
              key={r.person.id}
              className="grid grid-cols-[1fr_3rem_4rem_3.5rem_10rem] items-center gap-4 border-b border-border px-3 py-1.5 text-[12.5px] last:border-0"
            >
              <span className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-surface-raised text-[9px] font-semibold text-muted-foreground">
                  {initials(r.person.name)}
                </span>
                <span className="font-medium">{r.person.name}</span>
                <span className="text-[10px] text-faint-foreground">{LEVEL_LABEL[r.person.level] ?? r.person.level}</span>
              </span>
              <span className="text-right tnum">{r.call}</span>
              <span className="text-right text-muted-foreground tnum">{r.weekend}</span>
              <span className="text-right text-muted-foreground tnum">{r.holiday}</span>
              {homogeneous ? (
                <DeviationBar dev={r.call - mean} maxAbs={maxAbs} />
              ) : (
                <span className="w-40 text-[12px] text-muted-foreground tnum">{r.person.fte.toFixed(1)}</span>
              )}
            </div>
          ))}
        </div>
        {homogeneous ? (
          <p className="mt-3 text-[11px] text-faint-foreground">
            Each bar shows a {roster.toLowerCase()}&apos;s call load relative to the group average — right of
            center is above average, left is below. A short bar everywhere means call is shared evenly. When a
            repair reassigns a shift, it prefers whoever is currently below their fair share.
          </p>
        ) : (
          <p className="mt-3 text-[11px] text-faint-foreground">
            This group mixes clinical FTE and restricted call domains (e.g. interventional STEMI call), so a
            single min−max spread wouldn&apos;t be an apples-to-apples comparison. Counts are shown per
            physician; FTE-weighted, per-domain equity targets are the next step for attending groups.
          </p>
        )}
      </div>
    </AppShell>
  );
}

/** Diverging bar: distance from the cohort's average call load. Right of the
 * center tick = busier than average; left = lighter. Short bars ⇒ balanced. */
function DeviationBar({ dev, maxAbs }: { dev: number; maxAbs: number }) {
  const pct = Math.min(50, (Math.abs(dev) / maxAbs) * 50);
  const over = dev >= 0.05;
  const under = dev <= -0.05;
  return (
    <span
      className="relative block h-2 w-40 overflow-hidden rounded-full bg-surface-raised"
      title={`${dev >= 0 ? "+" : ""}${dev.toFixed(1)} vs. average`}
    >
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border-strong" />
      {over && (
        <span className="absolute top-0 h-full rounded-r-full bg-accent/55" style={{ left: "50%", width: `${pct}%` }} />
      )}
      {under && (
        <span className="absolute top-0 h-full rounded-l-full bg-status-ok/60" style={{ right: "50%", width: `${pct}%` }} />
      )}
    </span>
  );
}
