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
    { key: "build", label: "Build", href: "/build" },
    { key: "schedule", label: "Schedule", href: "/" },
    { key: "requests", label: "Requests", href: "/requests" },
    { key: "rules", label: "Rules", href: "/rules" },
    { key: "fairness", label: "Fairness", href: "/fairness" },
    { key: "oncall", label: "On-Call", href: "/oncall" },
    { key: "history", label: "History", href: "/history" },
  ] as const;
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 flex h-11 items-center gap-4 border-b border-border bg-surface/90 px-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <AtriaMark />
          <span className="text-[14px] font-semibold tracking-tight">Atria</span>
        </Link>
        <nav className="flex items-center gap-0.5">
          {nav.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className={`rounded-r1 px-2.5 py-1 text-[12.5px] transition-colors ${
                active === n.key
                  ? "bg-surface-raised font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/import"
            className={`text-[12px] transition-colors ${
              active === "import" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Import
          </Link>
          <ExportMenu />
          <ResetButton />
          <EditionSwitcher />
          <VersionBadge version={version} />
        </div>
      </header>
      <main key={active} className="bp-fade-in flex-1">{children}</main>
    </div>
  );
}

function AtriaMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <rect x="1" y="1" width="16" height="16" rx="3" fill="var(--family-inpatient-bg)" stroke="var(--family-inpatient-border)" />
      <path d="M9 4.2 12.4 13H10.9L9 7.6 7.1 13H5.6L9 4.2Z" fill="var(--family-inpatient)" />
    </svg>
  );
}
