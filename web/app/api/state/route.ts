import { NextResponse } from "next/server";
import { getState } from "@/lib/state";

export const dynamic = "force-dynamic";

/** GET /api/state — people, services, slots, rules, current published assignments. */
export async function GET() {
  const state = await getState();
  return NextResponse.json(state);
}
