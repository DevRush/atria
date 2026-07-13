"use client";
import { useEffect, useState } from "react";

/** Narrated progress while the engine solves — the real solver runs a few
 * lexicographic stages server-side; we narrate believable progress client-side
 * (bar creeps toward ~94% and holds until the result resolves). */
const STAGES = [
  "Reading your rules & roster…",
  "Placing rotations across the year…",
  "Honoring every duty-hour limit…",
  "Balancing call & workload…",
];

export function SolveProgress() {
  const [i, setI] = useState(0);
  const [pct, setPct] = useState(8);
  useEffect(() => {
    const t1 = setInterval(() => setI((x) => Math.min(x + 1, STAGES.length - 1)), 420);
    const t2 = setInterval(() => setPct((p) => Math.min(p + (p < 80 ? 8 : 2), 94)), 140);
    return () => {
      clearInterval(t1);
      clearInterval(t2);
    };
  }, []);
  return (
    <div className="bp-rise-in w-full max-w-[440px]">
      <div className="mb-1 flex items-center justify-between text-[11.5px]">
        <span className="text-foreground">{STAGES[i]}</span>
        <span className="font-mono text-faint-foreground tnum">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface">
        <div
          className="bp-progress-bar h-full rounded-full bg-accent transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
