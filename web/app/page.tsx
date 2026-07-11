"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EditableSchedule } from "@/components/EditableSchedule";
import { RepairFlow } from "@/components/RepairFlow";
import type { StateResponse } from "@/lib/types";

export default function Home() {
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

  if (err) return <Center>Failed to load: {err}</Center>;
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
