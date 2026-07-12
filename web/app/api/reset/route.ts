import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadProgram, seedProgram } from "@/lib/seed-program";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/reset — restore the bundled cardiology sample program, replacing the
 * current state. The recovery path for a live demo: one click undoes an import,
 * a messy edit session, or a stray publish.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, { max: 10, key: "reset" });
  if (limited) return limited;
  try {
    await seedProgram(prisma, loadProgram());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Reset failed" },
      { status: 500 }
    );
  }
}
