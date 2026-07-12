import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { createShareSecret, nowIso, sha256 } from "@/lib/share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function originOf(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/** GET /api/share — active (non-revoked, non-expired) share links, no secrets. */
export async function GET() {
  const rows = await prisma.shareToken.findMany({ where: { revokedAt: null }, orderBy: { createdAt: "desc" } });
  const now = nowIso();
  const active = rows.filter((r) => !r.expiresAt || r.expiresAt > now);
  return NextResponse.json({ tokens: active.map((r) => ({ id: r.id, label: r.label, createdAt: r.createdAt, expiresAt: r.expiresAt })) });
}

/**
 * POST /api/share — mint a new shareable who's-on-call link. Revokes any prior
 * active link (one live link at a time). The 256-bit secret is returned ONCE;
 * only its SHA-256 hash is stored.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, { max: 10, key: "share" });
  if (limited) return limited;
  const now = nowIso();
  await prisma.shareToken.updateMany({ where: { revokedAt: null }, data: { revokedAt: now } });
  const secret = createShareSecret();
  await prisma.shareToken.create({ data: { secretHash: sha256(secret), createdAt: now } });
  await prisma.scheduleEvent.create({
    data: { actor: "coordinator", eventType: "share.create", detail: {}, createdAt: now },
  });
  return NextResponse.json({ ok: true, link: `${originOf(req)}/p/${secret}`, secret });
}
