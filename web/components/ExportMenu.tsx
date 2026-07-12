"use client";

/** Header export affordance — CSV (spreadsheet) and ICS (calendar) downloads of
 * the current published schedule. Native <details> so it needs no client state. */
export function ExportMenu() {
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        Export
        <svg width="9" height="9" viewBox="0 0 10 10" className="opacity-60 transition-transform group-open:rotate-180" fill="currentColor">
          <path d="M1 3l4 4 4-4" stroke="currentColor" strokeWidth="1.4" fill="none" />
        </svg>
      </summary>
      <div className="absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-r2 border border-border bg-surface-raised py-1 shadow-lg">
        <a
          href="/api/export/csv"
          download
          className="flex items-center justify-between px-3 py-1.5 text-[12px] text-foreground hover:bg-surface"
        >
          Spreadsheet (CSV)
          <span className="font-mono text-[10px] text-faint-foreground">.csv</span>
        </a>
        <a
          href="/api/export/ics"
          download
          className="flex items-center justify-between px-3 py-1.5 text-[12px] text-foreground hover:bg-surface"
        >
          Calendar (iCalendar)
          <span className="font-mono text-[10px] text-faint-foreground">.ics</span>
        </a>
        <a
          href="/print"
          target="_blank"
          rel="noopener"
          className="flex items-center justify-between px-3 py-1.5 text-[12px] text-foreground hover:bg-surface"
        >
          Print / offline roster
          <span className="font-mono text-[10px] text-faint-foreground">↗</span>
        </a>
        <p className="border-t border-border px-3 pb-1 pt-1.5 text-[10px] text-faint-foreground">
          Current published version · CSV is spreadsheet-safe.
        </p>
      </div>
    </details>
  );
}
