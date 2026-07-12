/**
 * Freeze/read the public projection. At publish (and at seed) we materialize the
 * allowlisted projection into its own row, keyed by version, with a content hash.
 * The public share route reads THIS frozen artifact and re-verifies the hash, so
 * the reader is looking at exactly what was published — and any post-hoc edit to
 * the stored payload is detectable. Adapted from Codex's content-hashed projection.
 */
import type { StateResponse } from "@/lib/types";
import {
  buildPublicProjection,
  verifyStoredProjection,
  type PublicProjection,
} from "@/lib/projection";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Build the projection for the current published state and upsert it by version. */
export async function storeProjection(prisma: any, state: StateResponse): Promise<PublicProjection> {
  const proj = buildPublicProjection(state);
  const version = proj.version ?? 1;
  const createdAt = proj.publishedAt ?? new Date().toISOString();
  const data = { payload: proj as object, contentHash: proj.contentHash, createdAt };
  await prisma.publicProjection.upsert({
    where: { version },
    update: data,
    create: { version, ...data },
  });
  return proj;
}

/** Read the current (highest-version) frozen projection and verify its hash. */
export async function readCurrentProjection(
  prisma: any
): Promise<{ projection: PublicProjection; verified: boolean } | null> {
  const row = await prisma.publicProjection.findFirst({ orderBy: { version: "desc" } });
  if (!row) return null;
  const projection = row.payload as PublicProjection;
  return { projection, verified: verifyStoredProjection(projection) };
}
