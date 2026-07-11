import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { solverPost } from "@/lib/solver";
import type { ParseResult } from "@/lib/import-parse";
import type { SolveResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FAMILY: Record<string, string> = {
  CATH: "procedural", EP: "procedural", ECHO: "imaging", NUC: "imaging",
  CCU: "inpatient", CONSULT: "consult", RESEARCH: "ambulatory", CLINIC: "ambulatory",
};
const NAME: Record<string, string> = {
  CATH: "Cath Lab", ECHO: "Echo Lab", CCU: "CCU", CONSULT: "Consults",
  EP: "EP", NUC: "Nuclear Cardiology", RESEARCH: "Research",
};
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI"];

/**
 * POST /api/import/commit — turn a confirmed ParseResult into a live program.
 * Maps the imported block pattern onto the academic-year calendar, then generates
 * a call & jeopardy schedule around those (locked) blocks via the solver, and
 * publishes it as version 1. Replaces the current single-tenant program.
 */
export async function POST(req: Request) {
  const parse = (await req.json().catch(() => null)) as ParseResult | null;
  if (!parse?.people?.length || !parse.assignments?.length) {
    return NextResponse.json({ error: "Nothing to import." }, { status: 400 });
  }

  // bundled program supplies the AY calendar: block date ranges + call/jeopardy slots
  const bundled = path.join(process.cwd(), "data", "program.json");
  const sibling = path.resolve(process.cwd(), "../fixtures/fellowship.json");
  const fx = JSON.parse(fs.readFileSync(fs.existsSync(bundled) ? bundled : sibling, "utf8"));
  const fxBlocks: { index: number; start: string; end: string }[] = fx.blocks;
  const callSlots = fx.slots.filter((s: { grain: string }) => s.grain === "call-night");
  const jeopSlots = fx.slots.filter((s: { grain: string }) => s.grain === "week");

  // people (round-robin clinic days; eligible for their imported services + call/jeopardy)
  const svcByPerson = new Map<string, Set<string>>();
  for (const a of parse.assignments) {
    const set = svcByPerson.get(a.personId) ?? new Set<string>();
    set.add(a.code);
    svcByPerson.set(a.personId, set);
  }
  const people = parse.people.map((p, i) => ({
    id: p.id,
    name: p.name,
    level: p.level,
    fte: 1.0,
    eligibleServices: [...(svcByPerson.get(p.id) ?? new Set()), "CALL", "JEOP", "CLINIC"],
    clinicDay: WEEKDAYS[i % WEEKDAYS.length],
  }));

  // services: imported block rotations + standard call/jeopardy
  const codes = [...new Set(parse.assignments.map((a) => a.code))];
  const services = [
    ...codes.map((code) => ({
      id: code, name: NAME[code] ?? code, code, family: FAMILY[code] ?? "consult",
      kind: "rotation", coverage: { minPerWeekday: 0, minPerWeekendDay: 0 },
    })),
    { id: "CALL", name: "Overnight Call", code: "CALL", family: "inpatient", kind: "call",
      coverage: { minPerWeekday: 1, minPerWeekendDay: 1 } },
    { id: "JEOP", name: "Jeopardy", code: "JEOP", family: "backup", kind: "jeopardy",
      coverage: { minPerWeekday: 2, minPerWeekendDay: 2 } },
  ];

  // block slots + imported assignments (as locks so the solver keeps them)
  const blockSlots: Record<string, unknown>[] = [];
  const lockAssignments: Record<string, unknown>[] = [];
  const byBlockSvc = new Map<string, string[]>(); // "idx|code" -> [personId]
  for (const a of parse.assignments) {
    const k = `${a.blockIndex}|${a.code}`;
    const arr = byBlockSvc.get(k) ?? [];
    arr.push(a.personId);
    byBlockSvc.set(k, arr);
  }
  for (const [k, persons] of byBlockSvc) {
    const [idxStr, code] = k.split("|");
    const idx = Number(idxStr);
    const fb = fxBlocks.find((b) => b.index === idx);
    if (!fb) continue;
    persons.forEach((pid, r) => {
      const slotId = `slot_b${idx}_${code.toLowerCase()}_${r + 1}`;
      blockSlots.push({
        id: slotId, serviceId: code, start: `${fb.start}T07:00:00-04:00`,
        end: `${fb.end}T17:00:00-04:00`, grain: "block", roleIndex: r + 1,
      });
      lockAssignments.push({
        id: `a_imp_${slotId}`, slotId, personId: pid, status: "draft",
        locked: true, provenance: "import", createdInVersion: 1, supersededInVersion: null,
      });
    });
  }

  const slots = [...blockSlots, ...callSlots, ...jeopSlots];
  const rules = [
    { id: "r_rest", type: "min_rest_after_call", params: { minHours: 14 }, level: "blocking", tier: null, scope: "all", text: "≥14h rest after overnight call.", confirmed: true },
    { id: "r_clinic", type: "no_call_before_clinic", params: {}, level: "hard", tier: null, scope: "all", text: "No call the night before a fellow's clinic day.", confirmed: true },
    { id: "r_1in7", type: "one_in_seven_free", params: { averagedOverDays: 28 }, level: "blocking", tier: null, scope: "all", text: "≥1 day in 7 free (averaged over 4 weeks).", confirmed: true },
    { id: "r_space", type: "call_spacing", params: { minGapNights: 3 }, level: "soft", tier: "should", scope: "all", text: "Space call ≥3 nights apart.", confirmed: true },
    { id: "r_wknd", type: "weekend_equity", params: { maxSpread: 2 }, level: "soft", tier: "should", scope: "all", text: "Balance weekend call.", confirmed: true },
  ];
  const locks = lockAssignments.map((a) => ({ assignmentId: a.id as string, by: "import", reason: "imported block assignment", hard: true }));

  // generate call/jeopardy around the locked, imported blocks
  let solved: SolveResponse;
  try {
    solved = await solverPost<SolveResponse>("/solve", {
      people, services, slots, rules, locks, assignments: lockAssignments, absences: [],
      seed: 4711, timeBudgetSec: 60,
    });
  } catch {
    return NextResponse.json({ error: "Solver unreachable — can't build the call schedule." }, { status: 502 });
  }

  // if call generation is infeasible, still import the blocks (call left empty)
  const finalAssignments = solved.feasible
    ? solved.assignments
    : lockAssignments.map((a) => ({ id: a.id, slotId: a.slotId, personId: a.personId, provenance: "import" }));
  const inputHash = solved.feasible ? solved.inputHash : null;

  // write the new program (replace current single-tenant data)
  await prisma.$transaction(async (tx) => {
    await tx.lock.deleteMany({});
    await tx.scheduleVersion.deleteMany({});
    await tx.assignment.deleteMany({});
    await tx.absence.deleteMany({});
    await tx.rule.deleteMany({});
    await tx.slot.deleteMany({});
    await tx.service.deleteMany({});
    await tx.person.deleteMany({});

    await tx.person.createMany({ data: people.map((p) => ({ ...p, eligibleServices: p.eligibleServices as object })) });
    await tx.service.createMany({ data: services.map((s) => ({ ...s, coverage: s.coverage as object })) });
    await tx.slot.createMany({ data: slots as never });
    await tx.rule.createMany({ data: rules.map((r) => ({ ...r, params: r.params as object, replay: undefined })) });
    await tx.assignment.createMany({
      data: (finalAssignments as { id: string; slotId: string; personId: string; provenance?: string }[]).map((a) => ({
        id: a.id, slotId: a.slotId, personId: a.personId, status: "published",
        locked: false, provenance: a.provenance ?? "solver", createdInVersion: 1, supersededInVersion: null,
      })),
    });
    await tx.scheduleVersion.create({
      data: {
        version: 1, publishedAt: new Date().toISOString(), publishedBy: "import",
        parent: null, cause: { kind: "import", source: parse.programName } as object,
        diff: { changed: finalAssignments.length, peopleTouched: people.length, violations: 0 } as object,
        inputHash, seed: 4711,
      },
    });
  });

  return NextResponse.json({
    ok: true,
    program: parse.programName,
    fellows: people.length,
    callGenerated: solved.feasible,
    assignments: finalAssignments.length,
  });
}
