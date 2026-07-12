import { createHash } from "node:crypto";
import type { StateResponse } from "@/lib/types";
import { deriveBlocks } from "@/lib/view";

/**
 * The public who's-on-call projection (adapted from Codex's Atria). Built from
 * the published schedule with a STRICT allowlist: only program name, dates,
 * service/role labels, and (abbreviated) display names ever leave the building.
 * Everything sensitive — person IDs, emails, FTE, eligibility, rules, fairness,
 * absence reasons, locks, audit actors — is excluded by construction. Trainee
 * names are abbreviated to "A. Okafor" so a public link never exposes a full
 * roster identity.
 */

export type PublicCall = { date: string; weekday: string; person: string };
export type PublicJeopardy = { start: string; end: string; person: string };
export type PublicBlockRow = { person: string; cells: (string | null)[] };

export type PublicProjection = {
  schemaVersion: 1;
  programDisplayName: string;
  scheduleTitle: string;
  timezone: string;
  version: number | null;
  publishedAt: string | null;
  effectiveStart: string;
  effectiveEnd: string;
  call: PublicCall[];
  jeopardy: PublicJeopardy[];
  blockLabels: string[];
  blocks: PublicBlockRow[];
  contentHash: string;
};

function abbreviate(name: string): string {
  const clean = name.replace(/,?\s*(MD|DO|MBBS)\.?$/i, "").trim();
  const parts = clean.split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.at(-1)}` : clean;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The single source of truth for how a projection body is hashed. Used at build
 * time and at verify-on-read time so a stored projection is tamper-evident. */
export function hashProjectionBody(body: Omit<PublicProjection, "contentHash">): string {
  return "sha256:" + createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 32);
}

/** Re-derive the hash from a stored projection's body and compare it to the
 * stored contentHash. A mismatch means the payload was altered after publish. */
export function verifyStoredProjection(payload: PublicProjection): boolean {
  const { contentHash, ...body } = payload;
  return !!contentHash && hashProjectionBody(body) === contentHash;
}

export function buildPublicProjection(state: StateResponse): PublicProjection {
  const slotById = new Map(state.slots.map((s) => [s.id, s]));
  const nameById = new Map(state.people.map((p) => [p.id, abbreviate(p.name)]));
  const svcById = new Map(state.services.map((s) => [s.id, s]));

  const call: PublicCall[] = [];
  const jeopardy: PublicJeopardy[] = [];
  for (const a of state.assignments) {
    const s = slotById.get(a.slotId);
    if (!s) continue;
    const person = nameById.get(a.personId) ?? "—";
    if (s.grain === "call-night") {
      const d = s.start.slice(0, 10);
      call.push({ date: d, weekday: WD[new Date(d + "T12:00:00Z").getUTCDay()], person });
    } else if (s.grain === "week") {
      jeopardy.push({ start: s.start.slice(0, 10), end: s.end.slice(0, 10), person });
    }
  }
  call.sort((a, b) => a.date.localeCompare(b.date));
  jeopardy.sort((a, b) => a.start.localeCompare(b.start));

  // block rotation grid (person × block → service code), names abbreviated
  const blocks = deriveBlocks(state.slots);
  const cellOf = new Map<string, string>();
  for (const a of state.assignments) {
    const s = slotById.get(a.slotId);
    if (!s || s.grain !== "block") continue;
    const b = blocks.find((x) => x.start === s.start.slice(0, 10));
    if (b) cellOf.set(`${a.personId}|${b.start}`, svcById.get(s.serviceId)?.code ?? s.serviceId);
  }
  const rows: PublicBlockRow[] = state.people.map((p) => ({
    person: nameById.get(p.id) ?? "—",
    cells: blocks.map((b) => cellOf.get(`${p.id}|${b.start}`) ?? null),
  }));

  const allDates = [...call.map((c) => c.date), ...jeopardy.map((j) => j.start)].sort();
  const body = {
    schemaVersion: 1 as const,
    programDisplayName: "Cardiology Fellowship",
    scheduleTitle: "Cardiology Fellowship · Call & Rotations",
    timezone: "America/New_York",
    version: state.currentVersion?.version ?? null,
    publishedAt: state.currentVersion?.publishedAt ?? null,
    effectiveStart: allDates[0] ?? "",
    effectiveEnd: allDates.at(-1) ?? "",
    call,
    jeopardy,
    blockLabels: blocks.map((b) => b.label),
    blocks: rows,
  };
  return { ...body, contentHash: hashProjectionBody(body) };
}
