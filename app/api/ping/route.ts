import { NextResponse } from "next/server";
import { readAgents, writeAgents } from "@/lib/blob";
import { reap } from "@/lib/reaper";
import { alertDead } from "@/lib/alerts";
import { checkAuth } from "@/lib/auth";
import { VALID_SCHEDULES, Schedule } from "@/lib/types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name as string;
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const schedule = (body.schedule as Schedule) || "manual";
  if (!VALID_SCHEDULES.includes(schedule)) {
    return NextResponse.json({ error: `Invalid schedule. Use: ${VALID_SCHEDULES.join(", ")}` }, { status: 400 });
  }

  const key = slugify(name);
  const now = new Date().toISOString();
  const agents = await readAgents();

  const existing = agents[key];
  agents[key] = {
    name,
    project: (body.project as string) || existing?.project || "",
    schedule,
    lastPing: now,
    status: "healthy",
    message: (body.message as string) || undefined,
    registeredAt: existing?.registeredAt || now,
    meta: (body.meta as Record<string, unknown>) || undefined,
  };

  const { agents: reaped, newlyDead } = reap(agents);

  // Fire alerts without blocking the response
  if (newlyDead.length > 0) {
    alertDead(newlyDead).catch(() => {});
  }

  await writeAgents(reaped);

  return NextResponse.json({ ok: true, key, agent: reaped[key] });
}
