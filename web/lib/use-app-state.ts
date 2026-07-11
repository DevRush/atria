"use client";

import { useEffect, useState } from "react";
import type { StateResponse } from "@/lib/types";

/**
 * Client-side state hook: every workspace page renders REAL data from
 * GET /api/state — no mocks anywhere in the scaffold.
 */
export function useAppState() {
  const [state, setState] = useState<StateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/state", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET /api/state → ${res.status}`);
        return (await res.json()) as StateResponse;
      })
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { state, error, loading: state === null && error === null };
}
