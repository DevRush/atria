import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/requests/decide — a coordinator approves or denies a pending request.
 * Approval only flips the absence to approved; if it vacates a shift, the caller
 * runs /api/repair then /api/publish to restore coverage (that flow gates on the
 * independent validator). Denial is terminal.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.absenceId || !["approve", "deny"].includes(body?.decision)) {
    return NextResponse.json({ error: "absenceId and decision (approve|deny) required" }, { status: 400 });
  }
  const absence = await prisma.absence.findUnique({ where: { id: body.absenceId } });
  if (!absence) return NextResponse.json({ error: "Unknown request" }, { status: 404 });
  if (absence.status !== "pending") {
    return NextResponse.json({ error: `Request already ${absence.status}` }, { status: 409 });
  }
  const updated = await prisma.absence.update({
    where: { id: body.absenceId },
    data: { status: body.decision === "approve" ? "approved" : "denied" },
  });
  return NextResponse.json({ ok: true, absence: updated });
}
