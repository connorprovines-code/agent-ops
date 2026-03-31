import { NextResponse } from "next/server";
import { readAgents, writeAgents } from "@/lib/blob";
import { checkAuth } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: { name: string } }
) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await readAgents();
  const key = params.name;

  if (!agents[key]) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  delete agents[key];
  await writeAgents(agents);

  return NextResponse.json({ ok: true, deleted: key });
}
