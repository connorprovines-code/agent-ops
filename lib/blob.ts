import { put, head } from "@vercel/blob";
import { AgentsMap } from "./types";

const BLOB_KEY = "agents.json";

export async function readAgents(): Promise<AgentsMap> {
  try {
    const blob = await head(BLOB_KEY);
    // Append timestamp to downloadUrl to guarantee cache bypass
    const res = await fetch(`${blob.downloadUrl}&t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function writeAgents(agents: AgentsMap): Promise<void> {
  await put(BLOB_KEY, JSON.stringify(agents), {
    access: "public",
    addRandomSuffix: false,
    contentType: "application/json",
  });
}
