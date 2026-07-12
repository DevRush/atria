import { getState } from "@/lib/state";
import { rateLimit } from "@/lib/ratelimit";
import { toIcs } from "@/lib/export";

export const dynamic = "force-dynamic";

/** GET /api/export/ics[?person=<id>] — the schedule as an iCalendar feed. */
export async function GET(req: Request) {
  const limited = rateLimit(req, { max: 20, key: "export-ics" });
  if (limited) return limited;
  const personId = new URL(req.url).searchParams.get("person") ?? undefined;
  const ics = toIcs(await getState(), personId ? { personId } : undefined);
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="atria-schedule.ics"',
      "cache-control": "no-store",
    },
  });
}
