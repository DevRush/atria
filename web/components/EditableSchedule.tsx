"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Assignment, StateResponse, ValidateResponse } from "@/lib/types";
import { GridCell } from "@/lib/view";
import { GridLegend, ScheduleGrid } from "./ScheduleGrid";

type Snapshot = { assignments: Assignment[]; edited: string[] };

/** Interactive block grid. Click a fellow's cell, then a cell in the SAME block,
 * to swap their rotations (drag works too). Every manual swap auto-locks both
 * assignments, live-validates, and can be undone or published (validate-gated). */
export function EditableSchedule({
  state,
  onPublished,
}: {
  state: StateResponse;
  onPublished: () => void;
}) {
  const [working, setWorking] = useState<Assignment[]>(state.assignments);
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [phase, setPhase] = useState<"idle" | "publishing" | "done">("idle");
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // optional /?edit=demo — auto-apply one clean, mutually-eligible swap (kiosk/demo)
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("edit") !== "demo") return;
    autoRan.current = true;
    const slotById = new Map(state.slots.map((s) => [s.id, s]));
    const elig = new Map(state.people.map((p) => [p.id, new Set(p.eligibleServices)]));
    const byBlock = new Map<string, Assignment[]>();
    for (const a of state.assignments) {
      const s = slotById.get(a.slotId);
      if (s?.grain === "block") {
        const arr = byBlock.get(s.start) ?? [];
        arr.push(a);
        byBlock.set(s.start, arr);
      }
    }
    for (const arr of byBlock.values()) {
      for (const a1 of arr)
        for (const a2 of arr) {
          const s1 = slotById.get(a1.slotId)!;
          const s2 = slotById.get(a2.slotId)!;
          if (a1.personId >= a2.personId || s1.serviceId === s2.serviceId) continue;
          if (elig.get(a1.personId)?.has(s2.serviceId) && elig.get(a2.personId)?.has(s1.serviceId)) {
            setTimeout(() => swap(a1.slotId, a2.slotId), 50);
            return;
          }
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reset when the published schedule changes underneath us
  useEffect(() => {
    setWorking(state.assignments);
    setEdited(new Set());
    setSelected(null);
    setHistory([]);
    setValidation(null);
    setPhase("idle");
  }, [state.currentVersion?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const runValidate = useCallback(
    async (assignments: Assignment[]) => {
      setValidating(true);
      try {
        const r = await fetch("/api/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            people: state.people,
            services: state.services,
            slots: state.slots,
            rules: state.rules,
            assignments,
            absences: [],
          }),
        });
        const data = await r.json();
        // only accept a well-formed validator response; a rate-limit/error body
        // has no `violations` array and must not reach the render path
        setValidation(r.ok && Array.isArray(data?.violations) ? (data as ValidateResponse) : null);
      } catch {
        setValidation(null);
      } finally {
        setValidating(false);
      }
    },
    [state]
  );

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleValidate(next: Assignment[]) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runValidate(next), 350);
  }

  function swap(slotA: string, slotB: string) {
    const a = working.find((x) => x.slotId === slotA);
    const b = working.find((x) => x.slotId === slotB);
    if (!a || !b) return;
    setHistory((h) => [...h, { assignments: working, edited: [...edited] }]);
    const next: Assignment[] = working.map((x) => {
      if (x.slotId === slotA)
        return { ...x, personId: b.personId, locked: true, provenance: "manual" as const };
      if (x.slotId === slotB)
        return { ...x, personId: a.personId, locked: true, provenance: "manual" as const };
      return x;
    });
    const nextEdited = new Set(edited);
    nextEdited.add(slotA);
    nextEdited.add(slotB);
    setWorking(next);
    setEdited(nextEdited);
    setSelected(null);
    setPhase("idle");
    scheduleValidate(next);
  }

  function onCellActivate(cell: GridCell) {
    if (!cell.slotId) return;
    if (!selected) {
      setSelected(cell.slotId);
      return;
    }
    if (selected === cell.slotId) {
      setSelected(null);
      return;
    }
    // same block column? swap. else move the selection.
    const sel = working.find((x) => x.slotId === selected);
    const selCell = state.slots.find((s) => s.id === selected);
    const tgtCell = state.slots.find((s) => s.id === cell.slotId);
    if (sel && selCell && tgtCell && selCell.start === tgtCell.start) {
      swap(selected, cell.slotId);
    } else {
      setSelected(cell.slotId);
    }
  }

  function undo() {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setWorking(prev.assignments);
      setEdited(new Set(prev.edited));
      setSelected(null);
      setPhase("idle");
      scheduleValidate(prev.assignments);
      return h.slice(0, -1);
    });
  }

  function discard() {
    setWorking(state.assignments);
    setEdited(new Set());
    setHistory([]);
    setSelected(null);
    setValidation(null);
    setPhase("idle");
  }

  async function publish() {
    setPhase("publishing");
    setError(null);
    try {
      const r = await fetch("/api/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          assignments: working.map((a) => ({
            slotId: a.slotId,
            personId: a.personId,
            locked: edited.has(a.slotId) || a.locked,
            provenance: a.provenance,
          })),
          publishedBy: "Dr. Chief Fellow",
          cause: { kind: "manual-edit" },
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error ?? "Publish blocked by validator");
      setPublishedVersion(data.version.version);
      setPhase("done");
      onPublished();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setPhase("idle");
    }
  }

  const hasEdits = edited.size > 0;
  const blocks = validation?.violations.filter((v) => v.severity === "block") ?? [];
  const warns = validation?.violations.filter((v) => v.severity === "warn") ?? [];
  const canPublish = hasEdits && blocks.length === 0 && phase !== "publishing";

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight">Block Schedule</h1>
          <p className="text-[12px] text-muted-foreground">
            {`${state.people.length} fellows · 13 four-week blocks`} · click a fellow&apos;s rotation, then
            another in the same block, to swap them. Every edit is checked live and locks in place.
          </p>
        </div>
      </div>

      <ScheduleGrid
        state={state}
        assignments={working}
        editable
        selectedSlotId={selected}
        editedSlotIds={edited}
        onCellActivate={onCellActivate}
        onCellDrop={(src, tgt) => {
          const a = state.slots.find((s) => s.id === src);
          const b = state.slots.find((s) => s.id === tgt);
          if (a && b && a.start === b.start) swap(src, tgt);
        }}
      />
      <GridLegend />

      {/* edit bar */}
      {hasEdits && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-r2 border border-border bg-surface-raised px-3 py-2.5 shadow-sm">
          <span className="text-[12.5px] font-medium tnum">{edited.size / 2 || 0} manual edit(s)</span>

          {validating ? (
            <span className="text-[11.5px] text-muted-foreground">checking…</span>
          ) : validation ? (
            blocks.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-status-block">
                <span className="h-1.5 w-1.5 rounded-full bg-status-block" />
                {blocks.length} blocking issue(s) — fix before publishing
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-status-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-status-ok" />
                validates clean{warns.length ? ` · ${warns.length} soft warning(s)` : ""}
              </span>
            )
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={undo}
              disabled={history.length === 0}
              className="rounded-r1 border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              Undo
            </button>
            <button
              onClick={discard}
              className="rounded-r1 border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              Discard
            </button>
            <button
              onClick={publish}
              disabled={!canPublish}
              className="rounded-r1 bg-accent px-3 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {phase === "publishing" ? "Validating…" : "Publish changes"}
            </button>
          </div>
        </div>
      )}

      {/* blocking issues detail */}
      {hasEdits && blocks.length > 0 && (
        <div className="rounded-r2 border border-status-block-border bg-status-block-bg/50 px-3 py-2.5">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-status-block">
            Independent validator — blocking
          </div>
          <ul className="space-y-0.5">
            {blocks.slice(0, 6).map((v, i) => (
              <li key={i} className="text-[12px] text-foreground">
                <span className="font-mono text-[10px] text-status-block">{v.acgmeCode ?? "coverage"}</span>{" "}
                {v.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-r1 border border-status-block-border bg-status-block-bg px-3 py-2 text-[12px] text-status-block">
          {error}
        </div>
      )}
      {phase === "done" && (
        <div className="rounded-r2 border border-status-ok-bg bg-status-ok-bg/50 px-3 py-2.5 text-[12px] text-status-ok">
          Published as v{publishedVersion}. Your edits are locked in and everyone affected will be notified.
        </div>
      )}
    </div>
  );
}
