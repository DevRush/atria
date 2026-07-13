import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getState } from "@/lib/state";
import { storeProjection } from "@/lib/projection-store";
import { rateLimit } from "@/lib/ratelimit";
import type { Assignment, Person, Rule, Service, Slot } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  people: Person[];
  services: Service[];
  slots: Slot[];
  rules: Rule[];
  holidays?: { date: string; name: string }[];
  assignments: { slotId: string; personId: string }[];
  publishedBy?: string;
};

/** POST /api/build/commit — persist a freshly generated program as the live,
 * published schedule (replaces the current single-tenant program). This is the
 * "Publish" of the Build flow. */
export async function POST(req: Request) {
  const limited = rateLimit(req, { max: 12, key: "build-commit" });
  if (limited) return limited;

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.people?.length || !body.slots?.length || !body.assignments?.length) {
    return NextResponse.json({ error: "Incomplete program." }, { status: 400 });
  }
  if (body.people.length > 400 || body.slots.length > 8000) {
    return NextResponse.json({ error: "Program too large for this demo." }, { status: 413 });
  }

  const validSlotIds = new Set(body.slots.map((s) => s.id));
  const validPersonIds = new Set(body.people.map((p) => p.id));
  const assignments = body.assignments.filter(
    (a) => validSlotIds.has(a.slotId) && validPersonIds.has(a.personId)
  );
  const publishedAt = new Date().toISOString();

  await prisma.$transaction(async (tx) => {
    await tx.lock.deleteMany({});
    await tx.scheduleVersion.deleteMany({});
    await tx.publicProjection.deleteMany({});
    await tx.assignment.deleteMany({});
    await tx.absence.deleteMany({});
    await tx.rule.deleteMany({});
    await tx.slot.deleteMany({});
    await tx.service.deleteMany({});
    await tx.person.deleteMany({});
    await tx.holiday.deleteMany({});

    await tx.person.createMany({
      data: body.people.map((p) => ({
        id: p.id, name: p.name, level: p.level, fte: p.fte ?? 1,
        eligibleServices: p.eligibleServices as object, clinicDay: p.clinicDay ?? null,
      })),
    });
    await tx.service.createMany({
      data: body.services.map((s) => ({
        id: s.id, name: s.name, code: s.code, family: s.family, kind: s.kind, coverage: s.coverage as object,
      })),
    });
    await tx.slot.createMany({ data: body.slots as never });
    await tx.rule.createMany({
      data: body.rules.map((r) => ({
        id: r.id, type: r.type, params: r.params as object, level: r.level, tier: r.tier ?? null,
        scope: r.scope, source: r.source ?? null, text: r.text, confirmed: r.confirmed, replay: undefined,
      })),
    });
    if (body.holidays?.length)
      await tx.holiday.createMany({ data: body.holidays.map((h) => ({ date: h.date, name: h.name })) });
    await tx.assignment.createMany({
      data: assignments.map((a, i) => ({
        id: `a_${i}`, slotId: a.slotId, personId: a.personId, status: "published",
        locked: false, provenance: "solver", createdInVersion: 1, supersededInVersion: null,
      })) as never,
    });
    await tx.scheduleVersion.create({
      data: {
        version: 1, publishedAt, publishedBy: body.publishedBy || "Chief Fellow", parent: null,
        cause: { kind: "generate" } as object,
        diff: { changed: assignments.length, peopleTouched: body.people.length, violations: 0 } as object,
        inputHash: null, seed: 4711,
      },
    });
  });

  try {
    await storeProjection(prisma, await getState());
    await prisma.scheduleEvent.create({
      data: {
        actor: body.publishedBy || "Chief Fellow", eventType: "build",
        detail: { people: body.people.length, assignments: assignments.length } as object,
        createdAt: publishedAt,
      },
    });
  } catch (e) {
    console.error("post-build projection/event failed", e);
  }

  return NextResponse.json({ ok: true, people: body.people.length, assignments: assignments.length });
}
