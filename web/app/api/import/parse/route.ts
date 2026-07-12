import { NextResponse } from "next/server";
import { parseScheduleWorkbook } from "@/lib/import-parse";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/import/parse — multipart upload of an .xlsx schedule; returns a
 * confirmable ParseResult. Nothing is written until /api/import/commit. */
export async function POST(req: Request) {
  const limited = rateLimit(req, { max: 10, key: "import-parse" });
  if (limited) return limited;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Attach a spreadsheet as 'file'." }, { status: 400 });
    }
    const result = await parseScheduleWorkbook(await (file as File).arrayBuffer());
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not parse the spreadsheet." },
      { status: 400 }
    );
  }
}
