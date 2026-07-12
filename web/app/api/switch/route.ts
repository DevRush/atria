import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadProgram, seedProgram, type Edition } from "@/lib/seed-program";
import { rateLimit } from "@/lib/ratelimit";
import { nowIso } from "@/lib/share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/switch — load the training or attending sample program (single-
 * tenant: replaces the current one). Both editions share the same engine. */
export async function POST(req: Request) {
  const limited = rateLimit(req, { max: 12, key: "switch" });
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const edition: Edition = body?.edition === "attending" ? "attending" : "training";
  try {
    await seedProgram(prisma, loadProgram(edition));
    await prisma.scheduleEvent.create({
      data: { actor: "coordinator", eventType: "switch", detail: { edition }, createdAt: nowIso() },
    });
    return NextResponse.json({ ok: true, edition });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Switch failed" }, { status: 500 });
  }
}
