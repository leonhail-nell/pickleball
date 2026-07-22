# PicklePlay — Production Deployment Guide

## Read this first: it's 3 pieces, not just Vercel

PicklePlay is a monorepo with **three parts** that each need a home:

| Part | What it is | Where it can live | Why |
| --- | --- | --- | --- |
| `apps/web` | Next.js 15 frontend | **Vercel** ✅ | What Vercel is built for |
| `apps/api` | Fastify + **Socket.IO** + Prisma | **Railway / Render / Fly** (NOT Vercel) | Needs a always-on server with live WebSockets |
| Postgres DB | Prisma database | **Neon / Railway / Render** | Managed Postgres |

> **Vercel cannot host the API.** Vercel runs serverless functions that spin up and die per request — but the live board, queue updates, and tournament brackets use a **persistent Socket.IO WebSocket server**, which needs a process that stays running. So: **web on Vercel, API on Railway (or Render/Fly), database on Neon.**

**Recommended stack:**
- Database → **Neon** (free serverless Postgres, no expiry)
- API → **Railway** Hobby (~$5/mo — always-on, no cold starts, WebSockets built in)
- Web → **Vercel** (free hobby)
- Total ≈ **$5/mo + domain (~$12–38/yr)**

> Keeping the database on **Neon** (free) means Railway only runs the API, so you stay at ~$5/mo. You *can* instead add a Railway Postgres for a single dashboard, but that adds to your Railway usage.
>
> Free alternative if you change your mind: **Render's free web service** also supports WebSockets, but it sleeps after ~15 min idle (~1 min cold start). Fine for testing, not ideal for a live launch — which is why Railway is recommended here.

---

## Step 0 — Put the code on GitHub

Vercel and Railway deploy from a Git repo. The project is currently a local folder.

```bash
cd ~/Documents/openPlayPickle
git init
printf "node_modules/\n.next/\n.env\n.env.local\n*.tsbuildinfo\n" > .gitignore
git add .
git commit -m "PicklePlay initial deploy"
# create an EMPTY repo named "pickleplay" on github.com, then:
git remote add origin https://github.com/<you>/pickleplay.git
git branch -M main
git push -u origin main
```

Double-check no real secrets are committed — `.env` and `.env.local` must be gitignored.

---

## Step 1 — Database (Neon)

1. Create an account at **neon.tech** → **New Project** (pick a region near your users).
2. Copy the **connection string** (looks like `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`). Use the **pooled** connection string.
3. Keep it — this is `DATABASE_URL`.

Create the tables (run once from your Mac, pointing at the Neon URL):

```bash
cd ~/Documents/openPlayPickle
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" \
  npx prisma db push --schema packages/db/prisma/schema.prisma
```

> Do **not** run `db:seed` in production — it creates demo players and a default admin (`admin@pickleplay.local` / `admin123`). Instead, register your own organizer account after launch, or change that password first (see hardening).

---

## Step 2 — API (Railway, ~$5/mo)

1. **railway.app** → **New Project → Deploy from GitHub repo** → pick your repo. Add the **Hobby plan** ($5/mo).
2. **Build & start commands are already configured** by the `railway.json` file in the repo root — Railway reads it automatically, so you don't type them in the dashboard. (For reference, it runs `npm install --include=dev && npx prisma generate …` to build and `npm --workspace apps/api run start:prod` to run, with a `/health` healthcheck.)
3. **Variables** tab → add `DATABASE_URL`, `JWT_SECRET`, `WEB_ORIGIN`, plus any optional keys (table below). Copy them from `apps/api/.env.example`. Railway injects `PORT` automatically; the server binds `0.0.0.0` and reads `PORT`, so it's ready.
4. **Settings → Networking → Generate Domain** (Railway doesn't expose the service publicly until you do this). You'll get a URL like `https://pickleplay-api-production.up.railway.app`.
5. Open `https://<that-url>/health` — you should see `{"ok":true}`. No cold starts — it stays warm 24/7.

> `--include=dev` in the build matters: the app runs TypeScript directly via `tsx`, and `prisma` is a dev dependency, so a plain production install would omit them. (`tsx` is also pinned as a runtime dependency so it survives any devDependency pruning.)
>
> **Free alternative (with cold starts):** Render → New → Web Service → Build `npm install --include=dev && npx prisma generate --schema packages/db/prisma/schema.prisma`, Start `npm --workspace apps/api run start:prod`, same env vars, Free instance. Supports WebSockets but sleeps after ~15 min idle (~1 min to wake).

**API environment variables**

| Variable | Value | Required? |
| --- | --- | --- |
| `DATABASE_URL` | Neon pooled connection string | ✅ |
| `JWT_SECRET` | a long random string (see hardening) | ✅ |
| `WEB_ORIGIN` | your web URL, e.g. `https://pickleplay.io` (CORS + Socket.IO origin) | ✅ |
| `PORT` | Railway sets this automatically; leave unset or `4000` | — |
| `STRIPE_SECRET_KEY` | Stripe secret key | only if using card payments |
| `PAYMONGO_SECRET_KEY` | PayMongo secret key | only if using GCash/Maya |
| `GOOGLE_CLIENT_ID` | Google OAuth client id | only if using Google sign-in |

---

## Step 3 — Web (Vercel)

1. **vercel.com** → **Add New → Project** → import the same GitHub repo.
2. **Root Directory:** set to **`apps/web`** (important — it's a monorepo).
3. Framework preset: **Next.js** (auto-detected). Leave build/output defaults.
4. Add **Environment Variables**:

| Variable | Value | Required? |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | your Railway API URL, e.g. `https://pickleplay-api-production.up.railway.app` (**https, no trailing slash**) | ✅ |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth client id | only if using Google sign-in |

5. Deploy. You get `https://<project>.vercel.app`.

> `NEXT_PUBLIC_API_URL` is baked in at build time and is where the browser opens both REST calls **and** the Socket.IO connection. It must be the public **https** API URL.

---

## Step 4 — Connect the two + verify

1. Set the API's `WEB_ORIGIN` to your final web URL (the `.vercel.app` one for now, or your custom domain once attached). Redeploy the API so CORS/WebSocket origin matches.
2. Open the Vercel site, register an organizer, create a session, open the board on a second tab — confirm live updates (a win report should move players instantly). If the board doesn't update live, it's almost always a `WEB_ORIGIN` / `NEXT_PUBLIC_API_URL` mismatch or `http` vs `https`.

---

## Step 5 — Custom domain

Grab one (see recommendations below), then:
- **In Vercel:** Project → Settings → Domains → add `pickleplay.io` and `www.pickleplay.io`. Vercel shows the DNS records (or auto-configures if you buy through Vercel).
- **Update env:** set API `WEB_ORIGIN=https://pickleplay.io` and redeploy the API. Keep `NEXT_PUBLIC_API_URL` pointing at the API host (you can also put the API on a subdomain like `api.pickleplay.io` via your DNS + Railway custom domain, then update `NEXT_PUBLIC_API_URL`).

---

## Pre-launch hardening (do these before sharing the link)

1. **JWT secret.** Generate a strong one and set `JWT_SECRET` on the API (never ship the `dev-secret` default):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
2. **Default admin.** Don't run `db:seed` in prod. If you did, change the `admin@pickleplay.local` password immediately, or delete that account and make your own organizer.
3. **HTTPS everywhere.** Web (Vercel), API (Railway), and DB (Neon `sslmode=require`) are all https/TLS by default — good. A `http` API URL will be blocked by the browser as mixed content.
4. **Payments are env-gated.** If `STRIPE_SECRET_KEY` / `PAYMONGO_SECRET_KEY` are unset, those buttons return a friendly "not configured" message — safe to launch without them. Add live keys only when ready, and use Stripe/PayMongo **live** (not test) keys in prod.
5. **Google sign-in (optional).** If you set the client id, add your production origin (`https://pickleplay.io`) to the Google Cloud OAuth **Authorized JavaScript origins**.
6. **Migrations going forward.** You used `prisma db push` (fine for launch). For ongoing changes, prefer real migrations: `prisma migrate dev` locally to create them, `prisma migrate deploy` on the server.

---

## Quick reference — what each env var does

- `DATABASE_URL` — Postgres connection (API only).
- `JWT_SECRET` — signs auth tokens (API only). Must match across restarts or everyone gets logged out.
- `WEB_ORIGIN` — the ONE web origin allowed to call the API / open sockets (API only).
- `NEXT_PUBLIC_API_URL` — where the browser reaches the API + WebSockets (web only, build-time).
- `PORT` — API port (host usually injects it).
- `STRIPE_SECRET_KEY`, `PAYMONGO_SECRET_KEY` — payment providers (API only, optional).
- `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google sign-in (API + web, optional).

---

## Domain recommendations (checked live)

| Domain | Price/yr | Notes |
| --- | --- | --- |
| **pickleplay.io** | $37.99 | **Top pick** — exact brand, `.io` reads as a modern SaaS |
| **getpickleplay.com** | $11.25 | Best value `.com`; "get" prefix is standard for SaaS |
| **trypickleplay.com** | $11.25 | Same idea, "try" framing |
| **joinpickleplay.com** | $11.25 | Fits "join open play" |
| **playpickle.io** | $37.99 | Alt brand if you ever rename |
| pickleplay.gg | $129.99 | `.gg` is gaming-flavored + pricey — skip |

Taken: `pickleplay.com`, `.app`, `.club`, `.co`, `.net`, `.org`.

**Suggestion:** buy **pickleplay.io** as the brand, and optionally **getpickleplay.com** ($11) as a cheap redirect to it. You can buy either through Vercel (auto-configures DNS) or any registrar (Namecheap/Cloudflare) and point it at Vercel.
