"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequestsView } from "@/components/RequestsView";
import type { StateResponse } from "@/lib/types";

export default function RequestsPage() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load(retries = 4) {
    setErr(null);
    for (let i = 0; i <= retries; i++) {
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setState(await r.json());
        return;
      } catch (e) {
        if (i === retries) setErr(String(e instanceof Error ? e.message : e));
        else await new Promise((res) => setTimeout(res, 1200));
      }
    }
  }
  useEffect(() => {
    load();
  }, []);

  if (err)
    return (
      <div className="grid min-h-[60vh] place-items-center text-[13px] text-muted-foreground">
        <div className="text-center">
          <div className="mb-2">Couldn&apos;t reach the server.</div>
          <button onClick={() => load()} className="rounded-r1 bg-accent px-3 py-1.5 text-[12px] font-medium text-white">
            Retry
          </button>
        </div>
      </div>
    );
  if (!state)
    return (
      <div className="grid min-h-[60vh] place-items-center text-[13px] text-muted-foreground">
        Loading…
      </div>
    );

  return (
    <AppShell version={state.currentVersion} active="requests">
      <RequestsView state={state} reload={load} />
    </AppShell>
  );
}
