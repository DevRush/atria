"use client";
import { useEffect, useRef, useState } from "react";
import type {
  RepairCandidate,
  RepairResponse,
  StateResponse,
} from "@/lib/types";

const personName = (state: StateResponse, id: string | null) =>
  state.people.find((p) => p.id === id)?.name ?? id ?? "—";

const fmtDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export function DisruptionReceipt({
  candidate,
  totalAssignments,
}: {
  candidate: RepairCandidate;
  totalAssignments: number;
}) {
  const d = candidate.diff;
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-mono text-[11px] text-muted-foreground tnum">
      <Stat n={d.changes.length} label={`of ${totalAssignments} changed`} strong />
      <span className="text-faint-foreground">·</span>
      <Stat n={d.peopleTouched} label="people affected" />
      <span className="text-faint-foreground">·</span>
      <span className={d.violations === 0 ? "text-status-ok" : "text-status-block"}>
        {d.violations} violations
      </span>
    </div>
  );
}

function Stat({ n, label, strong }: { n: number; label: string; strong?: boolean }) {
  return (
    <span>
      <span className={strong ? "text-foreground" : "text-foreground/80"}>{n}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function DisruptionMeter({ score, max }: { score: number; max: number }) {
  const pct = Math.max(4, Math.min(100, (score / Math.max(max, 1)) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[10px] text-faint-foreground tnum">{score.toFixed(1)}</span>
    </div>
  );
}

export function RepairFlow({
  state,
  onPublished,
}: {
  state: StateResponse;
  onPublished: (v: number) => void;
}) {
  const demoAbsence = state.absences[0];
  const victim = state.people.find((p) => p.id === demoAbsence?.personId);
  const [phase, setPhase] = useState<"idle" | "solving" | "candidates" | "publishing" | "done">("idle");
  const [resp, setResp] = useState<RepairResponse | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);

  // Optional auto-run for kiosk/demo screenshots: /?repair=auto triggers the solve on load.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("repair") === "auto") {
      autoRan.current = true;
      void runRepair();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!demoAbsence || !victim) return null;

  async function runRepair() {
    setPhase("solving");
    setError(null);
    try {
      const body = {
        people: state.people,
        services: state.services,
        slots: state.slots,
        rules: state.rules,
        locks: state.locks,
        baseAssignments: state.assignments,
        absences: [demoAbsence],
        event: { kind: "absence", absenceId: demoAbsence.id, now: "2026-09-08" },
        maxCandidates: 3,
        seed: 4711,
      };
      const r = await fetch("/api/repair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await r.json()) as RepairResponse & { error?: string };
      if (!r.ok || data.error) throw new Error(data.error ?? "Repair failed");
      setResp(data);
      setSelected(0);
      setPhase("candidates");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("idle");
    }
  }

  async function publish() {
    if (!resp) return;
    const cand = resp.candidates[selected];
    setPhase("publishing");
    setError(null);
    try {
      const r = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignments: cand.assignments.map((a) => ({
            slotId: a.slotId,
            personId: a.personId,
            provenance: a.provenance,
          })),
          publishedBy: "Dr. Chief Fellow",
          cause: { kind: "repair", absenceId: demoAbsence.id },
          inputHash: resp.inputHash,
          seed: resp.seed,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error ?? "Publish blocked by validator");
      setPublishedVersion(data.version.version);
      setPhase("done");
      onPublished(data.version.version);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("candidates");
    }
  }

  const maxScore = Math.max(...(resp?.candidates.map((c) => c.diff.disruptionScore) ?? [1]), 1);

  return (
    <section className="rounded-r2 border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="text-[13px] font-semibold">Repair</span>
        <span className="text-[12px] text-muted-foreground">minimal-disruption re-solve</span>
        {phase === "done" && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-r1 bg-status-ok-bg px-2 py-0.5 text-[11px] font-medium text-status-ok">
            published v{publishedVersion}
          </span>
        )}
      </div>

      <div className="p-4">
        {/* The event */}
        <div className="mb-3 flex items-start gap-3 rounded-r2 border border-status-warn-border bg-status-warn-bg/60 px-3 py-2.5">
          <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-status-warn/15 text-status-warn">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.9.9 0 01.9.9v3.6a.9.9 0 01-1.8 0V4.9A.9.9 0 018 4zm0 7.2a1 1 0 110 2 1 1 0 010-2z"/></svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px]">
              <span className="font-semibold">{victim.name}</span> called in sick —{" "}
              <span className="tnum">{fmtDate(demoAbsence.start)}</span> to{" "}
              <span className="tnum">{fmtDate(demoAbsence.end)}</span>
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              Overlaps her weekend in-house call on Sat Sep 12. Coverage must be restored without
              disturbing the rest of the published schedule.
            </div>
          </div>
          {phase === "idle" && (
            <button
              onClick={runRepair}
              className="shrink-0 rounded-r1 bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
            >
              Find repairs
            </button>
          )}
          {phase === "solving" && (
            <span className="shrink-0 animate-pulse text-[12px] text-muted-foreground">solving…</span>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-r1 border border-status-block-border bg-status-block-bg px-3 py-2 text-[12px] text-status-block">
            {error}
          </div>
        )}

        {/* Candidates */}
        {resp && phase !== "idle" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
                {resp.candidates.length} valid repairs · ranked by disruption
              </span>
              <span className="text-[11px] text-faint-foreground">solver seed {resp.seed} · reproducible</span>
            </div>
            {resp.candidates.map((cand, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`block w-full rounded-r2 border px-3 py-2.5 text-left transition-colors ${
                  selected === i
                    ? "border-accent bg-accent/[0.04]"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-full border text-[9px] ${
                      selected === i ? "border-accent bg-accent text-white" : "border-border-strong text-faint-foreground"
                    }`}
                  >
                    {selected === i ? "✓" : i + 1}
                  </span>
                  <span className="text-[12.5px] font-medium">
                    Option {i + 1}
                    {i === 0 && <span className="ml-1.5 text-[10px] font-normal text-status-ok">least disruptive</span>}
                  </span>
                  <span className="ml-auto">
                    <DisruptionMeter score={cand.diff.disruptionScore} max={maxScore} />
                  </span>
                </div>

                {/* the diff: old -> new */}
                <div className="mt-2 space-y-1 pl-6">
                  {cand.diff.changes.map((ch) => (
                    <div key={ch.slotId} className="flex items-center gap-2 text-[11.5px]">
                      <span className="w-28 shrink-0 text-muted-foreground tnum">{fmtDate(ch.date)}</span>
                      <span className="font-mono text-[10px] text-faint-foreground">{ch.serviceId}</span>
                      <span className="text-muted-foreground line-through decoration-status-block/50">
                        {personName(state, ch.from)}
                      </span>
                      <span className="text-faint-foreground">→</span>
                      <span className="font-medium text-foreground">{personName(state, ch.to)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center justify-between pl-6">
                  <DisruptionReceipt candidate={cand} totalAssignments={state.assignments.length} />
                </div>
                <p className="mt-1.5 pl-6 text-[11px] italic text-muted-foreground">{cand.explanation}</p>
              </button>
            ))}

            {phase !== "done" && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={publish}
                  disabled={phase === "publishing"}
                  className="rounded-r1 bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {phase === "publishing" ? "Validating…" : `Accept Option ${selected + 1} & publish`}
                </button>
                <span className="text-[11px] text-muted-foreground">
                  Publishing runs the independent validator first — a coverage or duty-hour gap blocks it.
                </span>
              </div>
            )}

            {phase === "done" && (
              <div className="flex items-start gap-2 rounded-r2 border border-status-ok-bg bg-status-ok-bg/50 px-3 py-2.5">
                <svg width="15" height="15" viewBox="0 0 16 16" className="mt-0.5 shrink-0 text-status-ok" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.5 5.2-4.2 4.2a.8.8 0 01-1.1 0L4.5 8.8a.8.8 0 011.1-1.1l1.1 1.1 3.7-3.7a.8.8 0 011.1 1.1z"/></svg>
                <div className="text-[12px]">
                  <div className="font-medium text-status-ok">Published as v{publishedVersion}.</div>
                  <div className="text-muted-foreground">
                    Validated clean by the independent checker. {victim.name}&apos;s call is covered;
                    everyone else&apos;s schedule is untouched. The change is versioned and every affected
                    person will be notified.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
