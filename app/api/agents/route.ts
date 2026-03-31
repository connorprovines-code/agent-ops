import { NextResponse } from "next/server";
import { readAgents, writeAgents } from "@/lib/blob";
import { reap } from "@/lib/reaper";
import { alertDead } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await readAgents();
  const { agents: reaped, newlyDead } = reap(agents);

  // Write back if any status changed, and fire alerts
  const statusChanged = Object.keys(reaped).some(
    (k) => reaped[k].status !== agents[k]?.status
  );

  if (statusChanged) {
    await writeAgents(reaped);
  }

  if (newlyDead.length > 0) {
    alertDead(newlyDead).catch(() => {});
  }

  return NextResponse.json(reaped);
}
