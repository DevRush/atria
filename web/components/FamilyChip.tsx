import type { ServiceFamily } from "@/lib/types";

/**
 * Family-hue chip. The text SHORT-CODE is the identity carrier; hue is
 * reinforcement only (SPEC §6 — color never sole carrier). Class strings are
 * static literals so Tailwind can see them.
 */
const FAMILY_CLASSES: Record<ServiceFamily, string> = {
  procedural:
    "text-family-procedural bg-family-procedural-bg border-family-procedural-border",
  imaging: "text-family-imaging bg-family-imaging-bg border-family-imaging-border",
  inpatient:
    "text-family-inpatient bg-family-inpatient-bg border-family-inpatient-border",
  consult: "text-family-consult bg-family-consult-bg border-family-consult-border",
  ambulatory:
    "text-family-ambulatory bg-family-ambulatory-bg border-family-ambulatory-border",
  backup: "text-family-backup bg-family-backup-bg border-family-backup-border",
};

export function FamilyChip({
  code,
  family,
  locked = false,
  title,
}: {
  code: string;
  family: ServiceFamily;
  locked?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title ?? (locked ? `${code} (locked)` : code)}
      className={`inline-flex h-[18px] items-center rounded-r1 border px-1.5 font-mono text-[11px] font-medium leading-none tracking-wide ${
        FAMILY_CLASSES[family] ?? FAMILY_CLASSES.backup
      } ${locked ? "border-l-2" : ""}`}
    >
      {code}
    </span>
  );
}
