import { NextResponse } from "next/server";
import { parseScheduleWorkbook } from "@/lib/import-parse";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB — a real fellowship workbook is well under this

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
    const f = file as File;
    if (f.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `That file is ${(f.size / 1048576).toFixed(1)} MB — the import limit is 4 MB.` },
        { status: 413 }
      );
    }
    if (f.name && !/\.(xlsx|xlsm)$/i.test(f.name)) {
      return NextResponse.json(
        { error: "Upload an Excel .xlsx workbook (that's the format this importer reads)." },
        { status: 415 }
      );
    }
    const buf = await f.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "That file is over the 4 MB import limit." }, { status: 413 });
    }
    const result = await parseScheduleWorkbook(buf);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not parse the spreadsheet." },
      { status: 400 }
    );
  }
}
