# Agent Ops

Lightweight agent/cron monitoring dashboard. Agents send heartbeat pings via HTTP POST. The dashboard shows what's alive, what's late, and what's dead. Email alerts via Resend when something dies.

**Live dashboard**: `https://agent-ops.vercel.app` (replace with your URL after deploy)

---

## Quick Start

Send a ping from anything:

```bash
curl -X POST https://agent-ops.vercel.app/api/ping \
  -H "Content-Type: application/json" \
  -d '{"name": "my-cron-job", "schedule": "every-24h", "project": "my-project"}'
```

That's it. The agent is now registered and monitored.

---

## Integration Examples

### Node.js

```javascript
// Ping on startup and periodically for always-on agents
const AGENT_OPS_URL = "https://agent-ops.vercel.app/api/ping";

async function ping(message) {
  await fetch(AGENT_OPS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "my-agent",
      project: "my-project",
      schedule: "always-on",
      message,
    }),
  }).catch(() => {}); // Don't let monitoring failures break your agent
}

// Ping on start
await ping("Agent started");

// Ping every 5 minutes for always-on agents
setInterval(() => ping("Still running"), 5 * 60 * 1000);
```

### Python

```python
import requests

def ping(message=""):
    try:
        requests.post("https://agent-ops.vercel.app/api/ping", json={
            "name": "my-python-script",
            "project": "my-project",
            "schedule": "every-6h",
            "message": message,
        }, timeout=5)
    except:
        pass  # Don't let monitoring failures break your script

ping("Script started")
# ... do work ...
ping("Completed successfully")
```

### Bash / Cron

```bash
# Add to the end of your cron script
curl -s -X POST https://agent-ops.vercel.app/api/ping \
  -H "Content-Type: application/json" \
  -d '{"name": "nightly-backup", "schedule": "every-24h", "project": "infra"}'
```

---

## API Reference

### POST /api/ping

Register or update an agent heartbeat.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Agent name (used as unique key, slugified) |
| `project` | string | No | Group agents by project on the dashboard |
| `schedule` | string | No | Expected ping frequency (default: `manual`) |
| `message` | string | No | Status message shown on dashboard |
| `meta` | object | No | Arbitrary metadata |

**Response**: `{ "ok": true, "key": "my-agent", "agent": { ... } }`

### GET /api/agents

Returns all registered agents as a JSON map. Also runs the reaper to update statuses.

### DELETE /api/agents/:key

Remove an agent from monitoring. The `:key` is the slugified agent name.

### GET /api/health

Simple health check. Returns `{ "status": "ok" }`.

---

## Schedule Types

| Schedule | Description | Late After | Dead After |
|----------|-------------|-----------|------------|
| `always-on` | Long-running agents | 10 min | 30 min |
| `every-1h` | Hourly jobs | 1.5 hours | 3 hours |
| `every-6h` | Quarter-daily jobs | 7 hours | 13 hours |
| `every-24h` | Daily jobs | 25 hours | 49 hours |
| `manual` | One-off scripts | Never | Never |

---

## For Claude Code Agents

When integrating monitoring into a project, add the following:

1. **For always-on agents** (servers, long-running processes):
   - Add a `ping()` call at startup
   - Add a `setInterval` that pings every 5 minutes
   - Set schedule to `"always-on"`

2. **For cron/scheduled jobs**:
   - Add a ping at the end of the script (after work completes)
   - Set schedule to match the frequency (`"every-1h"`, `"every-6h"`, `"every-24h"`)

3. **For one-off scripts**:
   - Add a ping at the end
   - Set schedule to `"manual"` (no alerting)

**Always wrap the ping in a try/catch** — monitoring should never break the agent it's monitoring.

Use the project directory name as `project` and a descriptive name for `name`.

---

## Authentication

If `API_SECRET` is set in the environment, all POST and DELETE requests must include:

```
Authorization: Bearer YOUR_SECRET
```

GET requests (dashboard, agents list) are always public.

---

## Self-Hosting

```bash
git clone https://github.com/YOUR_USER/agent-ops.git
cd agent-ops
npm install
```

### Environment Variables

Set these in Vercel (Settings → Environment Variables):

| Variable | Required | Description |
|----------|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | Yes | Auto-provisioned when Vercel Blob is enabled |
| `RESEND_API_KEY` | No | Resend API key for email alerts |
| `ALERT_EMAIL` | No | Email address for dead agent alerts |
| `API_SECRET` | No | Shared secret for ping authentication |

### Deploy

```bash
vercel deploy --prod
```

Or connect the GitHub repo to Vercel for automatic deploys on push.
