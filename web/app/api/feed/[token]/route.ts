import { prisma } from "@/lib/db";
import { readCurrentProjection } from "@/lib/projection-store";
import { icsFromProjection } from "@/lib/export";
import { isValidShareSecret, nowIso, sha256 } from "@/lib/share";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/feed/[token] — a revocable, privacy-safe iCalendar feed of the current
 * published on-call schedule. Same bearer-token security as the share page (the
 * 256-bit secret is hashed at rest; revoking the link kills the feed), and it
 * serves the hash-verified public projection — never the internal schedule.
 * Subscribe in any calendar app; a revoked token returns the same 404 as unknown.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const limited = rateLimit(req, { max: 60, key: "feed" });
  if (limited) return limited;
  const { token } = await params;

  const notFound = () => new Response("Not found", { status: 404 });
  if (!isValidShareSecret(token)) return notFound();
  const row = await prisma.shareToken.findUnique({ where: { secretHash: sha256(token) } });
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt <= nowIso())) return notFound();

  const stored = await readCurrentProjection(prisma);
  if (!stored || !stored.verified) return notFound();

  return new Response(icsFromProjection(stored.projection), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="atria-oncall.ics"',
      "cache-control": "no-store",
    },
  });
}
