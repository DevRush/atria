import { AppShell } from "@/components/AppShell";
import { getState } from "@/lib/state";
import { ProgramBuilder } from "@/components/ProgramBuilder";
import { CallBuilder } from "@/components/CallBuilder";

export const dynamic = "force-dynamic";

/** Alias of the landing maker, kept so any old /build links still work. */
export default async function BuildPage() {
  const state = await getState();
  const isAttending = state.people.some((p) => p.level === "Attending");
  return (
    <AppShell version={state.currentVersion} active="build">
      {isAttending ? <CallBuilder base={state} /> : <ProgramBuilder base={state} />}
    </AppShell>
  );
}
