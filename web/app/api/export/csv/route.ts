import { getState } from "@/lib/state";
import { rateLimit } from "@/lib/ratelimit";
import { toCsv } from "@/lib/export";

export const dynamic = "force-dynamic";

/** GET /api/export/csv — the published schedule as a spreadsheet-safe CSV. */
export async function GET(req: Request) {
  const limited = rateLimit(req, { max: 20, key: "export-csv" });
  if (limited) return limited;
  const csv = toCsv(await getState());
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="atria-schedule.csv"',
      "cache-control": "no-store",
    },
  });
}
