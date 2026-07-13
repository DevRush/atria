"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Assignment, Conflict, Person, Slot, StateResponse } from "@/lib/types";
import { assembleMonthlyCallRequest, callServices } from "@/lib/assemble";
import { monthName } from "@/lib/calendar";
import { initials } from "@/lib/view";
import { MonthCalendar } from "./MonthCalendar";
import { SolveProgress } from "./SolveProgress";

const STEMI = "STEMICALL";
type Phase = "setup" | "solving" | "done" | "infeasible" | "publishing";

/** Build one month of attending call: pick the month, set who covers which line
 * (interventional STEMI vs general), Generate, and the engine fills the month —
 * STEMI call going only to the credentialed, spaced and balanced. */
export function CallBuilder({ base }: { base: StateResponse }) {
  const domains = useMemo(() => callServices(base), [base]);
  const [people, setPeople] = useState<Person[]>(() => base.people.map((p) => ({ ...p })));
  // academic-year months: Jul 2026 … Jun 2027
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const m = (6 + i) % 12;
        const y = 2026 + (6 + i >= 12 ? 1 : 0);
        return { year: y, month: m, label: `${monthName(m)} ${y}` };
      }),
    []
  );
  const [sel, setSel] = useState(() => months.findIndex((m) => m.year === 2027 && m.month === 0)); // Jan 2027
  const [phase, setPhase] = useState<Phase>("setup");
  const [result, setResult] = useState<{ assignments: Assignment[]; slots: Slot[] } | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cur = months[sel] ?? months[0];
  const intervCount = people.filter((p) => p.eligibleServices.includes(STEMI)).length;

  function invalidate() {
    if (phase === "done" || phase === "infeasible") {
      setPhase("setup");
      setResult(null);
      setConflicts([]);
    }
  }
  function setPerson(id: string, patch: Partial<Person>) {
    setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    invalidate();
  }
  function toggleInterventional(id: string) {
    setPeople((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p;
        const has = p.eligibleServices.includes(STEMI);
        return { ...p, eligibleServices: has ? p.eligibleServices.filter((s) => s !== STEMI) : [...p.eligibleServices, STEMI] };
      })
    );
    invalidate();
  }
  function addAttending() {
    const id = "p_new_" + Math.random().toString(36).slice(2, 8);
    const eligible = [...new Set(base.people.flatMap((p) => p.eligibleServices).filter((s) => s !== STEMI))];
    setPeople((ps) => [...ps, { id, name: `New Attending ${ps.length + 1}`, level: "Attending", fte: 1, eligibleServices: eligible, clinicDay: null }]);
    invalidate();
  }
  function removeAttending(id: string) {
    setPeople((ps) => ps.filter((p) => p.id !== id));
    invalidate();
  }

  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("demo") === "generate") {
      autoRan.current = true;
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setPhase("solving");
    setError(null);
    const started = Date.now();
    try {
      const { request, slots } = assembleMonthlyCallRequest(base, people, cur.year, cur.month);
      const r = await fetch("/api/solve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const data = await r.json();
      const elapsed = Date.now() - started;
      if (elapsed < 1400) await new Promise((res) => setTimeout(res, 1400 - elapsed));
      if (r.ok && data.feasible) {
        setResult({ assignments: data.assignments as Assignment[], slots });
        setPhase("done");
      } else if (r.ok && data.feasible === false) {
        setConflicts((data.conflicts as Conflict[]) ?? []);
        setPhase("infeasible");
      } else throw new Error(data.error ?? "The engine could not be reached.");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("setup");
    }
  }

  async function publish() {
    if (!result) return;
    setPhase("publishing");
    setError(null);
    try {
      const monthPrefix = `${cur.year}-${String(cur.month + 1).padStart(2, "0")}`;
      const slotById = new Map(base.slots.map((s) => [s.id, s]));
      const isThisMonthCall = (slotId: string) => {
        const s = slotById.get(slotId);
        return s?.grain === "call-night" && s.start.slice(0, 7) === monthPrefix;
      };
      // keep everything except this month's old call; add the freshly generated call
      const keptSlots = base.slots.filter((s) => !(s.grain === "call-night" && s.start.slice(0, 7) === monthPrefix));
      const keptAssignments = base.assignments
        .filter((a) => !isThisMonthCall(a.slotId))
        .map((a) => ({ slotId: a.slotId, personId: a.personId }));
      const body = {
        people,
        services: base.services,
        slots: [...keptSlots, ...result.slots],
        rules: base.rules,
        holidays: base.holidays,
        assignments: [...keptAssignments, ...result.assignments.map((a) => ({ slotId: a.slotId, personId: a.personId }))],
        publishedBy: "Division Chief",
      };
      const r = await fetch("/api/build/commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error ?? "Publish failed");
      window.location.href = "/oncall";
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("done");
    }
  }

  const previewState: StateResponse | null = result
    ? ({ ...base, people, slots: result.slots, assignments: result.assignments } as StateResponse)
    : null;

  return (
    <div className="mx-auto max-w-[1000px] space-y-4 px-4 py-5">
      <div>
        <h1 className="text-[16px] font-semibold tracking-tight">Build the monthly call schedule</h1>
        <p className="text-[12.5px] text-muted-foreground">
          Pick a month and set who covers which line. The engine fills every night — interventional STEMI
          call only to the credentialed — spaced and balanced, in about a second.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* attendings */}
        <section className="rounded-r2 border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="text-[13px] font-semibold">Attendings <span className="ml-1 font-normal text-muted-foreground tnum">{people.length}</span></div>
            <button onClick={addAttending} className="rounded-r1 border border-border px-2 py-1 text-[11.5px] text-muted-foreground hover:text-foreground">+ Add attending</button>
          </div>
          <div className="max-h-[440px] divide-y divide-border overflow-y-auto">
            {people.map((p) => {
              const interv = p.eligibleServices.includes(STEMI);
              return (
                <div key={p.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-raised text-[9px] font-semibold text-muted-foreground">{initials(p.name)}</span>
                  <input
                    value={p.name}
                    onChange={(e) => setPerson(p.id, { name: e.target.value })}
                    className="min-w-0 flex-1 rounded-r1 border border-transparent bg-transparent px-1.5 py-0.5 text-[12.5px] font-medium hover:border-border focus:border-accent focus:outline-none"
                  />
                  <button
                    onClick={() => toggleInterventional(p.id)}
                    className={`shrink-0 rounded-r1 border px-1.5 py-0.5 text-[10px] font-medium ${
                      interv ? "border-family-procedural-border bg-family-procedural-bg text-family-procedural" : "border-border text-faint-foreground hover:text-foreground"
                    }`}
                    title="Interventional attendings can take STEMI call"
                  >
                    {interv ? "Interventional" : "General only"}
                  </button>
                  <button onClick={() => removeAttending(p.id)} className="shrink-0 rounded px-1 text-[13px] text-faint-foreground hover:text-status-block" title="Remove">×</button>
                </div>
              );
            })}
          </div>
        </section>

        {/* month + coverage */}
        <div className="space-y-4">
          <section className="rounded-r2 border border-border bg-surface p-4">
            <div className="mb-2 text-[13px] font-semibold">Month</div>
            <select
              value={sel}
              onChange={(e) => { setSel(Number(e.target.value)); invalidate(); }}
              className="w-full rounded-r1 border border-border bg-surface px-2 py-1.5 text-[13px]"
            >
              {months.map((m, i) => (<option key={i} value={i}>{m.label}</option>))}
            </select>
          </section>
          <section className="rounded-r2 border border-border bg-surface">
            <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">Call lines <span className="ml-1 font-normal text-muted-foreground">— one per night</span></div>
            <div className="divide-y divide-border">
              {domains.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
                  <span className="font-mono text-[11px] font-medium">{d.code}</span>
                  <span className="truncate text-muted-foreground">{d.name}</span>
                  <span className="ml-auto text-[11px] text-faint-foreground">
                    {d.id === STEMI ? `${intervCount} interventional` : `${people.length} eligible`}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-1.5 text-[11px] text-faint-foreground">
              Enforced: ≥4 nights between calls · min rest after call · weekend &amp; holiday call spread evenly.
            </div>
          </section>
        </div>
      </div>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-r2 border border-border bg-surface-raised px-4 py-3 shadow-sm">
        <button
          onClick={generate}
          disabled={phase === "solving" || phase === "publishing"}
          className="rounded-r1 bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {phase === "solving" ? "Generating…" : phase === "done" ? "Regenerate" : `Generate ${cur.label} call`}
        </button>
        {phase === "solving" ? <SolveProgress /> : <span className="text-[11.5px] text-muted-foreground">Runs the CP-SAT engine — a full month of call in about a second.</span>}
        {error && <span className="ml-auto text-[11.5px] text-status-block">{error}</span>}
      </div>

      {phase === "infeasible" && (
        <section className="rounded-r2 border border-status-block-border bg-status-block-bg/40 px-4 py-3">
          <div className="text-[13px] font-semibold text-status-block">This month can&apos;t be covered as set</div>
          <ul className="mt-2 space-y-2">
            {conflicts.slice(0, 4).map((c, i) => (
              <li key={i} className="rounded-r1 border border-border bg-surface px-3 py-2 text-[12px]">{c.text}</li>
            ))}
            {conflicts.length === 0 && <li className="text-[12px] text-muted-foreground">Too few interventional attendings to cover STEMI call with the required spacing — mark another attending interventional, or add one.</li>}
          </ul>
        </section>
      )}

      {phase !== "infeasible" && previewState && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-r2 border border-status-ok-bg bg-status-ok-bg/40 px-4 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-status-ok">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 10.6 3.9 8a.8.8 0 0 0-1.1 1.1l3.1 3.1a.8.8 0 0 0 1.1 0l6.2-6.2A.8.8 0 0 0 12.1 5L6.5 10.6Z" /></svg>
              {cur.label} call generated
            </span>
            <span className="text-[12px] text-muted-foreground">every night covered · STEMI credentialed · spacing &amp; equity satisfied</span>
            <button onClick={publish} disabled={phase === "publishing"} className="ml-auto rounded-r1 bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-60">
              {phase === "publishing" ? "Publishing…" : "Publish this month"}
            </button>
          </div>
          <MonthCalendar state={previewState} animateIn />
        </section>
      )}
    </div>
  );
}
