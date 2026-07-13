import { AppShell } from "@/components/AppShell";
import { getState } from "@/lib/state";
import { ProgramBuilder } from "@/components/ProgramBuilder";

export const dynamic = "force-dynamic";

/** The schedule maker — the front door. Edit the roster + coverage, press
 * Generate, watch the engine build a complete, valid, fair schedule, then publish. */
export default async function BuildPage() {
  const state = await getState();
  return (
    <AppShell version={state.currentVersion} active="build">
      <ProgramBuilder base={state} />
    </AppShell>
  );
}
