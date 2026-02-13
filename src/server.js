import express from 'express';
import { getDb, closeDb } from './db/index.js';
import { CONFIG } from './utils/config.js';

const app = express();
app.use(express.json());

// ─── API Endpoints ───────────────────────────────────────────────────────────

app.post('/api/register', (req, res) => {
  const { name, type, pid, hostname, meta } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type required' });

  const db = getDb();
  const agent_id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const host = hostname || 'unknown';

  db.prepare(`
    INSERT INTO agents (id, name, type, pid, hostname, meta)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(agent_id, name, type, pid || null, host, meta ? JSON.stringify(meta) : null);

  db.prepare(`
    INSERT INTO events (agent_id, event_type, message)
    VALUES (?, 'registered', ?)
  `).run(agent_id, `${name} (${type}) registered from ${host}`);

  res.json({ agent_id });
});

app.post('/api/heartbeat', (req, res) => {
  const { agent_id, status, current_task, sub_agent_count } = req.body;
  if (!agent_id) return res.status(400).json({ error: 'agent_id required' });

  const db = getDb();
  const result = db.prepare(`
    UPDATE agents
    SET last_heartbeat = datetime('now'),
        status = COALESCE(?, status),
        current_task = ?,
        sub_agent_count = COALESCE(?, sub_agent_count)
    WHERE id = ? AND status != 'dead'
  `).run(status || null, current_task ?? null, sub_agent_count ?? null, agent_id);

  if (result.changes === 0) return res.status(404).json({ error: 'agent not found or already dead' });
  res.json({ ok: true });
});

app.post('/api/event', (req, res) => {
  const { agent_id, event_type, message, meta } = req.body;
  if (!event_type) return res.status(400).json({ error: 'event_type required' });

  const db = getDb();
  db.prepare(`
    INSERT INTO events (agent_id, event_type, message, meta)
    VALUES (?, ?, ?, ?)
  `).run(agent_id || null, event_type, message || null, meta ? JSON.stringify(meta) : null);

  res.json({ ok: true });
});

app.post('/api/deregister', (req, res) => {
  const { agent_id } = req.body;
  if (!agent_id) return res.status(400).json({ error: 'agent_id required' });

  const db = getDb();
  db.prepare(`UPDATE agents SET status = 'dead' WHERE id = ?`).run(agent_id);
  db.prepare(`
    INSERT INTO events (agent_id, event_type, message)
    VALUES (?, 'deregistered', 'Agent cleanly shut down')
  `).run(agent_id);

  res.json({ ok: true });
});

app.get('/api/agents', (req, res) => {
  const db = getDb();
  const agents = db.prepare(`
    SELECT *,
      CAST((julianday('now') - julianday(started_at)) * 86400 AS INTEGER) as uptime_seconds,
      CAST((julianday('now') - julianday(last_heartbeat)) * 86400 AS INTEGER) as seconds_since_heartbeat
    FROM agents
    ORDER BY hostname, started_at DESC
  `).all();
  res.json(agents);
});

app.get('/api/events', (req, res) => {
  const db = getDb();
  const events = db.prepare(`
    SELECT e.*, a.name as agent_name, a.hostname
    FROM events e
    LEFT JOIN agents a ON a.id = e.agent_id
    ORDER BY e.created_at DESC
    LIMIT 100
  `).all();
  res.json(events);
});

app.get('/api/stats', (req, res) => {
  const db = getDb();
  const totals = db.prepare(`
    SELECT status, COUNT(*) as count FROM agents GROUP BY status
  `).all();
  const byHost = db.prepare(`
    SELECT hostname, status, COUNT(*) as count
    FROM agents GROUP BY hostname, status ORDER BY hostname
  `).all();
  res.json({ totals, byHost });
});

// ─── Background Reaper ──────────────────────────────────────────────────────

function startReaper() {
  setInterval(() => {
    const db = getDb();
    const threshold = CONFIG.deadThresholdMs / 1000;
    const stale = db.prepare(`
      SELECT id, name, hostname FROM agents
      WHERE status != 'dead'
        AND (julianday('now') - julianday(last_heartbeat)) * 86400 > ?
    `).all(threshold);

    for (const agent of stale) {
      db.prepare(`UPDATE agents SET status = 'dead' WHERE id = ?`).run(agent.id);
      db.prepare(`
        INSERT INTO events (agent_id, event_type, message)
        VALUES (?, 'died', ?)
      `).run(agent.id, `${agent.name} on ${agent.hostname} missed heartbeat`);
    }

    if (stale.length > 0) {
      console.log(`[Reaper] Marked ${stale.length} agent(s) as dead`);
    }
  }, CONFIG.reaperIntervalMs);
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Operations</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes pulse-ring { 0%,100%{opacity:1} 50%{opacity:.4} }
    .status-pulse { animation: pulse-ring 1.5s ease-in-out infinite; }
  </style>
</head>
<body class="bg-gray-50 text-gray-900 min-h-screen">

  <!-- Header -->
  <div class="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Agent Operations</h1>
        <p class="text-gray-500 text-sm mt-0.5">Real-time agent monitoring</p>
      </div>
      <div id="header-stats" class="flex gap-3 text-sm"></div>
    </div>
  </div>

  <div class="max-w-7xl mx-auto px-6 py-8 space-y-10">

    <!-- Machine Cards -->
    <section>
      <h2 class="text-xl font-bold text-gray-900 mb-4">Machines</h2>
      <div id="machine-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div class="text-gray-400 text-sm">No agents registered yet</div>
      </div>
    </section>

    <!-- Agent List -->
    <section>
      <h2 class="text-xl font-bold text-gray-900 mb-4">Agents</h2>
      <div id="agent-list" class="space-y-2">
        <div class="text-gray-400 text-sm">No agents registered yet</div>
      </div>
    </section>

    <!-- Event Feed -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-900">Event Feed</h2>
        <span id="event-count" class="text-gray-400 text-sm"></span>
      </div>
      <div id="event-feed" class="bg-white border border-gray-200 rounded-xl shadow-sm max-h-96 overflow-y-auto divide-y divide-gray-100">
        <div class="p-4 text-gray-400 text-sm">No events yet</div>
      </div>
    </section>

  </div>

  <script>
    const STATUS_COLORS = {
      running: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500' },
      idle:    { bg: 'bg-blue-100',  text: 'text-blue-700',  dot: 'bg-blue-500' },
      error:   { bg: 'bg-yellow-100',text: 'text-yellow-700',dot: 'bg-yellow-500' },
      dead:    { bg: 'bg-red-100',   text: 'text-red-700',   dot: 'bg-red-500' },
    };

    const EVENT_COLORS = {
      registered:      { bg: 'bg-green-100',  text: 'text-green-700' },
      completed:       { bg: 'bg-blue-100',   text: 'text-blue-700' },
      error:           { bg: 'bg-yellow-100',  text: 'text-yellow-700' },
      died:            { bg: 'bg-red-100',     text: 'text-red-700' },
      deregistered:    { bg: 'bg-gray-100',    text: 'text-gray-600' },
      sub_agent_spawned:{ bg: 'bg-purple-100', text: 'text-purple-700' },
      heartbeat:       { bg: 'bg-gray-100',    text: 'text-gray-500' },
    };

    function formatUptime(seconds) {
      if (seconds < 0) seconds = 0;
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      if (d > 0) return d + 'd ' + h + 'h';
      if (h > 0) return h + 'h ' + m + 'm';
      if (m > 0) return m + 'm';
      return seconds + 's';
    }

    function timeAgo(iso) {
      const diff = (Date.now() - new Date(iso + 'Z').getTime()) / 1000;
      if (diff < 60) return 'just now';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    }

    function statusBadge(status, pulse) {
      const c = STATUS_COLORS[status] || STATUS_COLORS.dead;
      const pulseClass = pulse && status === 'running' ? 'status-pulse' : '';
      return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ' + c.bg + ' ' + c.text + '">' +
        '<span class="w-1.5 h-1.5 rounded-full ' + c.dot + ' ' + pulseClass + '"></span>' +
        status + '</span>';
    }

    function eventBadge(type) {
      const c = EVENT_COLORS[type] || { bg: 'bg-gray-100', text: 'text-gray-600' };
      return '<span class="px-2 py-0.5 rounded-full text-xs font-medium ' + c.bg + ' ' + c.text + '">' + type + '</span>';
    }

    // ─── Loaders ─────────────────────────────────────────────────

    async function loadStats() {
      try {
        const res = await fetch('/api/stats');
        const { totals } = await res.json();
        const el = document.getElementById('header-stats');
        const order = ['running', 'idle', 'error', 'dead'];
        const map = {};
        totals.forEach(t => map[t.status] = t.count);
        el.innerHTML = order.map(s => {
          const count = map[s] || 0;
          const c = STATUS_COLORS[s];
          return '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full ' + c.bg + ' ' + c.text + ' font-medium">' +
            '<span class="w-2 h-2 rounded-full ' + c.dot + '"></span>' +
            count + ' ' + s + '</span>';
        }).join('');
      } catch {}
    }

    async function loadAgents() {
      try {
        const res = await fetch('/api/agents');
        const agents = await res.json();

        // Group by hostname
        const byHost = {};
        agents.forEach(a => {
          if (!byHost[a.hostname]) byHost[a.hostname] = [];
          byHost[a.hostname].push(a);
        });

        const hosts = Object.keys(byHost);

        // Machine cards
        const machineGrid = document.getElementById('machine-grid');
        if (hosts.length === 0) {
          machineGrid.innerHTML = '<div class="text-gray-400 text-sm">No agents registered yet</div>';
        } else {
          machineGrid.innerHTML = hosts.map(host => {
            const list = byHost[host];
            const counts = { running: 0, idle: 0, error: 0, dead: 0 };
            let lastActivity = '';
            list.forEach(a => {
              counts[a.status] = (counts[a.status] || 0) + 1;
              if (!lastActivity || a.last_heartbeat > lastActivity) lastActivity = a.last_heartbeat;
            });
            return '<div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5">' +
              '<div class="flex items-center justify-between mb-3">' +
                '<h3 class="font-semibold text-gray-800">' + host + '</h3>' +
                '<span class="text-xs text-gray-400">' + list.length + ' agent' + (list.length !== 1 ? 's' : '') + '</span>' +
              '</div>' +
              '<div class="flex gap-2 mb-3">' +
                Object.entries(counts).filter(([,v]) => v > 0).map(([s, v]) => {
                  const c = STATUS_COLORS[s];
                  return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ' + c.bg + ' ' + c.text + '">' + v + ' ' + s + '</span>';
                }).join('') +
              '</div>' +
              '<div class="text-xs text-gray-400">Last activity: ' + timeAgo(lastActivity) + '</div>' +
            '</div>';
          }).join('');
        }

        // Agent list
        const agentList = document.getElementById('agent-list');
        if (agents.length === 0) {
          agentList.innerHTML = '<div class="text-gray-400 text-sm">No agents registered yet</div>';
        } else {
          agentList.innerHTML = hosts.map(host => {
            const list = byHost[host];
            return '<div class="mb-4">' +
              '<h3 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">' + host + '</h3>' +
              '<div class="space-y-2">' +
                list.map(a => {
                  const subBadge = a.sub_agent_count > 0
                    ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">' + a.sub_agent_count + ' sub-agents</span>'
                    : '';
                  return '<div class="bg-white rounded-lg border border-gray-200 shadow-sm px-4 py-3 flex items-center justify-between">' +
                    '<div class="flex items-center gap-3">' +
                      statusBadge(a.status, true) +
                      '<div>' +
                        '<span class="font-medium text-gray-900">' + a.name + '</span>' +
                        '<span class="text-gray-400 text-xs ml-2">' + a.type + '</span>' +
                      '</div>' +
                      subBadge +
                    '</div>' +
                    '<div class="flex items-center gap-4 text-sm">' +
                      (a.current_task ? '<span class="text-gray-500 max-w-xs truncate" title="' + a.current_task.replace(/"/g, '&quot;') + '">' + a.current_task + '</span>' : '') +
                      '<span class="text-gray-400 text-xs whitespace-nowrap">up ' + formatUptime(a.uptime_seconds) + '</span>' +
                      '<span class="text-gray-300 text-xs whitespace-nowrap">pid ' + (a.pid || '?') + '</span>' +
                    '</div>' +
                  '</div>';
                }).join('') +
              '</div>' +
            '</div>';
          }).join('');
        }
      } catch {}
    }

    async function loadEvents() {
      try {
        const res = await fetch('/api/events');
        const events = await res.json();
        const el = document.getElementById('event-feed');
        const countEl = document.getElementById('event-count');
        countEl.textContent = events.length + ' events';
        if (events.length === 0) {
          el.innerHTML = '<div class="p-4 text-gray-400 text-sm">No events yet</div>';
          return;
        }
        el.innerHTML = events.map(e => {
          return '<div class="px-4 py-2.5 flex items-center justify-between text-sm">' +
            '<div class="flex items-center gap-3">' +
              eventBadge(e.event_type) +
              '<span class="text-gray-700">' + (e.message || '') + '</span>' +
              (e.agent_name ? '<span class="text-gray-400 text-xs">' + e.agent_name + '</span>' : '') +
            '</div>' +
            '<span class="text-gray-400 text-xs whitespace-nowrap">' + timeAgo(e.created_at) + '</span>' +
          '</div>';
        }).join('');
      } catch {}
    }

    function loadAll() {
      loadStats();
      loadAgents();
      loadEvents();
    }

    loadAll();
    setInterval(loadAll, 10000);
  </script>

</body>
</html>`;
  res.send(html);
});

// ─── Server Startup ──────────────────────────────────────────────────────────

app.listen(CONFIG.port, () => {
  console.log('\\n  Agent Ops Dashboard running at http://localhost:' + CONFIG.port + '\\n');
  startReaper();
});

process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
