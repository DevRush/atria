import { NextResponse } from "next/server";
import { parseScheduleWorkbook } from "@/lib/import-parse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/import/parse — multipart upload of an .xlsx schedule; returns a
 * confirmable ParseResult. Nothing is written until /api/import/commit. */
export async function POST(req: Request) {
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
