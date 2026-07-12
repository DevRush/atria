"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Flip a program rule between publish-blocking and advisory (soft). Hidden for
 * hard/ACGME rules. Reflects immediately in what the validator enforces. */
export function RuleLevelToggle({ ruleId, level }: { ruleId: string; level: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [cur, setCur] = useState(level);

  async function set(next: "blocking" | "soft") {
    if (next === cur || busy) return;
    setBusy(true);
    setCur(next);
    try {
      const r = await fetch("/api/rules", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ruleId, level: next }),
      });
      if (!r.ok) setCur(cur);
      else router.refresh();
    } catch {
      setCur(cur);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex overflow-hidden rounded-r1 border border-border text-[10.5px]">
      <button
        onClick={() => set("blocking")}
        disabled={busy}
        className={`px-1.5 py-0.5 ${cur === "blocking" ? "bg-status-warn-bg font-medium text-status-warn" : "text-faint-foreground hover:text-foreground"}`}
      >
        Blocks
      </button>
      <button
        onClick={() => set("soft")}
        disabled={busy}
        className={`border-l border-border px-1.5 py-0.5 ${cur === "soft" ? "bg-surface-raised font-medium text-foreground" : "text-faint-foreground hover:text-foreground"}`}
      >
        Advisory
      </button>
    </div>
  );
}
