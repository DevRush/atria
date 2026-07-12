"use client";
import { useEffect, useState } from "react";

/** Shows the current program and switches between the trainee and attending
 * sample editions (both run on the same engine). Single-tenant: switching
 * replaces the loaded program. */
export function EditionSwitcher() {
  const [edition, setEdition] = useState<"training" | "attending" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/state", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEdition(d.people?.some((p: { level: string }) => p.level === "Attending") ? "attending" : "training"))
      .catch(() => {});
  }, []);

  async function switchTo(next: "training" | "attending") {
    if (busy || next === edition) return;
    setBusy(true);
    try {
      await fetch("/api/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ edition: next }),
      });
      window.location.href = "/";
    } catch {
      setBusy(false);
    }
  }

  if (!edition) return null;
  const label = edition === "attending" ? "Cardiology Division" : "Cardiology Fellowship";

  return (
    <div className="hidden items-center gap-2 sm:flex">
      <span className="text-[12px] text-muted-foreground">{label} · AY 2026–27</span>
      <div className="inline-flex overflow-hidden rounded-r1 border border-border text-[10.5px]">
        <button
          onClick={() => switchTo("training")}
          disabled={busy}
          className={`px-1.5 py-0.5 ${edition === "training" ? "bg-surface-raised font-medium text-foreground" : "text-faint-foreground hover:text-foreground"}`}
          title="Trainee edition"
        >
          Trainee
        </button>
        <button
          onClick={() => switchTo("attending")}
          disabled={busy}
          className={`border-l border-border px-1.5 py-0.5 ${edition === "attending" ? "bg-surface-raised font-medium text-foreground" : "text-faint-foreground hover:text-foreground"}`}
          title="Attending edition"
        >
          Attending
        </button>
      </div>
    </div>
  );
}
