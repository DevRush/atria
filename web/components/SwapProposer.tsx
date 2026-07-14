"use client";
import { useMemo, useState } from "react";
import type { StateResponse, ValidateResponse } from "@/lib/types";

const fmt = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

type CallShift = { slotId: string; date: string };

/** Rule-checked call swap: pick two fellows' call nights, trade them, and the
 * independent validator confirms the result keeps every coverage/duty-hour/clinic
 * rule before a coordinator approves it (SPEC: the swap that can't break the rules). */
export function SwapProposer({ state, reload }: { state: StateResponse; reload: () => void }) {
  const callByPerson = useMemo(() => {
    const slotById = new Map(state.slots.map((s) => [s.id, s]));
    const m = new Map<string, CallShift[]>();
    for (const a of state.assignments) {
      const s = slotById.get(a.slotId);
      if (s?.grain === "call-night") {
        const arr = m.get(a.personId) ?? [];
        arr.push({ slotId: s.id, date: s.start.slice(0, 10) });
        m.set(a.personId, arr);
      }
    }
    for (const arr of m.values()) arr.sort((x, y) => x.date.localeCompare(y.date));
    return m;
  }, [state]);

  const [aPerson, setAPerson] = useState("");
  const [aSlot, setASlot] = useState("");
  const [bPerson, setBPerson] = useState("");
  const [bSlot, setBSlot] = useState("");
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState<"idle" | "publishing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);

  const ready = aSlot && bSlot && aSlot !== bSlot && aPerson !== bPerson;
  const swapped = useMemo(() => {
    if (!ready) return null;
    return state.assignments.map((a) => {
      if (a.slotId === aSlot) return { ...a, personId: bPerson, provenance: "swap" as const };
      if (a.slotId === bSlot) return { ...a, personId: aPerson, provenance: "swap" as const };
      return a;
    });
  }, [ready, state.assignments, aSlot, bSlot, aPerson, bPerson]);

  async function check() {
    if (!swapped) return;
    setChecking(true);
    setPhase("idle");
    setError(null);
    try {
      const r = await fetch("/api/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          people: state.people, services: state.services, slots: state.slots,
          rules: state.rules, assignments: swapped, absences: [],
        }),
      });
      const data = await r.json();
      if (r.ok && Array.isArray(data?.violations)) setValidation(data as ValidateResponse);
      else {
        setValidation(null);
        setError(data?.error ?? "Couldn't check the trade — try again.");
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setChecking(false);
    }
  }

  async function approve() {
    if (!swapped) return;
    setPhase("publishing");
    setError(null);
    try {
      const r = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignments: swapped.map((a) => ({ slotId: a.slotId, personId: a.personId, provenance: a.provenance })),
          publishedBy: "Dr. Chief Fellow",
          cause: { kind: "swap" },
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error ?? "Publish blocked by validator");
      setVersion(data.version.version);
      setPhase("done");
      reload();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("idle");
    }
  }

  const blocks = validation?.violations.filter((v) => v.severity === "block") ?? [];
  const clean = validation !== null && blocks.length === 0;
  const nameOf = (id: string) => state.people.find((p) => p.id === id)?.name ?? id;

  function reset() {
    setAPerson(""); setASlot(""); setBPerson(""); setBSlot("");
    setValidation(null); setPhase("idle"); setError(null);
  }

  return (
    <section className="rounded-r2 border border-border bg-surface p-3">
      <div className="mb-2 text-[12.5px] font-medium">Propose a call swap</div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <Sidef label="Fellow" people={state.people} callByPerson={callByPerson}
          person={aPerson} slot={aSlot} setPerson={(v) => { setAPerson(v); setASlot(""); setValidation(null); }}
          setSlot={(v) => { setASlot(v); setValidation(null); }} exclude={bPerson} />
        <div className="pb-1.5 text-center text-[14px] text-faint-foreground">⇄</div>
        <Sidef label="Trades with" people={state.people} callByPerson={callByPerson}
          person={bPerson} slot={bSlot} setPerson={(v) => { setBPerson(v); setBSlot(""); setValidation(null); }}
          setSlot={(v) => { setBSlot(v); setValidation(null); }} exclude={aPerson} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={check}
          disabled={!ready || checking}
          className="rounded-r1 border border-border px-3 py-1.5 text-[12px] font-medium hover:border-border-strong disabled:opacity-40"
        >
          {checking ? "Checking…" : "Check this trade"}
        </button>
        {clean && phase !== "done" && (
          <button
            onClick={approve}
            disabled={phase === "publishing"}
            className="rounded-r1 bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {phase === "publishing" ? "Publishing…" : "Approve swap & publish"}
          </button>
        )}
        {validation && (
          clean ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-status-ok">
              <span className="h-1.5 w-1.5 rounded-full bg-status-ok" />
              Valid trade — {nameOf(aPerson)} and {nameOf(bPerson)} swap; every rule still holds.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-status-block">
              <span className="h-1.5 w-1.5 rounded-full bg-status-block" />
              Can&apos;t swap: {blocks[0]?.text}
            </span>
          )
        )}
        {phase === "done" && (
          <span className="inline-flex items-center gap-2 text-[12px] text-status-ok">
            Published as v{version}.
            <button onClick={reset} className="text-accent hover:underline">Propose another</button>
          </span>
        )}
      </div>
      {error && <div className="mt-2 text-[11.5px] text-status-block">{error}</div>}
    </section>
  );
}

function Sidef({
  label, people, callByPerson, person, slot, setPerson, setSlot, exclude,
}: {
  label: string;
  people: StateResponse["people"];
  callByPerson: Map<string, CallShift[]>;
  person: string;
  slot: string;
  setPerson: (v: string) => void;
  setSlot: (v: string) => void;
  exclude: string;
}) {
  const shifts = person ? callByPerson.get(person) ?? [] : [];
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] text-faint-foreground">{label}</span>
      <select
        value={person}
        onChange={(e) => setPerson(e.target.value)}
        className="rounded-r1 border border-border bg-surface px-2 py-1 text-[12px]"
      >
        <option value="">Select a fellow…</option>
        {people.filter((p) => p.id !== exclude).map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      {person && (
        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          className="rounded-r1 border border-border bg-surface px-2 py-1 text-[12px] tnum"
        >
          <option value="">Pick a call night…</option>
          {shifts.map((s) => (
            <option key={s.slotId} value={s.slotId}>{fmt(s.date)}</option>
          ))}
        </select>
      )}
    </div>
  );
}
