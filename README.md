# PicklePlay — Open Play, Fairly

Phase 1 of the open play pickleball system ([spec](../open-play-pickleball-system-spec.md)): unbiased CSPRNG rotation with a **no-repeat-partner hard rule**, **late-arrival catch-up**, live queue board, and a drag-and-drop host console.

## Stack

Monorepo (npm workspaces):

| Package | What |
|---|---|
| `packages/engine` | Pure TypeScript rotation engine — all fairness logic, fully unit-tested |
| `packages/db` | Prisma schema + seed (Postgres) |
| `apps/api` | Fastify + Socket.IO + JWT auth (port 4000) |
| `apps/web` | Next.js 15 App Router + MUI (Material UI v6, dark theme) (port 3000) |

## Quick start

> **Heads-up:** if your shell exports `NODE_ENV=production` (check `echo $NODE_ENV`), npm will skip devDependencies. Either remove it from your `~/.zshrc` or prefix installs with `NODE_ENV=development`.

```bash
# 1. Postgres — either Docker:
docker compose up -d
#    or Homebrew (no Docker needed):
#    brew install postgresql@16 && brew services start postgresql@16
#    createdb pickleplay && psql pickleplay -c "CREATE ROLE pickleplay WITH LOGIN PASSWORD 'pickleplay' SUPERUSER;"

# 2. Install
NODE_ENV=development npm install --include=dev

# 3. Database
cp apps/api/.env.example apps/api/.env
export DATABASE_URL=postgresql://pickleplay:pickleplay@localhost:5432/pickleplay
npm run db:push -- --skip-generate && npm --workspace packages/db run db:generate
npm run db:seed

# 4. Run (two terminals)
npm run dev:api
npm run dev:web
```

Open http://localhost:3000 — log in as `admin@pickleplay.local` / `admin123` (12 demo players: `player1@pickleplay.local` … / `player123`).

## Try it

1. As admin: **+ New open play session** → **Host console** → **Start live session**.
2. Check in 8+ players from the member search — courts fill automatically; check-ins after games have started get the **catching-up badge** and deficit priority.
3. Open the **TV board** in another tab — it updates live (Socket.IO), shows next-up queue, games-played fairness column, and each player's partner-coverage count.
4. Finish a game with scores → the freed court auto-fills with an unbiased draw that never repeats a partner while a fresh pairing exists.
5. Custom pairing: drag players from the queue rail onto an idle court's Team A/B zones → **Start custom game**. Advisory warnings (partner repeats, rating gap) are shown and logged — never blocked. Games can be moved between courts.

## Engine tests

```bash
npm run test:engine
```

10 property tests: games-played spread ≤ 1, no-repeat-partner guarantee, partner-coverage near-optimality (≥25/28 pairs in 14 games with 8 players), catch-up with 2-consecutive monopoly guard, prorated mode, chi-squared shuffle uniformity, deterministic replay, pause/resume, exhibition exclusion, serialize/restore.

## Fairness guarantees (what players can verify on the board)

- Every draw uses Node's CSPRNG (`crypto.randomInt`) through Fisher–Yates — uniform, no positional bias, `Math.random` never used.
- Games-played spread stays ≤ 1; the board shows everyone's count.
- You never partner the same player twice while someone you haven't partnered is available.
- Late arrivals catch up (max 2 consecutive games) with a visible badge.
- Host overrides are allowed but always flagged `manual` and written to the audit log.

## Status & roadmap

- ✅ **Phase 1** — rotation engine, host console (drag & drop), TV board
- ✅ **Phase 2** — QR self check-in, player live view, pause/resume, browser "you're up" alerts, no-show strikes
- ✅ **Phase 3** — ratings/Elo, score report→confirm→dispute flow, tiered sessions, seed commit–reveal audit, leaderboards + match history (PickleHub-style event pages)
- ✅ **Phase 4** — membership plans, drop-in fee tracking (cash/GCash marked at the desk, members auto-waived; gateway-ready), club dashboard (`/admin`), player stats (`/me`)
- 🌱 **Phases 5–10** (see SPEC.md) — courts & booking, Find a Game, tournaments, community, programs & clinics, club pages/directory
