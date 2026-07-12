import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getState } from "@/lib/state";
import { buildPublicProjection } from "@/lib/projection";
import { readCurrentProjection } from "@/lib/projection-store";
import { isValidShareSecret, nowIso, sha256 } from "@/lib/share";
import { PublicSchedule } from "./public-schedule";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public link — never index, never leak the referrer.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
  title: "Shared schedule",
};

async function tokenValid(token: string): Promise<boolean> {
  if (!isValidShareSecret(token)) return false;
  const row = await prisma.shareToken.findUnique({ where: { secretHash: sha256(token) } });
  if (!row || row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt <= nowIso()) return false;
  return true;
}

export default async function PublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Every failure mode returns the SAME generic page, so a probe can't tell an
  // unknown token from a revoked or expired one.
  if (!(await tokenValid(token))) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <div className="text-[15px] font-semibold">This link isn&apos;t available.</div>
          <p className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            The schedule link you followed is invalid, expired, or has been turned off. Ask the program
            coordinator for a current link.
          </p>
        </div>
      </div>
    );
  }

  // Read the FROZEN, hash-verified projection for the current published version.
  // Fall back to a live build only if no frozen artifact exists yet (legacy data).
  const stored = await readCurrentProjection(prisma);
  if (stored && !stored.verified) {
    // The stored payload no longer matches its content hash — do not render it.
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <div className="text-[15px] font-semibold">This link isn&apos;t available.</div>
          <p className="mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            The published schedule could not be verified. Ask the program coordinator for a current link.
          </p>
        </div>
      </div>
    );
  }
  const projection = stored?.projection ?? buildPublicProjection(await getState());
  return <PublicSchedule p={projection} />;
}
