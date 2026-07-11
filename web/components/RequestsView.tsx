"use client";
import { useMemo, useState } from "react";
import type { Absence, RepairResponse, StateResponse } from "@/lib/types";
import { absenceImpact, findSampleConflict, initials } from "@/lib/view";
import { DisruptionReceipt } from "./RepairFlow";
import { SwapProposer } from "./SwapProposer";

const TYPES = ["vacation", "sick", "conference", "parental", "leave"];
const AY_MIN = "2026-07-01";
const AY_MAX = "2027-06-30";

const fmt = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function RequestsView({
  state,
  reload,
}: {
  state: StateResponse;
  reload: () => void;
}) {
  const pending = state.absences.filter((a) => a.status === "pending");
  const decided = state.absences.filter((a) => a.status === "approved" || a.status === "denied");

  return (
    <div className="mx-auto max-w-[900px] space-y-5 px-4 py-5">
      <div>
        <h1 className="text-[15px] font-semibold tracking-tight">Requests</h1>
        <p className="text-[12px] text-muted-foreground">
          Fellows submit time off here. Each request shows its coverage impact before a coordinator
          approves it — and an approval that vacates a shift repairs it in the same step.
        </p>
      </div>

      <NewRequestForm state={state} reload={reload} />

      <SwapProposer state={state} reload={reload} />

      <section>
        <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
          Pending time off · {pending.length}
        </div>
        {pending.length === 0 ? (
          <div className="rounded-r2 border border-border bg-surface px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            No pending requests. Submit one above.
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((a) => (
              <RequestCard key={a.id} absence={a} state={state} reload={reload} />
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
            Decided
          </div>
          <div className="overflow-hidden rounded-r2 border border-border">
            {decided.map((a) => {
              const p = state.people.find((x) => x.id === a.personId);
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 border-b border-border px-3 py-1.5 text-[12.5px] last:border-0"
                >
                  <span className="font-medium">{p?.name ?? a.personId}</span>
                  <span className="text-muted-foreground">
                    {a.type} · {fmt(a.start)}–{fmt(a.end)}
                  </span>
                  <span
                    className={`ml-auto rounded-r1 px-1.5 py-0.5 text-[10.5px] font-medium ${
                      a.status === "approved"
                        ? "bg-status-ok-bg text-status-ok"
                        : "bg-surface-raised text-muted-foreground"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function NewRequestForm({ state, reload }: { state: StateResponse; reload: () => void }) {
  const [personId, setPersonId] = useState(state.people[0]?.id ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [type, setType] = useState("vacation");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const impact =
    personId && start && end ? absenceImpact(state, personId, start, end) : [];

  function fillSample() {
    const s = findSampleConflict(state);
    if (!s) return;
    setPersonId(s.personId);
    setStart(s.start);
    setEnd(s.end);
    setType("vacation");
    setError(null);
  }

  async function submit() {
    if (!personId || !start || !end) {
      setError("Pick a fellow and a date range.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personId, start, end, type }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to submit");
      setStart("");
      setEnd("");
      reload();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-r2 border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12.5px] font-medium">New time-off request</span>
        <button
          onClick={fillSample}
          className="rounded-r1 border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Fill a sample conflict
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="text-[10.5px] text-faint-foreground">Fellow</span>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className="rounded-r1 border border-border bg-surface px-2 py-1 text-[12px]"
          >
            {state.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10.5px] text-faint-foreground">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-r1 border border-border bg-surface px-2 py-1 text-[12px] capitalize"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10.5px] text-faint-foreground">From</span>
          <input
            type="date"
            min={AY_MIN}
            max={AY_MAX}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="rounded-r1 border border-border bg-surface px-2 py-1 text-[12px] tnum"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10.5px] text-faint-foreground">To</span>
          <input
            type="date"
            min={start || AY_MIN}
            max={AY_MAX}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="rounded-r1 border border-border bg-surface px-2 py-1 text-[12px] tnum"
          />
        </label>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-r1 bg-accent px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit request"}
        </button>
      </div>
      {start && end && (
        <div className="mt-2 text-[11.5px]">
          {impact.length > 0 ? (
            <span className="text-status-warn">
              Heads up: overlaps {impact.map((h) => `${h.kind} on ${fmt(h.date)}`).join(", ")} — approval
              will need a repair.
            </span>
          ) : (
            <span className="text-muted-foreground">No coverage impact for these dates.</span>
          )}
        </div>
      )}
      {error && <div className="mt-2 text-[11.5px] text-status-block">{error}</div>}
    </section>
  );
}

function RequestCard({
  absence,
  state,
  reload,
}: {
  absence: Absence;
  state: StateResponse;
  reload: () => void;
}) {
  const person = state.people.find((p) => p.id === absence.personId);
  const impact = useMemo(
    () => absenceImpact(state, absence.personId, absence.start, absence.end),
    [state, absence]
  );
  const [phase, setPhase] = useState<"idle" | "reviewing" | "candidates" | "working" | "done">("idle");
  const [resp, setResp] = useState<RepairResponse | null>(null);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "deny") {
    setPhase("working");
    setError(null);
    try {
      const r = await fetch("/api/requests/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ absenceId: absence.id, decision }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed");
      reload();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("idle");
    }
  }

  async function review() {
    setPhase("reviewing");
    setError(null);
    try {
      const r = await fetch("/api/repair", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          people: state.people,
          services: state.services,
          slots: state.slots,
          rules: state.rules,
          locks: state.locks,
          baseAssignments: state.assignments,
          absences: [absence],
          event: { kind: "absence", absenceId: absence.id, now: AY_MIN },
          maxCandidates: 3,
          seed: 4711,
        }),
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

  async function approveAndPublish() {
    if (!resp) return;
    const cand = resp.candidates[selected];
    if (!cand) return;
    setPhase("working");
    setError(null);
    try {
      const pub = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignments: cand.assignments.map((a) => ({
            slotId: a.slotId,
            personId: a.personId,
            provenance: a.provenance,
          })),
          publishedBy: "Dr. Chief Fellow",
          cause: { kind: "request-approval", absenceId: absence.id },
          inputHash: resp.inputHash,
          seed: resp.seed,
        }),
      });
      const pubData = await pub.json();
      if (!pub.ok || !pubData.ok) throw new Error(pubData.error ?? "Publish blocked by validator");
      await fetch("/api/requests/decide", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ absenceId: absence.id, decision: "approve" }),
      });
      reload();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("candidates");
    }
  }

  const personName = (id: string | null) => state.people.find((p) => p.id === id)?.name ?? id ?? "—";

  return (
    <div className="rounded-r2 border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-raised text-[9px] font-semibold text-muted-foreground">
          {person ? initials(person.name) : "?"}
        </span>
        <span className="text-[13px] font-medium">{person?.name ?? absence.personId}</span>
        <span className="text-[12px] text-muted-foreground capitalize">
          {absence.type} · {fmt(absence.start)}–{fmt(absence.end)}
        </span>
        {impact.length > 0 ? (
          <span className="rounded-r1 bg-status-warn-bg px-1.5 py-0.5 text-[10.5px] font-medium text-status-warn">
            affects {impact.map((h) => `${h.kind} ${fmt(h.date)}`).join(", ")}
          </span>
        ) : (
          <span className="rounded-r1 bg-surface-raised px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
            no coverage impact
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => decide("deny")}
            disabled={phase === "working"}
            className="rounded-r1 border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Deny
          </button>
          {impact.length === 0 ? (
            <button
              onClick={() => decide("approve")}
              disabled={phase === "working"}
              className="rounded-r1 bg-accent px-3 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {phase === "working" ? "…" : "Approve"}
            </button>
          ) : phase === "idle" ? (
            <button
              onClick={review}
              className="rounded-r1 bg-accent px-3 py-1 text-[12px] font-medium text-white hover:opacity-90"
            >
              Review &amp; approve
            </button>
          ) : phase === "reviewing" ? (
            <span className="animate-pulse text-[12px] text-muted-foreground">solving…</span>
          ) : null}
        </div>
      </div>

      {error && <div className="mt-2 text-[11.5px] text-status-block">{error}</div>}

      {resp && phase !== "idle" && phase !== "reviewing" && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-faint-foreground">
            {resp.candidates.length} repairs to cover the vacated shift · ranked by disruption
          </div>
          {resp.candidates.map((c, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={`block w-full rounded-r2 border px-3 py-2 text-left ${
                selected === i ? "border-accent bg-accent/[0.04]" : "border-border hover:border-border-strong"
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
                <span className="text-[12px] font-medium">
                  Option {i + 1}
                  {i === 0 && <span className="ml-1.5 text-[10px] font-normal text-status-ok">least disruptive</span>}
                </span>
              </div>
              <div className="mt-1.5 space-y-1 pl-6">
                {c.diff.changes.map((ch) => (
                  <div key={ch.slotId} className="flex items-center gap-2 text-[11.5px]">
                    <span className="w-20 shrink-0 text-muted-foreground tnum">{fmt(ch.date)}</span>
                    <span className="font-mono text-[10px] text-faint-foreground">{ch.serviceId}</span>
                    <span className="text-muted-foreground line-through decoration-status-block/50">
                      {personName(ch.from)}
                    </span>
                    <span className="text-faint-foreground">→</span>
                    <span className="font-medium">{personName(ch.to)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 pl-6">
                <DisruptionReceipt candidate={c} totalAssignments={state.assignments.length} />
              </div>
            </button>
          ))}
          <button
            onClick={approveAndPublish}
            disabled={phase === "working"}
            className="rounded-r1 bg-accent px-3.5 py-1.5 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {phase === "working" ? "Validating…" : `Approve & publish (Option ${selected + 1})`}
          </button>
        </div>
      )}
    </div>
  );
}
