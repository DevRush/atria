"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ImportView } from "@/components/ImportView";
import type { StateResponse } from "@/lib/types";

export default function ImportPage() {
  const [state, setState] = useState<StateResponse | null>(null);
  useEffect(() => {
    fetch("/api/state", { cache: "no-store" })
      .then((r) => r.json())
      .then(setState)
      .catch(() => {});
  }, []);
  return (
    <AppShell version={state?.currentVersion ?? null} active="import">
      <ImportView />
    </AppShell>
  );
}
