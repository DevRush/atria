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
  const { rows, callSpread, max } = buildFairness(state);
  const sorted = [...rows].sort((a, b) => b.call - a.call);

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
          <div className="text-right">
            <div className="text-[11px] text-faint-foreground">call spread (max − min)</div>
            <div className="text-[20px] font-semibold text-status-ok tnum">±{callSpread}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-r2 border border-border bg-surface">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-border-strong bg-surface-raised px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-wide text-faint-foreground">
            <span>Fellow</span>
            <span className="text-right">Call</span>
            <span className="text-right">Weekend</span>
            <span className="w-40">Load</span>
          </div>
          {sorted.map((r) => (
            <div
              key={r.person.id}
              className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border px-3 py-1.5 text-[12.5px] last:border-0"
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
              <span className="w-40">
                <span className="block h-1.5 overflow-hidden rounded-full bg-surface-raised">
                  <span
                    className="block h-full rounded-full bg-family-inpatient"
                    style={{ width: `${(r.call / Math.max(max, 1)) * 100}%` }}
                  />
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-faint-foreground">
          A tight spread means call is shared evenly. When a repair reassigns a shift, it prefers the
          fellow currently below their fair share — so covering a sick call also nudges equity toward balance.
        </p>
      </div>
    </AppShell>
  );
}
