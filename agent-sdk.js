import { hostname } from 'os';

const DEFAULT_URL = 'http://localhost:4200';

export class AgentOps {
  #agentId = null;
  #baseUrl;
  #heartbeatInterval = null;
  #status = 'running';
  #currentTask = null;
  #subAgentCount = 0;

  constructor(baseUrl) {
    this.#baseUrl = baseUrl;
  }

  static async register({ name, type, dashboardUrl, meta } = {}) {
    const ops = new AgentOps(dashboardUrl || DEFAULT_URL);
    try {
      const res = await fetch(`${ops.#baseUrl}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'unnamed-agent',
          type: type || 'generic',
          pid: process.pid,
          hostname: hostname(),
          meta,
        }),
      });
      const data = await res.json();
      ops.#agentId = data.agent_id;
    } catch {
      // Dashboard unreachable — continue silently
    }

    ops.#heartbeatInterval = setInterval(() => ops.#sendHeartbeat(), 30_000);
    if (ops.#heartbeatInterval.unref) ops.#heartbeatInterval.unref();

    return ops;
  }

  async #sendHeartbeat() {
    if (!this.#agentId) return;
    fetch(`${this.#baseUrl}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: this.#agentId,
        status: this.#status,
        current_task: this.#currentTask,
        sub_agent_count: this.#subAgentCount,
      }),
    }).catch(() => {});
  }

  updateStatus(status, currentTask, subAgentCount) {
    if (status) this.#status = status;
    if (currentTask !== undefined) this.#currentTask = currentTask;
    if (subAgentCount !== undefined) this.#subAgentCount = subAgentCount;
  }

  async event(eventType, message, meta) {
    if (!this.#agentId) return;
    fetch(`${this.#baseUrl}/api/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: this.#agentId,
        event_type: eventType,
        message,
        meta,
      }),
    }).catch(() => {});
  }

  async shutdown() {
    if (this.#heartbeatInterval) {
      clearInterval(this.#heartbeatInterval);
      this.#heartbeatInterval = null;
    }
    if (!this.#agentId) return;
    try {
      await fetch(`${this.#baseUrl}/api/deregister`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: this.#agentId }),
      });
    } catch {
      // Dashboard unreachable — nothing to do
    }
  }

  get agentId() { return this.#agentId; }
}
