# PicklePlay end-to-end tests

Browser tests powered by [Playwright](https://playwright.dev). They exercise the
real web app against a running API and seeded database.

## What's covered

| Suite | Project | Flow |
| ----- | ------- | ---- |
| `auth.public.spec.ts` | public | landing page renders, login form (success / bad creds / `?next=` redirect) |
| `sessions.admin.spec.ts` | admin | sessions list, host creates a session, session detail + tabs |
| `host.admin.spec.ts` | admin | start a live session, check a player in, TV board loads |

Projects map to auth state:

- **public** — no login (landing + login form).
- **admin** — signed in as the seeded admin (`admin@pickleplay.local`).
- **player** — signed in as `player1@pickleplay.local` (available for future player-view tests).

`global-setup.ts` logs each seeded user in through `/auth/login` and saves a
`storageState` under `.auth/` whose `localStorage` carries the same
`pp_token` / `pp_user` the web app reads. Authenticated tests therefore start
already logged in — no per-test UI login.

## First-time setup

```bash
# from the repo root
npm install
npm run e2e:install          # downloads the Chromium browser

# a Postgres must be reachable (docker compose up -d db), then:
npm run db:push
npm run db:seed              # creates admin@pickleplay.local / admin123 + 12 players + 4 courts
```

## Running

```bash
# boots the API (:4000) + web (:3000) automatically, runs all tests
npm run test:e2e

# interactive UI mode
npm run test:e2e:ui
```

By default Playwright starts both servers (`webServer` in
`playwright.config.ts`) and reuses any already running. Options:

- `PW_NO_SERVER=1` — don't start servers; assume the stack is already up.
- `WEB_URL` / `API_URL` — point the tests at a different host (defaults
  `http://localhost:3000` and `http://localhost:4000`).

```bash
# run against an already-running stack
PW_NO_SERVER=1 npm run test:e2e
```

## Notes

- Host/board tests provision a fresh session per test via the API
  (`helpers.ts`), so runs are independent and don't depend on list ordering.
- Traces, screenshots, and video are captured on failure; open the last run
  with `npm --workspace e2e run report`.
