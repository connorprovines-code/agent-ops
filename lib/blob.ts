import { put, head } from "@vercel/blob";
import { AgentsMap } from "./types";

const BLOB_KEY = "agents.json";

export async function readAgents(): Promise<AgentsMap> {
  try {
    // Use head() to get the blob URL, then fetch with cache bypass
    const blob = await head(BLOB_KEY);
    const res = await fetch(blob.url + `?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    // Blob doesn't exist yet
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
