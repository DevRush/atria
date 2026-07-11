import { NextResponse } from "next/server";
import { solverPost, SolverHttpError, SolverUnreachableError } from "@/lib/solver";
import type { SolveResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/solve — proxy to solver POST /solve (generate).
 * Body: SolveRequest (docs/SCHEMA.md). The result is a DRAFT proposal;
 * nothing is written to the schedule here — publish is a separate call.
 */
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const result = await solverPost<SolveResponse>("/solve", payload);
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
