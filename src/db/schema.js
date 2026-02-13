export function createTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      type            TEXT NOT NULL,
      pid             INTEGER,
      hostname        TEXT NOT NULL,
      started_at      TEXT NOT NULL DEFAULT (datetime('now')),
      status          TEXT NOT NULL DEFAULT 'running'
                      CHECK(status IN ('running','idle','error','dead')),
      last_heartbeat  TEXT NOT NULL DEFAULT (datetime('now')),
      current_task    TEXT,
      sub_agent_count INTEGER DEFAULT 0,
      meta            TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    CREATE INDEX IF NOT EXISTS idx_agents_hostname ON agents(hostname);

    CREATE TABLE IF NOT EXISTS events (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id        TEXT REFERENCES agents(id),
      event_type      TEXT NOT NULL
                      CHECK(event_type IN ('registered','heartbeat','completed',
                                           'error','died','sub_agent_spawned','deregistered')),
      message         TEXT,
      meta            TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id);
  `);
}
