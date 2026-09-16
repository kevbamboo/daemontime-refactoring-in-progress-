# Daemontime

React/TypeScript client, authenticated Socket.IO server, and Supabase authentication.
Gameplay questions, timing rules, submissions, and scoring remain scaffolds. Starting a game records its status but deliberately does not advance the gameplay UI.

## Development

Use Node.js 24 or newer for the project tooling. Game persistence uses your existing Supabase PostgreSQL database.

1. Run `npm ci --prefix server` and `npm ci --prefix client`.
2. Copy `server/.env.example` to `server/.env` and fill in the Supabase server credentials.
3. Copy `client/.env.example` to `client/.env` and fill in the Supabase URL and publishable key. Never put a server secret in a `VITE_` variable.
4. Use the existing `currentGames` table. For a new project only, `server/db/migrations/001_create_games.sql` creates it. Use a Supabase secret/service-role key in `SUPABASE_SECRET_KEY`.
5. Run `npm run dev --prefix server` and `npm run dev --prefix client` in separate terminals.

Vite proxies `/socket.io` and `/api` to port 3000. In production, proxy those paths to the Node server on the same origin, or set `VITE_SOCKET_URL` to the server origin and `FRONTEND_URL` to the client origin. Configure the static host to serve `index.html` for client routes such as `/games`.

## State and connections

- Supabase owns authentication; the legacy `/api/auth/signup` endpoint returns HTTP 410.
- Account IDs identify players and authorize hosts. Usernames are display labels and may repeat.
- An account belongs to at most one game. Multiple tabs share that membership; leaving from one tab leaves from all tabs.
- Lobby joins are idempotent. Every successful connection rejoins the lobby and receives an authoritative game snapshot. All lobby observers receive subsequent snapshots.
- The final socket disconnect starts a 30-second grace period. Reconnection restores the seat; expiration removes the player, transfers host ownership, or deletes an empty game.
- Games persist in the `public."currentGames"` PostgreSQL table. The server loads them on startup; persisted players then have the same 30-second window to reconnect. Startup fails clearly if the table or credentials are missing.
- Run **one Node server process per deployment**. It maintains the live game snapshot and serializes state changes while awaiting PostgreSQL writes. There is no database owner lock. Multiple replicas or direct table edits while the server is running are not supported; horizontal scaling also requires shared presence, transactional membership handling, and a cross-process Socket.IO adapter.
- Chat has server-assigned identities, validates room membership, limits message size and send frequency, and retains only the latest 200 messages per channel in each client. Chat history is not persisted.

## Verification

After installing both packages:

```sh
npm test --prefix server
npm run build --prefix client
npm run lint --prefix client
```

Tests cover permissions, malformed events, duplicate requests, lobby synchronization, reconnects, multiple tabs, disconnect expiry, Supabase persistence, asynchronous write failures, concurrent actions, and client lifecycle behavior. They use local sockets, mocked authentication, and mocked Supabase HTTP responses; they do not contact your project or create Supabase accounts. The existing project does not need a new table.

## Game row mapping

The adapter writes `game_id`, `host_id`, `host_handle`, `users_in_game`, text `state` (`waiting`/`started`), `time_limit`, and `number_of_problems`. New Game opens a modal with initial values of 30 seconds and 5 problems. Both inputs require whole numbers from 5 to 99. The server validates and saves the chosen values in `time_limit` (seconds) and `number_of_problems`; game cards display those values. Existing row settings are preserved. `time_created` uses the database default; `questions` is left for gameplay implementation. Only the host handle is persisted by this schema; other player names are restored from authenticated sockets on reconnect.
