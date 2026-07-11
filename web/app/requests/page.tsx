"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequestsView } from "@/components/RequestsView";
import type { StateResponse } from "@/lib/types";

export default function RequestsPage() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/state", { cache: "no-store" });
      setState(await r.json());
    } catch (e) {
      setErr(String(e));
    }
  }
  useEffect(() => {
    load();
  }, []);

  if (err)
    return (
      <div className="grid min-h-[60vh] place-items-center text-[13px] text-muted-foreground">
        Failed to load: {err}
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
