import ExcelJS from "exceljs";
import { rateLimit } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/import/template — a blank .xlsx laid out exactly the way the importer
 * reads it (program name in A1, a Level + Fellow header, B1..B13 block columns),
 * with two example rows and a code legend. Round-trips cleanly through the parser. */
export async function GET(req: Request) {
  const limited = rateLimit(req, { max: 20, key: "import-template" });
  if (limited) return limited;

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Block Schedule");
  ws.getCell("A1").value = "Your Program — Cardiology Fellowship Block Schedule";

  const blocks = Array.from({ length: 13 }, (_, i) => `B${i + 1}`);
  ws.getRow(3).values = ["Level", "Fellow", ...blocks];

  const examples: (string)[][] = [
    ["PGY-4", "Jordan Rivera", "CATH", "ECHO", "CCU", "CONSULT", "EP", "RESEARCH", "CATH", "ECHO", "CCU", "CONSULT", "EP", "RESEARCH"],
    ["PGY-5", "Sam Okafor", "ECHO", "CCU", "CATH", "EP", "CONSULT", "CATH", "RESEARCH", "ECHO", "CCU", "CATH", "EP", "CONSULT"],
  ];
  examples.forEach((row, i) => (ws.getRow(4 + i).values = row));

  ws.getCell("A7").value =
    "Codes: CATH, ECHO, CCU, CONSULT, EP, NUC, RESEARCH. One column per 4-week block (B1…B13). The Level column is optional; blank cells are flagged, not dropped.";
  ws.getColumn(2).width = 20;

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="atria-import-template.xlsx"',
      "cache-control": "no-store",
    },
  });
}
