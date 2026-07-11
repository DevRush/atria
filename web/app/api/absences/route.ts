import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Absence, AbsenceStatus, AbsenceType, CreateAbsenceRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

const ABSENCE_TYPES: AbsenceType[] = ["vacation", "sick", "leave", "away", "conference"];
const ABSENCE_STATUSES: AbsenceStatus[] = ["pending", "approved", "denied"];
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** GET /api/absences — all absences. */
export async function GET() {
  const rows = await prisma.absence.findMany({ orderBy: { start: "asc" } });
  return NextResponse.json(rows);
}

/**
 * POST /api/absences — create an absence (the demo's "fellow calls out sick").
 * Reasons are opaque codes only — free text is rejected shape-wise by the
 * contract (invariant 8: no PHI).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CreateAbsenceRequest | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { personId, start, end } = body;
  if (!personId || !start || !end) {
    return NextResponse.json(
      { error: "personId, start and end are required" },
      { status: 400 }
    );
  }
  if (!YMD.test(start) || !YMD.test(end)) {
    return NextResponse.json(
      { error: "start and end must be dates: YYYY-MM-DD" },
      { status: 400 }
    );
  }
  if (end < start) {
    return NextResponse.json({ error: "end must be on or after start" }, { status: 400 });
  }
  if (!ABSENCE_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `type must be one of: ${ABSENCE_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  const status: AbsenceStatus = body.status ?? "pending";
  if (!ABSENCE_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${ABSENCE_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person) {
    return NextResponse.json({ error: `Unknown personId: ${personId}` }, { status: 404 });
  }

  // Next id: max numeric suffix + 1 (count-based ids collide after deletes).
  const existing = await prisma.absence.findMany({ select: { id: true } });
  const maxN = existing.reduce((m, { id }) => {
    const n = Number(id.replace(/^abs_/, ""));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  const absence: Absence = {
    id: `abs_${maxN + 1}`,
    personId,
    start,
    end,
    type: body.type,
    reasonCode: body.reasonCode ?? "OPAQUE-00",
    status,
  };
  const created = await prisma.absence.create({ data: absence });
  return NextResponse.json(created, { status: 201 });
}
