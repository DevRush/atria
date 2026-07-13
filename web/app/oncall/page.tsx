import { AppShell } from "@/components/AppShell";
import { ShareLinkManager } from "@/components/ShareLinkManager";
import { MonthCalendar } from "@/components/MonthCalendar";
import { getState } from "@/lib/state";

export const dynamic = "force-dynamic";

/**
 * Who's-on-call — the read path, as a real month calendar. Weekends shaded,
 * holidays flagged, each physician a stable color, coverage + hours on every day.
 * Reads the published head directly and reflects repairs the instant they publish.
 */
export default async function OnCallPage() {
  const state = await getState();
  const isAttending = state.people.some((p) => p.level === "Attending");

  return (
    <AppShell version={state.currentVersion} active="oncall">
      <div className="mx-auto max-w-[1000px] px-4 py-6">
        <div className="mb-1 text-[12px] uppercase tracking-wide text-faint-foreground">On-call calendar</div>
        <h1 className="text-[20px] font-semibold tracking-tight">
          {isAttending ? "Cardiology Division" : "Cardiology Fellowship"} · in-house call
        </h1>
        <p className="mb-4 text-[12px] text-muted-foreground">
          Every night covered · updates the instant a repair publishes · safe to share read-only.
        </p>

        <MonthCalendar state={state} />

        <div className="mt-6">
          <ShareLinkManager />
        </div>

        <p className="mt-5 text-center text-[11px] text-faint-foreground">
          Static read path · no login · {state.currentVersion ? `source v${state.currentVersion.version}` : "unpublished"}
        </p>
      </div>
    </AppShell>
  );
}
