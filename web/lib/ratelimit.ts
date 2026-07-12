import { NextResponse } from "next/server";

/**
 * Tiny in-memory per-IP sliding-window limiter for the public, CPU-heavy API
 * routes (solve/repair/validate/import). Keeps a runaway or abusive client from
 * driving up Railway compute. Single-replica in-memory is fine for a demo; swap
 * for Redis if scaled out.
 */
const buckets = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Returns a 429 NextResponse if over the limit, else null (proceed). */
export function rateLimit(
  req: Request,
  { max = 12, windowMs = 60_000, key = "" }: { max?: number; windowMs?: number; key?: string } = {}
): NextResponse | null {
  const id = `${key}:${clientIp(req)}`;
  const now = Date.now();
  const hits = (buckets.get(id) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    return NextResponse.json(
      { error: "Too many requests — please slow down and try again in a moment." },
      { status: 429, headers: { "retry-after": String(Math.ceil(windowMs / 1000)) } }
    );
  }
  hits.push(now);
  buckets.set(id, hits);
  // opportunistic cleanup so the map can't grow unbounded
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return null;
}
