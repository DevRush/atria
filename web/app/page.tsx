import { AppShell } from "@/components/AppShell";
import { getState } from "@/lib/state";
import { ProgramBuilder } from "@/components/ProgramBuilder";
import { CallBuilder } from "@/components/CallBuilder";

export const dynamic = "force-dynamic";

/** The landing page IS the schedule maker — a judge/coordinator opens directly
 * onto "make a schedule." Trainees build the academic-year rotation schedule;
 * attending groups build a month of call. Both run the same engine. */
export default async function Home() {
  const state = await getState();
  const isAttending = state.people.some((p) => p.level === "Attending");
  return (
    <AppShell version={state.currentVersion} active="build">
      {isAttending ? <CallBuilder base={state} /> : <ProgramBuilder base={state} />}
    </AppShell>
  );
}
