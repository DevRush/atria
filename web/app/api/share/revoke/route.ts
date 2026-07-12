import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { nowIso } from "@/lib/share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/share/revoke — immediately revoke all active share links. Any link
 * already sent stops resolving on the next request. */
export async function POST() {
  const now = nowIso();
  const res = await prisma.shareToken.updateMany({ where: { revokedAt: null }, data: { revokedAt: now } });
  if (res.count > 0) {
    await prisma.scheduleEvent.create({
      data: { actor: "coordinator", eventType: "share.revoke", detail: { count: res.count }, createdAt: now },
    });
  }
  return NextResponse.json({ ok: true, revoked: res.count });
}
