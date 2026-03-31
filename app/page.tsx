"use client";

import { useEffect, useState } from "react";

interface AgentEntry {
  name: string;
  project: string;
  host?: string;
  schedule: string;
  lastPing: string;
  status: "healthy" | "late" | "dead";
  message?: string;
  registeredAt: string;
}

type AgentsMap = Record<string, AgentEntry>;

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function groupByProject(agents: AgentsMap): Record<string, [string, AgentEntry][]> {
  const groups: Record<string, [string, AgentEntry][]> = {};
  for (const [key, agent] of Object.entries(agents)) {
    const project = agent.project || "Ungrouped";
    if (!groups[project]) groups[project] = [];
    groups[project].push([key, agent]);
  }
  // Sort groups: alphabetical, but "Ungrouped" last
  const sorted: Record<string, [string, AgentEntry][]> = {};
  const keys = Object.keys(groups).sort((a, b) => {
    if (a === "Ungrouped") return 1;
    if (b === "Ungrouped") return -1;
    return a.localeCompare(b);
  });
  for (const k of keys) sorted[k] = groups[k];
  return sorted;
}

const STATUS_COLORS = {
  healthy: "bg-green-500",
  late: "bg-yellow-500",
  dead: "bg-red-500",
};

const SCHEDULE_LABELS: Record<string, string> = {
  "always-on": "Always On",
  "every-1h": "Every 1h",
  "every-6h": "Every 6h",
  "every-24h": "Every 24h",
  manual: "Manual",
};

export default function Dashboard() {
  const [agents, setAgents] = useState<AgentsMap>({});
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  async function fetchAgents() {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      if (res.ok) {
        setAgents(await res.json());
        setLastFetch(new Date());
      }
    } catch {
      // silently retry on next interval
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  const entries = Object.entries(agents);
  const counts = {
    healthy: entries.filter(([, a]) => a.status === "healthy").length,
    late: entries.filter(([, a]) => a.status === "late").length,
    dead: entries.filter(([, a]) => a.status === "dead").length,
  };

  const grouped = groupByProject(agents);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500 text-lg">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Ops</h1>
          <p className="text-gray-500 text-sm mt-1">
            {entries.length} agent{entries.length !== 1 ? "s" : ""} registered
            {lastFetch && (
              <span> · updated {timeAgo(lastFetch.toISOString())}</span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <StatusBadge count={counts.healthy} status="healthy" />
          <StatusBadge count={counts.late} status="late" />
          <StatusBadge count={counts.dead} status="dead" />
        </div>
      </div>

      {/* Empty State */}
      {entries.length === 0 && (
        <div className="border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">No agents registered yet.</p>
          <p className="text-gray-600 text-sm font-mono">
            curl -X POST {typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}/api/ping \<br />
            &nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \<br />
            &nbsp;&nbsp;-d &apos;{`{"name":"my-agent","schedule":"every-6h"}`}&apos;
          </p>
        </div>
      )}

      {/* Agent Groups */}
      {Object.entries(grouped).map(([project, projectAgents]) => (
        <div key={project} className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {project}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projectAgents.map(([key, agent]) => (
              <AgentCard key={key} agentKey={key} agent={agent} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ count, status }: { count: number; status: "healthy" | "late" | "dead" }) {
  const colors = {
    healthy: "text-green-400 bg-green-500/10 border-green-500/20",
    late: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    dead: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status]}`}>
      {count} {status}
    </span>
  );
}

function AgentCard({ agentKey, agent }: { agentKey: string; agent: AgentEntry }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[agent.status]} ${
              agent.status === "healthy" ? "animate-pulse-dot" : ""
            }`}
          />
          <span className="font-medium text-sm truncate" title={agent.name}>
            {agent.name}
          </span>
        </div>
        <span className="text-xs text-gray-500 font-mono whitespace-nowrap ml-2">
          {SCHEDULE_LABELS[agent.schedule] || agent.schedule}
        </span>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        {agent.host && (
          <div className="flex justify-between">
            <span>Host</span>
            <span className="font-mono text-gray-400">{agent.host}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Last ping</span>
          <span className="font-mono">{timeAgo(agent.lastPing)}</span>
        </div>
        {agent.message && (
          <div className="text-gray-400 truncate" title={agent.message}>
            {agent.message}
          </div>
        )}
      </div>
    </div>
  );
}
