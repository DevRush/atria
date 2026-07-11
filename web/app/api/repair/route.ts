import { NextResponse } from "next/server";
import { solverPost, SolverHttpError, SolverUnreachableError } from "@/lib/solver";
import type { RepairResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/repair — proxy to solver POST /repair.
 * Body: RepairRequest (docs/SCHEMA.md): solve inputs + baseAssignments +
 * event + maxCandidates. Repair NEVER auto-commits (invariant 3): candidates
 * come back as proposals; a human accepts one and /api/publish creates the
 * new version.
 */
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const result = await solverPost<RepairResponse>("/repair", payload);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof SolverUnreachableError) {
      return NextResponse.json({ error: e.message }, { status: 502 });
    }
    if (e instanceof SolverHttpError) {
      return NextResponse.json(
        { error: e.message, solverBody: e.body },
        { status: 502 }
      );
    }
    throw e;
  }
}
