import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getState } from "@/lib/state";
import { rateLimit } from "@/lib/ratelimit";
import { solverPost, SolverHttpError, SolverUnreachableError } from "@/lib/solver";
import type {
  Assignment,
  PublishRequest,
  PublishResponseOk,
  ValidateRequest,
  ValidateResponse,
  Violation,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/publish — the trust gate (CLAUDE.md invariant 1).
 *
 * Every publish is re-checked by the INDEPENDENT validator (solver /validate,
 * a separate code path from CP-SAT) before anything is written:
 *   - blocking violations REFUSE the publish (422);
 *   - the ONLY bypass is a typed override waiver { by, reason } — a named
 *     human; the waiver is stored on the version row as the compliance artifact;
 *   - if the validator is unreachable the publish fails CLOSED (503) —
 *     an override cannot skip validation itself, only acknowledge its findings.
 *
 * On success: a new immutable ScheduleVersion row (invariant 5) with diff
 * metadata, superseding changed assignment rows append-only.
 */
export async function POST(req: Request) {
  const limited = rateLimit(req, { max: 20, key: "publish" });
  if (limited) return limited;
  const body = (await req.json().catch(() => null)) as PublishRequest | null;
  if (!body || !Array.isArray(body.assignments) || body.assignments.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Body must include a non-empty assignments array", violations: [] },
      { status: 400 }
    );
  }
  if (!body.publishedBy || typeof body.publishedBy !== "string") {
    return NextResponse.json(
      { ok: false, error: "publishedBy (named human) is required", violations: [] },
      { status: 400 }
    );
  }
  for (const a of body.assignments) {
    if (!a.slotId || !a.personId) {
      return NextResponse.json(
        { ok: false, error: "Every assignment needs slotId and personId", violations: [] },
        { status: 400 }
      );
    }
  }

  // Typed override: the ONLY bypass for blocking violations. Must be a named
  // human with a reason — anything less is not an override.
  const override = body.override;
  const overrideValid =
    override != null &&
    typeof override.by === "string" &&
    override.by.trim().length > 0 &&
    typeof override.reason === "string" &&
    override.reason.trim().length > 0;
  if (override != null && !overrideValid) {
    return NextResponse.json(
      {
        ok: false,
        error: "override must be a typed waiver: { by: string, reason: string }, both non-empty",
        violations: [],
      },
      { status: 400 }
    );
  }

  const state = await getState();
  const nextVersion = (state.currentVersion?.version ?? 0) + 1;

  // Candidate assignment rows (full SCHEMA.md shape) for validation.
  const candidate: Assignment[] = body.assignments.map((a, i) => ({
    id: `a_v${nextVersion}_${i + 1}`,
    slotId: a.slotId,
    personId: a.personId,
    status: "published",
    locked: a.locked ?? false,
    provenance: a.provenance ?? "manual",
    createdInVersion: nextVersion,
    supersededInVersion: null,
  }));

  // 1) Independent validation — ALWAYS, before any write.
  let validation: ValidateResponse;
  try {
    const payload: ValidateRequest = {
      people: state.people,
      services: state.services,
      slots: state.slots,
      rules: state.rules,
      assignments: candidate,
      absences: state.absences,
    };
    validation = await solverPost<ValidateResponse>("/validate", payload);
  } catch (e) {
    if (e instanceof SolverUnreachableError || e instanceof SolverHttpError) {
      // Fail CLOSED: no validation, no publish — override cannot bypass this.
      return NextResponse.json(
        {
          ok: false,
          error:
            "Publish refused: independent validator unavailable. " +
            "Schedules are never published unvalidated.",
          violations: [],
        },
        { status: 503 }
      );
    }
    throw e;
  }

  const violations: Violation[] = validation.violations ?? [];
  const blocking = violations.filter((v) => v.severity === "block");

  // 2) Blocking violations refuse the publish unless a typed waiver is present.
  if (blocking.length > 0 && !overrideValid) {
    return NextResponse.json(
      {
        ok: false,
        error: `Publish refused: ${blocking.length} blocking violation(s). A typed override waiver ({ by, reason }) by a named human is the only bypass.`,
        violations,
      },
      { status: 422 }
    );
  }

  // 3) Diff vs the current published head (slot → occupant).
  const currentBySlot = new Map(state.assignments.map((a) => [a.slotId, a]));
  const nextBySlot = new Map(candidate.map((a) => [a.slotId, a]));

  const changedSlots: Array<{ slotId: string; from: string | null; to: string | null }> = [];
  for (const [slotId, next] of nextBySlot) {
    const cur = currentBySlot.get(slotId);
    if (!cur) changedSlots.push({ slotId, from: null, to: next.personId });
    else if (cur.personId !== next.personId)
      changedSlots.push({ slotId, from: cur.personId, to: next.personId });
  }
  for (const [slotId, cur] of currentBySlot) {
    if (!nextBySlot.has(slotId)) changedSlots.push({ slotId, from: cur.personId, to: null });
  }
  const peopleTouched = new Set(
    changedSlots.flatMap((c) => [c.from, c.to]).filter((p): p is string => p != null)
  ).size;

  const diff = {
    changed: changedSlots.length,
    peopleTouched,
    violations: blocking.length,
  };

  // 4) Append-only write: supersede changed rows, insert new rows, version row.
  const publishedAt = new Date().toISOString();
  await prisma.$transaction(async (tx) => {
    for (const change of changedSlots) {
      const cur = change.from != null ? currentBySlot.get(change.slotId) : undefined;
      if (cur) {
        await tx.assignment.update({
          where: { id: cur.id },
          data: { supersededInVersion: nextVersion },
        });
      }
      const next = nextBySlot.get(change.slotId);
      if (next) await tx.assignment.create({ data: next });
    }
    await tx.scheduleVersion.create({
      data: {
        version: nextVersion,
        publishedAt,
        publishedBy: body.publishedBy,
        parent: state.currentVersion?.version ?? null,
        cause: (body.cause as object) ?? { kind: "amendment" },
        diff,
        inputHash: body.inputHash ?? null,
        seed: body.seed ?? null,
        override: overrideValid && blocking.length > 0 ? { by: override!.by, reason: override!.reason } : undefined,
        // Validation receipt — the independent validator's verdict, stored as
        // durable evidence for this version (Codex-adapted).
        validation: {
          ok: blocking.length === 0,
          blockCount: blocking.length,
          warnCount: violations.filter((v) => v.severity === "warn").length,
          validatorVersion: validation.validatorVersion ?? "unknown",
          validatedAt: publishedAt,
        },
      },
    });
    await tx.scheduleEvent.create({
      data: {
        actor: body.publishedBy,
        eventType: "publish",
        detail: { version: nextVersion, cause: body.cause ?? { kind: "amendment" }, diff } as object,
        createdAt: publishedAt,
      },
    });
  });

  const response: PublishResponseOk = {
    ok: true,
    version: {
      version: nextVersion,
      publishedAt,
      publishedBy: body.publishedBy,
      parent: state.currentVersion?.version ?? null,
      cause: body.cause ?? { kind: "amendment" },
      diff,
      inputHash: body.inputHash ?? null,
      seed: body.seed ?? null,
    },
    overriddenViolations: overrideValid ? blocking : [],
  };
  return NextResponse.json(response);
}
