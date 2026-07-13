import Link from "next/link";
import type { ScheduleVersion } from "@/lib/types";
import { ResetButton } from "./ResetButton";
import { EditionSwitcher } from "./EditionSwitcher";
import { ExportMenu } from "./ExportMenu";

export function VersionBadge({ version }: { version: ScheduleVersion | null }) {
  if (!version)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-r1 border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-faint-foreground" />
        no published schedule
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-r1 border border-status-ok-bg bg-status-ok-bg px-2 py-0.5 text-[11px] font-medium text-status-ok tnum">
      <span className="h-1.5 w-1.5 rounded-full bg-status-ok" />
      v{version.version} · published
    </span>
  );
}

export function AppShell({
  version,
  active,
  children,
}: {
  version: ScheduleVersion | null;
  active: "build" | "schedule" | "requests" | "rules" | "fairness" | "oncall" | "history" | "import";
  children: React.ReactNode;
}) {
  const nav = [
    { key: "build", label: "Build", href: "/" },
    { key: "schedule", label: "Schedule", href: "/schedule" },
    { key: "requests", label: "Requests", href: "/requests" },
    { key: "rules", label: "Rules", href: "/rules" },
    { key: "fairness", label: "Fairness", href: "/fairness" },
    { key: "oncall", label: "On-Call", href: "/oncall" },
    { key: "history", label: "History", href: "/history" },
    { key: "import", label: "Import", href: "/import" },
  ] as const;

  return (
    <div className="flex min-h-full">
      {/* ── sidebar operations console ── */}
      <aside className="sticky top-0 z-20 flex h-screen w-[212px] shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <Link href="/" className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
          <AtriaMark />
          <span>
            <span
              className="block text-[19px] font-semibold leading-none tracking-[0.16em]"
              style={{ fontFamily: "var(--font-cinzel), Georgia, serif" }}
            >
              ATRIA
            </span>
            <span className="mt-1 block text-[8.5px] uppercase tracking-[0.2em] text-sidebar-muted">
              Physician Scheduling
            </span>
          </span>
        </Link>

        <nav className="flex-1 space-y-0.5 px-2.5 py-3">
          {nav.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className={`flex items-center rounded-md px-3 py-[7px] text-[13px] transition-colors ${
                active === n.key
                  ? "bg-sidebar-foreground font-medium text-sidebar"
                  : "text-sidebar-muted hover:bg-sidebar-raised hover:text-sidebar-foreground"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border px-4 py-3">
          <div className="text-[11px] font-medium">Northstar Cardiology</div>
          <div className="text-[9.5px] uppercase tracking-[0.14em] text-sidebar-muted">Academic Division</div>
        </div>
      </aside>

      {/* ── main column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-3 border-b border-border bg-surface/85 px-5 backdrop-blur">
          <VersionBadge version={version} />
          <div className="ml-auto flex items-center gap-3">
            <EditionSwitcher />
            <ExportMenu />
            <ResetButton />
          </div>
        </header>
        <main key={active} className="bp-fade-in flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

/** The schedule-grid mark — a 3×3 lattice, in cream on the forest sidebar. */
function AtriaMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="23" height="23" rx="4" stroke="currentColor" strokeWidth="1.4" opacity="0.9" />
      {[6, 11.5, 17].map((y) =>
        [6, 11.5, 17].map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="3" height="3" rx="0.6" fill="currentColor" />)
      )}
    </svg>
  );
}
