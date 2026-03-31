# Agent Ops v2 — Lessons Learned

## Architecture
- **Single blob file**: One `agents.json` (not per-agent blobs) keeps read/write costs minimal and simplifies the reaper.
- **Reaper is event-driven, not cron-only**: Runs on every ping and every GET /api/agents. Vercel Cron (every 5 min) is the safety net for when no traffic exists.
- **Email batching**: One Resend email per reaper run listing ALL newly dead agents — avoids rate limits and notification spam.
- **No separate SDK package**: The `agent-ops-register` README IS the SDK. Claude Code agents read it and add a `fetch()` call. No npm install needed.

## Gotchas
- **Vercel Blob CDN cache lag**: After `put()`, the public URL may return stale data for ~60s. Add `?t=Date.now()` as cache-bust param when fetching, or use `list()` to get a fresh URL each time.
- **`addRandomSuffix: false`**: Required to keep a stable `agents.json` key — without it every `put()` creates a new file.
- **`/dev/stdin` broken on MSYS/Windows**: Don't pipe to `node -e` and read stdin — it maps to `C:\dev\stdin`. Use Python for piped JSON parsing, or write to a temp file first.
- **node -e requires project node_modules**: Run from the project dir, not from `~`.

## Corrections
- Tried to DELETE agents via API, then immediately re-read blob — stale CDN copy still had them. Had to re-delete after propagation.
- Backdating agent pings: must write directly to blob (not via /api/ping) since the ping endpoint always sets lastPing to now.
- **`downloadUrl` is also CDN-cached** — `?download=1` alone is not enough. Must append `&t=${Date.now()}` to guarantee fresh reads from Vercel serverless functions.
- **Fire-and-forget breaks on Vercel serverless** — `alertDead().catch(() => {})` is dropped when the function returns. Must `await alertDead()` before returning the response.
- **Reaper mutates agents in place** — comparing `reaped[k].status !== agents[k].status` after reaping is always false. Snapshot `prevStatuses` before calling `reap()` to detect transitions correctly.
