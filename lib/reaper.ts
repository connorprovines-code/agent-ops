import { AgentsMap, AgentEntry, THRESHOLDS } from "./types";

export function reap(agents: AgentsMap): { agents: AgentsMap; newlyDead: AgentEntry[] } {
  const now = Date.now();
  const newlyDead: AgentEntry[] = [];

  for (const agent of Object.values(agents)) {
    if (agent.schedule === "manual") {
      agent.status = "healthy";
      continue;
    }

    const elapsed = now - new Date(agent.lastPing).getTime();
    const thresholds = THRESHOLDS[agent.schedule];
    const prevStatus = agent.status;

    if (elapsed > thresholds.dead) {
      agent.status = "dead";
    } else if (elapsed > thresholds.late) {
      agent.status = "late";
    } else {
      agent.status = "healthy";
    }

    if (agent.status === "dead" && prevStatus !== "dead") {
      newlyDead.push(agent);
    }
  }

  return { agents, newlyDead };
}
