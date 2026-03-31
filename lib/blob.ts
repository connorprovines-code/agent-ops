import { put, list } from "@vercel/blob";
import { AgentsMap } from "./types";

const BLOB_KEY = "agents.json";

export async function readAgents(): Promise<AgentsMap> {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY });
    if (blobs.length === 0) return {};
    const res = await fetch(blobs[0].url, { cache: "no-store" });
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
