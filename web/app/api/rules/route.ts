import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";
import { nowIso } from "@/lib/share";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * PATCH /api/rules — change whether a program rule blocks publication or is
 * advisory (configurable rule hardness, adapted from Codex). Only "blocking" ↔
 * "soft" is allowed: solver-hard structural rules and the hard-coded ACGME
 * checks are never editable here. The validator reads rule levels from the DB,
 * so the change takes effect on the next validate/publish.
 */
export async function PATCH(req: Request) {
  const limited = rateLimit(req, { max: 30, key: "rules" });
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  if (!body?.ruleId || !["blocking", "soft"].includes(body?.level)) {
    return NextResponse.json({ error: "ruleId and level (blocking|soft) required" }, { status: 400 });
  }
  const rule = await prisma.rule.findUnique({ where: { id: body.ruleId } });
  if (!rule) return NextResponse.json({ error: "Unknown rule" }, { status: 404 });
  if (rule.level === "hard") {
    return NextResponse.json({ error: "Structural/ACGME rules can't be softened here." }, { status: 409 });
  }
  const tier = body.level === "soft" ? (rule.tier ?? "should") : null;
  await prisma.rule.update({ where: { id: body.ruleId }, data: { level: body.level, tier } });
  await prisma.scheduleEvent.create({
    data: { actor: "coordinator", eventType: "rule.level", detail: { ruleId: body.ruleId, level: body.level }, createdAt: nowIso() },
  });
  return NextResponse.json({ ok: true });
}
