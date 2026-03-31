import { NextResponse } from "next/server";
import { readAgents, writeAgents } from "@/lib/blob";
import { reap } from "@/lib/reaper";
import { alertDead } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await readAgents();

  // Snapshot statuses before reaping (reap mutates in place)
  const prevStatuses = Object.fromEntries(
    Object.entries(agents).map(([k, v]) => [k, v.status])
  );

  const { agents: reaped, newlyDead } = reap(agents);

  const statusChanged = Object.keys(reaped).some(
    (k) => reaped[k].status !== prevStatuses[k]
  );

  if (statusChanged) {
    await writeAgents(reaped);
  }

  if (newlyDead.length > 0) {
    await alertDead(newlyDead);
  }

  return NextResponse.json(reaped);
}
