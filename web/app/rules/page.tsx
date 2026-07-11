import { AppShell } from "@/components/AppShell";
import { getState } from "@/lib/state";
import type { Rule } from "@/lib/types";

export const dynamic = "force-dynamic";

const LEVEL_META: Record<string, { label: string; cls: string; blurb: string }> = {
  hard: { label: "Hard", cls: "text-status-block border-status-block-border bg-status-block-bg", blurb: "solver-infeasible if broken" },
  blocking: { label: "Blocking", cls: "text-status-warn border-status-warn-border bg-status-warn-bg", blurb: "blocks publish; overridable by a named human" },
  soft: { label: "Soft", cls: "text-muted-foreground border-border bg-surface-raised", blurb: "optimized toward, in priority tiers" },
};

/**
 * Rules as data (SPEC §2, §4). Each rule is a typed record with a plain-English
 * sentence, provenance, and a replay check against last year's schedule — the
 * confirmation UI for AI-captured rules. "LLM proposes, solver disposes."
 */
export default async function RulesPage() {
  const state = await getState();
  const groups: Record<string, Rule[]> = { hard: [], blocking: [], soft: [] };
  for (const r of state.rules) (groups[r.level] ?? groups.soft).push(r);

  return (
    <AppShell version={state.currentVersion} active="rules">
      <div className="mx-auto max-w-[860px] px-4 py-5">
        <h1 className="text-[15px] font-semibold tracking-tight">Rule Catalog</h1>
        <p className="mb-5 max-w-[620px] text-[12px] text-muted-foreground">
          Every scheduling rule is a typed, versioned record — not code. Claude drafts these from a
          program&apos;s spreadsheet and policies; each is replayed against last year&apos;s real schedule
          and confirmed by a human before it can bind the solver. ACGME duty-hour limits are hard-coded
          in the independent validator regardless of what&apos;s captured here.
        </p>

        {(["hard", "blocking", "soft"] as const).map((lvl) =>
          groups[lvl].length ? (
            <div key={lvl} className="mb-5">
              <div className="mb-2 flex items-center gap-2">
                <span className={`rounded-r1 border px-1.5 py-0.5 text-[10.5px] font-medium ${LEVEL_META[lvl].cls}`}>
                  {LEVEL_META[lvl].label}
                </span>
                <span className="text-[11px] text-faint-foreground">{LEVEL_META[lvl].blurb}</span>
              </div>
              <div className="space-y-1.5">
                {groups[lvl].map((r) => (
                  <div key={r.id} className="flex items-start gap-3 rounded-r2 border border-border bg-surface px-3 py-2.5">
                    <span className="mt-0.5 shrink-0 font-mono text-[10px] text-faint-foreground">{r.id}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px]">{r.text}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-faint-foreground">
                        <span className="font-mono">{r.type}</span>
                        {r.scope !== "all" && <span>scope: {r.scope}</span>}
                        {r.tier && <span>tier: {r.tier}</span>}
                        {r.source && <span>source: {r.source}</span>}
                        {r.replay && typeof (r.replay as { violationsLastYear?: number }).violationsLastYear === "number" && (
                          <span className="inline-flex items-center gap-1 text-status-ok">
                            <span className="h-1 w-1 rounded-full bg-status-ok" />
                            replay: {(r.replay as { violationsLastYear: number }).violationsLastYear} violations last year
                          </span>
                        )}
                      </div>
                    </div>
                    {r.confirmed && (
                      <span className="mt-0.5 shrink-0 text-[10px] text-status-ok" title="Confirmed by a human">
                        ✓ confirmed
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>
    </AppShell>
  );
}
