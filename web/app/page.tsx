"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EditableSchedule } from "@/components/EditableSchedule";
import { RepairFlow } from "@/components/RepairFlow";
import type { StateResponse } from "@/lib/types";

export default function Home() {
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
        else await new Promise((res) => setTimeout(res, 1200)); // waking container? retry
      }
    }
  }
  useEffect(() => {
    load();
  }, []);

  if (err)
    return (
      <Center>
        <div className="text-center">
          <div className="mb-2">Couldn&apos;t reach the schedule.</div>
          <button onClick={() => load()} className="rounded-r1 bg-accent px-3 py-1.5 text-[12px] font-medium text-white">
            Retry
          </button>
        </div>
      </Center>
    );
  if (!state) return <Center>Loading schedule…</Center>;

  return (
    <AppShell version={state.currentVersion} active="schedule">
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-4">
        <EditableSchedule state={state} onPublished={() => load()} />
        <RepairFlow state={state} onPublished={() => load()} />
      </div>
    </AppShell>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[60vh] place-items-center text-[13px] text-muted-foreground">
      {children}
    </div>
  );
}
