import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/db";
import { getCurrentVersion } from "@/lib/state";

export const dynamic = "force-dynamic";

/**
 * Publication history & audit trail. Every published version is immutable and
 * append-only; this surfaces the chain — who published, when, why, what moved,
 * and the independent validator's stored verdict (with its version) — plus the
 * consequential-action audit stream. Nothing here is editable; it's the record.
 */
type Cause = { kind?: string; absenceId?: string; source?: string } | null;
type Diff = { changed?: number; peopleTouched?: number; violations?: number } | null;
type Validation = { ok?: boolean; blockCount?: number; warnCount?: number; validatorVersion?: string; validatedAt?: string } | null;
type Override = { by?: string; reason?: string } | null;

const fmt = (iso: string) =>
  iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default async function HistoryPage() {
  const [versions, events, currentVersion] = await Promise.all([
    prisma.scheduleVersion.findMany({ orderBy: { version: "desc" } }),
    prisma.scheduleEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    getCurrentVersion(),
  ]);

  return (
    <AppShell version={currentVersion} active="history">
      <div className="mx-auto max-w-[760px] px-4 py-5">
        <div className="mb-4">
          <h1 className="text-[15px] font-semibold tracking-tight">Publication history</h1>
          <p className="text-[12px] text-muted-foreground">
            Every version is immutable and append-only. Each publish records who, when, why, what moved,
            and the independent validator&apos;s verdict — the trail a program can audit.
          </p>
        </div>

        <div className="space-y-2">
          {versions.map((raw) => {
            const v = raw as unknown as {
              version: number; publishedAt: string; publishedBy: string; parent: number | null;
              cause: Cause; diff: Diff; validation: Validation; override: Override; seed: number | null;
            };
            const val = v.validation;
            return (
              <div key={v.version} className="rounded-r2 border border-border bg-surface px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-r1 bg-surface-raised px-2 py-0.5 text-[12px] font-semibold tnum">
                    v{v.version}
                  </span>
                  <span className="text-[12px] text-muted-foreground">{v.cause?.kind ?? "publish"}</span>
                  {v.cause?.source && <span className="text-[11px] text-faint-foreground">· {v.cause.source}</span>}
                  <span className="ml-auto text-[11px] text-faint-foreground tnum">{fmt(v.publishedAt)}</span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
                  <span>by <span className="text-foreground">{v.publishedBy}</span></span>
                  {v.parent != null && <span className="tnum">from v{v.parent}</span>}
                  {v.diff && (
                    <span className="tnum">
                      {v.diff.changed ?? 0} changed · {v.diff.peopleTouched ?? 0} people
                    </span>
                  )}
                  {v.seed != null && <span className="font-mono text-[10px] text-faint-foreground">seed {v.seed}</span>}
                </div>

                {/* validation receipt */}
                {val && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2 text-[11px]">
                    <span
                      className={`inline-flex items-center gap-1 rounded-r1 px-1.5 py-0.5 font-medium ${
                        val.ok ? "bg-status-ok-bg text-status-ok" : "bg-status-block-bg text-status-block"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${val.ok ? "bg-status-ok" : "bg-status-block"}`} />
                      {val.ok ? "validated clean" : `${val.blockCount ?? 0} blocking`}
                    </span>
                    {(val.warnCount ?? 0) > 0 && (
                      <span className="text-muted-foreground">{val.warnCount} soft warning(s)</span>
                    )}
                    {val.validatorVersion && (
                      <span className="font-mono text-[10px] text-faint-foreground">
                        {val.validatorVersion}{val.validatedAt ? ` · ${fmt(val.validatedAt)}` : ""}
                      </span>
                    )}
                  </div>
                )}

                {/* override waiver, if any */}
                {v.override?.by && (
                  <div className="mt-2 rounded-r1 border border-status-warn-border bg-status-warn-bg/50 px-2 py-1 text-[11px]">
                    <span className="font-medium text-status-warn">Override waiver</span> by {v.override.by}
                    {v.override.reason ? ` — “${v.override.reason}”` : ""}
                  </div>
                )}
              </div>
            );
          })}
          {versions.length === 0 && (
            <div className="rounded-r2 border border-border bg-surface px-4 py-6 text-center text-[12.5px] text-muted-foreground">
              No versions published yet.
            </div>
          )}
        </div>

        {/* audit stream */}
        <h2 className="mb-2 mt-6 text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
          Audit log · recent actions
        </h2>
        <div className="overflow-hidden rounded-r2 border border-border bg-surface">
          {events.map((raw) => {
            const e = raw as unknown as { id: string; actor: string; eventType: string; createdAt: string };
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 border-b border-border px-3 py-1.5 text-[11.5px] last:border-0"
              >
                <span className="font-mono text-[10px] text-faint-foreground">{e.eventType}</span>
                <span className="text-muted-foreground">{e.actor}</span>
                <span className="ml-auto text-faint-foreground tnum">{fmt(e.createdAt)}</span>
              </div>
            );
          })}
          {events.length === 0 && (
            <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">No audit events yet.</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
