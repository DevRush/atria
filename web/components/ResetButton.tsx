"use client";
import { useState } from "react";

/** Restore the bundled sample program. The live-demo recovery hatch. */
export function ResetButton() {
  const [busy, setBusy] = useState(false);
  async function reset() {
    if (busy) return;
    if (!confirm("Restore the cardiology sample program? This replaces the current schedule.")) return;
    setBusy(true);
    try {
      await fetch("/api/reset", { method: "POST" });
      window.location.href = "/";
    } catch {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={reset}
      disabled={busy}
      title="Restore the sample cardiology program"
      className="text-[12px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
    >
      {busy ? "Resetting…" : "Reset"}
    </button>
  );
}
