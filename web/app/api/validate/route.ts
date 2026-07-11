import { NextResponse } from "next/server";
import { solverPost, SolverHttpError, SolverUnreachableError } from "@/lib/solver";
import type { ValidateResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/validate — proxy to the independent validator (solver /validate).
 * Used for live feedback while a coordinator hand-edits the grid: violations are
 * shown but never block an edit (they block publish, which is a separate call).
 */
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  try {
    const result = await solverPost<ValidateResponse>("/validate", payload);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof SolverUnreachableError) return NextResponse.json({ error: e.message }, { status: 502 });
    if (e instanceof SolverHttpError) return NextResponse.json({ error: e.message, solverBody: e.body }, { status: 502 });
    throw e;
  }
}
