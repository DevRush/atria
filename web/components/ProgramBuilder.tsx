"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Assignment, Conflict, Person, Slot, StateResponse } from "@/lib/types";
import { assembleRotationRequest, eligibilityByLevel, rotationCoverage } from "@/lib/assemble";
import { initials } from "@/lib/view";
import { ScheduleGrid } from "./ScheduleGrid";
import { SolveProgress } from "./SolveProgress";

const LEVELS = ["F1", "F2", "F3"] as const;
const LEVEL_LABEL: Record<string, string> = { F1: "PGY-4", F2: "PGY-5", F3: "PGY-6" };

type Phase = "setup" | "solving" | "done" | "infeasible" | "publishing";

/** The schedule maker: edit the roster + coverage, press Generate, and the CP-SAT
 * engine builds a complete, valid, fair rotation schedule live — then publish it. */
export function ProgramBuilder({ base }: { base: StateResponse }) {
  const eligByLevel = useMemo(() => eligibilityByLevel(base), [base]);
  const coverage = useMemo(() => rotationCoverage(base), [base]);
  const [people, setPeople] = useState<Person[]>(() => base.people.map((p) => ({ ...p })));
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(coverage.filter((c) => !c.flex).map((c) => [c.serviceId, c.count]))
  );
  const [phase, setPhase] = useState<Phase>("setup");
  const [result, setResult] = useState<{ assignments: Assignment[]; slots: Slot[] } | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sumRequired = coverage.filter((c) => !c.flex).reduce((a, c) => a + Math.max(0, counts[c.serviceId] ?? 0), 0);
  const flex = Math.max(0, people.length - sumRequired);
  const overbooked = sumRequired > people.length;

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
  function setLevel(id: string, level: string) {
    setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, level: level as Person["level"], eligibleServices: eligByLevel[level] ?? p.eligibleServices } : p)));
    invalidate();
  }
  function addFellow() {
    const id = "p_new_" + Math.random().toString(36).slice(2, 8);
    setPeople((ps) => [...ps, { id, name: `New Fellow ${ps.length + 1}`, level: "F1", fte: 1, eligibleServices: eligByLevel.F1 ?? [], clinicDay: "MON" }]);
    invalidate();
  }
  function removeFellow(id: string) {
    setPeople((ps) => ps.filter((p) => p.id !== id));
    invalidate();
  }
  function setCount(serviceId: string, n: number) {
    setCounts((c) => ({ ...c, [serviceId]: Math.max(0, n) }));
    invalidate();
  }

  // optional /build?demo=generate — auto-run once (kiosk/screenshots)
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
    setError(null);
    // Instant, legible infeasibility: required coverage can't exceed the roster.
    if (overbooked) {
      setConflicts([
        {
          ruleIds: [],
          text: `Your required rotations need ${sumRequired} fellows every block, but you've rostered ${people.length}. There aren't enough people to cover them all at once.`,
          relaxations: [
            { description: `add ${sumRequired - people.length} more fellow(s)`, cost: 1 },
            { description: "lower a rotation's coverage count", cost: 1 },
          ],
        },
      ]);
      setResult(null);
      setPhase("infeasible");
      return;
    }
    setPhase("solving");
    const started = Date.now();
    try {
      const { request, slots } = assembleRotationRequest(base, people, counts);
      const r = await fetch("/api/solve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const data = await r.json();
      // let the progress narration breathe so the build reads as real work
      const elapsed = Date.now() - started;
      if (elapsed < 1400) await new Promise((res) => setTimeout(res, 1400 - elapsed));
      if (r.ok && data.feasible) {
        setResult({ assignments: data.assignments as Assignment[], slots });
        setPhase("done");
      } else if (r.ok && data.feasible === false) {
        setConflicts((data.conflicts as Conflict[]) ?? []);
        setPhase("infeasible");
      } else {
        throw new Error(data.error ?? "The engine could not be reached.");
      }
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
      const callSlots = base.slots.filter((s) => s.grain === "call-night");
      const callSlotIds = new Set(callSlots.map((s) => s.id));
      const alive = new Set(people.map((p) => p.id));
      const callAssignments = base.assignments
        .filter((a) => callSlotIds.has(a.slotId) && alive.has(a.personId))
        .map((a) => ({ slotId: a.slotId, personId: a.personId }));
      const body = {
        people,
        services: base.services,
        slots: [...result.slots, ...callSlots],
        rules: base.rules,
        holidays: base.holidays,
        assignments: [
          ...result.assignments.map((a) => ({ slotId: a.slotId, personId: a.personId })),
          ...callAssignments,
        ],
        publishedBy: "Chief Fellow",
      };
      const r = await fetch("/api/build/commit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error ?? "Publish failed");
      window.location.href = "/";
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("done");
    }
  }

  const resultState: StateResponse | null = result
    ? ({ ...base, people, slots: result.slots, assignments: result.assignments } as StateResponse)
    : null;

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 px-4 py-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[16px] font-semibold tracking-tight">Build the schedule</h1>
          <p className="text-[12.5px] text-muted-foreground">
            Set your roster and what each rotation needs, then generate. The engine places every fellow,
            honors the duty-hour rules, and balances call — in seconds.
          </p>
        </div>
      </div>

      {/* setup: two columns */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* People */}
        <section className="rounded-r2 border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="text-[13px] font-semibold">Fellows <span className="ml-1 font-normal text-muted-foreground tnum">{people.length}</span></div>
            <button onClick={addFellow} className="rounded-r1 border border-border px-2 py-1 text-[11.5px] text-muted-foreground hover:text-foreground">+ Add fellow</button>
          </div>
          <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {people.map((p) => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface-raised text-[9px] font-semibold text-muted-foreground">{initials(p.name)}</span>
                <input
                  value={p.name}
                  onChange={(e) => setPerson(p.id, { name: e.target.value })}
                  className="min-w-0 flex-1 rounded-r1 border border-transparent bg-transparent px-1.5 py-0.5 text-[12.5px] font-medium hover:border-border focus:border-accent focus:outline-none"
                />
                <select
                  value={p.level}
                  onChange={(e) => setLevel(p.id, e.target.value)}
                  className="rounded-r1 border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {LEVELS.map((l) => (<option key={l} value={l}>{LEVEL_LABEL[l]}</option>))}
                </select>
                <button onClick={() => removeFellow(p.id)} className="shrink-0 rounded px-1 text-[13px] text-faint-foreground hover:text-status-block" title="Remove">×</button>
              </div>
            ))}
          </div>
        </section>

        {/* Coverage + Constraints */}
        <div className="space-y-4">
          <section className="rounded-r2 border border-border bg-surface">
            <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">
              Coverage <span className="ml-1 font-normal text-muted-foreground">— fellows per rotation, each block</span>
            </div>
            <div className="divide-y divide-border">
              {coverage.map((c) => (
                <div key={c.serviceId} className="flex items-center gap-3 px-4 py-1.5 text-[12.5px]">
                  <span className="font-mono text-[11px] font-medium">{c.code}</span>
                  <span className="truncate text-muted-foreground">{c.name}</span>
                  <span className="ml-auto">
                    {c.flex ? (
                      <span className="text-[11px] text-faint-foreground tnum">{flex} · flex (fills the rest)</span>
                    ) : (
                      <span className="inline-flex items-center rounded-r1 border border-border">
                        <button onClick={() => setCount(c.serviceId, (counts[c.serviceId] ?? 0) - 1)} className="px-2 py-0.5 text-muted-foreground hover:text-foreground">−</button>
                        <span className="w-6 text-center tabular-nums">{counts[c.serviceId] ?? 0}</span>
                        <button onClick={() => setCount(c.serviceId, (counts[c.serviceId] ?? 0) + 1)} className="px-2 py-0.5 text-muted-foreground hover:text-foreground">+</button>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className={`border-t border-border px-4 py-1.5 text-[11px] ${overbooked ? "text-status-block" : "text-faint-foreground"}`}>
              {overbooked
                ? `Required rotations need ${sumRequired} fellows but you have ${people.length} — the engine will flag the gap.`
                : `${sumRequired} of ${people.length} fellows on required rotations · ${flex} on research each block.`}
            </div>
          </section>

          <section className="rounded-r2 border border-border bg-surface">
            <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">
              Constraints <span className="ml-1 font-normal text-muted-foreground">— always enforced</span>
            </div>
            <ul className="max-h-[150px] space-y-1 overflow-y-auto px-4 py-2 text-[11.5px] text-muted-foreground">
              <li className="text-foreground">ACGME duty-hours: 24+4h cap, 14h rest, 1-in-7 off, call spacing</li>
              {base.rules.filter((r) => r.confirmed).slice(0, 6).map((r) => (
                <li key={r.id} className="truncate">· {r.text}</li>
              ))}
              {base.rules.length > 6 && <li className="text-faint-foreground">+{base.rules.length - 6} more — edit on the Rules tab</li>}
            </ul>
          </section>
        </div>
      </div>

      {/* generate bar */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-r2 border border-border bg-surface-raised px-4 py-3 shadow-sm">
        <button
          onClick={generate}
          disabled={phase === "solving" || phase === "publishing"}
          className="rounded-r1 bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {phase === "solving" ? "Generating…" : phase === "done" ? "Regenerate" : "Generate schedule"}
        </button>
        {phase === "solving" ? (
          <SolveProgress />
        ) : (
          <span className="text-[11.5px] text-muted-foreground">
            Runs the CP-SAT engine on your inputs — a full year in seconds.
          </span>
        )}
        {error && <span className="ml-auto text-[11.5px] text-status-block">{error}</span>}
      </div>

      {/* infeasible */}
      {phase === "infeasible" && (
        <section className="rounded-r2 border border-status-block-border bg-status-block-bg/40 px-4 py-3">
          <div className="text-[13px] font-semibold text-status-block">This can&apos;t be scheduled as set</div>
          <p className="mb-2 mt-0.5 text-[12px] text-muted-foreground">
            The engine proved no schedule satisfies every rule with these inputs. What&apos;s colliding:
          </p>
          <ul className="space-y-2">
            {conflicts.slice(0, 4).map((c, i) => (
              <li key={i} className="rounded-r1 border border-border bg-surface px-3 py-2 text-[12px]">
                <div>{c.text}</div>
                {c.relaxations?.length > 0 && (
                  <div className="mt-1 text-[11px] text-muted-foreground">Try: {c.relaxations.map((r) => r.description).join(" · ")}</div>
                )}
              </li>
            ))}
            {conflicts.length === 0 && (
              <li className="text-[12px] text-muted-foreground">Not enough fellows to cover the required rotations — add fellows or lower a coverage count.</li>
            )}
          </ul>
        </section>
      )}

      {/* result */}
      {phase !== "infeasible" && resultState && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-r2 border border-status-ok-bg bg-status-ok-bg/40 px-4 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-status-ok">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M6.5 10.6 3.9 8a.8.8 0 0 0-1.1 1.1l3.1 3.1a.8.8 0 0 0 1.1 0l6.2-6.2A.8.8 0 0 0 12.1 5L6.5 10.6Z" /></svg>
              Schedule generated
            </span>
            <span className="text-[12px] text-muted-foreground">
              {people.length} fellows · 13 blocks · every rotation covered · every duty-hour rule satisfied
            </span>
            <button
              onClick={publish}
              disabled={phase === "publishing"}
              className="ml-auto rounded-r1 bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {phase === "publishing" ? "Publishing…" : "Publish as the live schedule"}
            </button>
          </div>
          <ScheduleGrid state={resultState} assignments={result!.assignments} animateIn />
          <p className="text-[11px] text-faint-foreground">
            On-call &amp; jeopardy carry over from the current schedule; publishing makes these rotations the
            live, versioned schedule — checked by the independent validator first.
          </p>
        </section>
      )}
    </div>
  );
}
