export type Schedule = "always-on" | "every-1h" | "every-6h" | "every-24h" | "manual";
export type AgentStatus = "healthy" | "late" | "dead";

export interface AgentEntry {
  name: string;
  project: string;
  host?: string;
  schedule: Schedule;
  lastPing: string;
  status: AgentStatus;
  message?: string;
  registeredAt: string;
  meta?: Record<string, unknown>;
}

export type AgentsMap = Record<string, AgentEntry>;

// Thresholds in milliseconds
export const THRESHOLDS: Record<Exclude<Schedule, "manual">, { late: number; dead: number }> = {
  "always-on": { late: 10 * 60_000, dead: 30 * 60_000 },
  "every-1h": { late: 90 * 60_000, dead: 180 * 60_000 },
  "every-6h": { late: 7 * 3_600_000, dead: 13 * 3_600_000 },
  "every-24h": { late: 25 * 3_600_000, dead: 49 * 3_600_000 },
};

export const VALID_SCHEDULES: Schedule[] = ["always-on", "every-1h", "every-6h", "every-24h", "manual"];
