import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/requests — a fellow submits a time-off request. It enters the queue
 * as a PENDING absence (SPEC §5: requested-unapproved absences are inputs, not
 * yet facts). A coordinator approves it via /api/requests/decide, which is when
 * it becomes a scheduling fact and (if it hits a shift) triggers repair.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.personId || !body?.start || !body?.end) {
    return NextResponse.json({ error: "personId, start, end are required" }, { status: 400 });
  }
  const person = await prisma.person.findUnique({ where: { id: body.personId } });
  if (!person) return NextResponse.json({ error: "Unknown person" }, { status: 400 });
  if (body.end < body.start) {
    return NextResponse.json({ error: "end must be on or after start" }, { status: 400 });
  }

  const id = `req_${Date.now().toString(36)}`;
  const absence = await prisma.absence.create({
    data: {
      id,
      personId: body.personId,
      start: body.start.slice(0, 10),
      end: body.end.slice(0, 10),
      type: body.type ?? "vacation",
      reasonCode: body.reasonCode ?? "",
      status: "pending",
    },
  });
  return NextResponse.json({ ok: true, absence });
}
