# Open Play Pickleball System — Design Spec

**Version:** 1.0 · **Date:** 2026-07-13 · **Scope:** Single venue/club · **Platform:** Web app (mobile-first)

---

## 1. Vision

A web app that runs open play end to end for one venue: players sign up for sessions, check in on arrival, and the system rotates them onto courts with **provably unbiased shuffling** and **skill-balanced games** — no whiteboard, no paddle stacking, no arguments about who's next.

### Goals

- Fair rotation: everyone plays a near-equal number of games; wait times are equalized.
- Zero-bias shuffle: random assignments use a cryptographic RNG with an auditable log; no one (including the organizer) can rig who plays with whom.
- Skill-appropriate games via ratings and tiered courts.
- Light club management: members, drop-in fees, session scheduling, courts.
- Works courtside on a phone; optional big-screen queue board.

### Non-goals (v1)

- Multi-venue / multi-tenant support.
- Tournaments and league brackets.
- Native mobile apps (PWA covers it).

---

## 2. Roles

| Role | Can do |
|---|---|
| **Player** | Sign up, check in, view queue, see "you're up" alerts, report scores, view own stats |
| **Session host** (staff) | Start/pause session, force check-in/out, override assignments (logged), resolve disputes |
| **Admin** | Everything + manage members, courts, schedules, pricing, rotation config, view audit log |

---

## 3. Core Concepts & Rules

### 3.1 Session lifecycle

```
scheduled → open (sign-up) → live (check-in + rotation) → closed
```

- A **session** = an open play block (e.g., Tue 6–9pm, 4 courts, cap 32, tier 3.0–3.5).
- Sign-up opens N hours before (configurable). Waitlist beyond capacity, auto-promote on cancellation.
- **Check-in** on arrival: QR code posted at the venue → player scans → checked in and enters the player pool. Host can check in walk-ins.
- No-show handling: signed up but not checked in by grace period (default 15 min) → spot released to waitlist; strike recorded.

### 3.2 Rotation modes (configurable per session)

| Mode | Behavior |
|---|---|
| **Full rotation** (default) | All 4 players come off after each game; next 4 from queue go on |
| **Winners stay** | Winners stay (max K consecutive wins, default 2), losers to back of queue |
| **Challenge court** | One court is winners-stay; the rest full rotation |

Partner-diversity (no repeat partners) and late-arrival catch-up (§4.5) apply in **every** mode — they are engine rules, not a mode.

### 3.3 Skill matching

- Each player has a **club rating** (seeded from self-reported DUPR/UTPR or host estimate, refined by results — see §4.4).
- Sessions can be **tiered** (courts split by rating band) or **open** (rating used only to balance teams within a game).
- Balance rule for team formation: minimize the difference of team rating sums; ties broken randomly.

### 3.4 Fairness invariants (the contract with players)

1. **Games-played spread ≤ 1** across all checked-in players at any point (excluding paused players and late arrivals in catch-up — see §4.5). *Exception: winners-stay/challenge modes intentionally relax this to spread ≤ K+1 (the win cap); the board shows games-played so the trade-off is visible.*
2. Longest-waiting players are always in the next game's candidate pool.
3. **No repeat partners (hard rule, all modes):** you never partner the same player twice while there is any eligible player you haven't partnered yet. Repeat opponents are minimized as a soft penalty. See §4.5.
4. **Late-arrival catch-up:** players who arrive late get court priority until their games-played matches the rest of the pool (capped — see §4.5).
5. All random choices come from a CSPRNG; every assignment is logged with its inputs so it can be audited.

---

## 4. The Rotation Engine (heart of the system)

### 4.1 State

Per live session, keep in Redis (source of truth mirrored to Postgres):

```
pool         = { player_id: {games_played, last_finished_at, status(active|paused|playing), rating} }
courts       = { court_id: current_game | idle }
history      = pairwise counters: partnered[a][b], opposed[a][b]
audit_log    = append-only shuffle/assignment records
```

### 4.2 Next-game selection (when a court frees up)

```
1. Eligible = active players not currently playing
2. Priority order:
   a. catch-up players (deficit > 0, see §4.5), by deficit DESC
   b. then (games_played ASC, last_finished_at ASC)
3. Candidate pool = all players tied within the fairness window
   (everyone whose games_played ≤ min_games and comparable wait)
4. If |candidates| > 4: select 4 via CSPRNG-seeded Fisher–Yates,
   biased toward foursomes that contain at least one
   never-before-partnered pairing for each selected player
5. Split 4 into teams — enumerate the 3 possible pairings and apply:
   HARD:  reject any pairing that repeats a partner while a
          never-partnered alternative pairing exists among the 3
   SOFT:  score remaining = |sum(teamA r) − sum(teamB r)|
          + β·times_opposed(matchup)
   pick lowest score; break ties with CSPRNG
6. Assign to court, notify players (push + queue board), log to audit_log
```

### 4.3 Unbiased shuffle — how "no bias" is guaranteed

- **RNG:** Node `crypto.randomInt` / `crypto.randomBytes` (CSPRNG), never `Math.random()` or manual ordering.
- **Fisher–Yates** for any shuffle — uniform over all permutations, no positional bias.
- **Auditability:** each draw logs `{timestamp, eligible_set, seed_commitment, result}`. Optionally publish a per-session seed hash at session start (commit–reveal), so after the session anyone can verify every shuffle was determined by the committed seed + public state — the host couldn't have cherry-picked outcomes.
- **Host overrides are allowed but always logged and visibly flagged** on the queue board ("manual assignment").
- Mixer weighting is deterministic and published (penalty = α·times_partnered + β·times_opposed), so "soft" preferences can't hide favoritism.

### 4.4 Rating updates (optional, on by default)

- Elo-style per game: `ΔR = K · (outcome − expected)` where expected comes from team rating difference; K decays with games played (new players converge fast, veterans stable).
- Score reporting: either team reports; the other confirms (auto-confirm after 10 min). Disputes go to host.
- Ratings only shift matchmaking gradually — clamp per-session movement to avoid feedback loops.

### 4.5 Partner coverage & late-arrival catch-up

**Partner coverage (no repeat partners).** The engine keeps a per-session `partnered[a][b]` matrix and treats pairing like a progressive round-robin:

- When forming teams, a pairing that has already occurred is **rejected** if any of the three possible team splits contains only never-partnered pairs. Repeats are only allowed once a player has partnered every currently-eligible player at the same coverage level — then the matrix "laps" and the constraint resets to "fewest repeats first" (partner count 0 → 1 → 2 …).
- Foursome selection (step 4) is coverage-aware: among the fairness-tied candidates, the CSPRNG draw is weighted toward combinations that create new pairings, so coverage progresses even before team-split time.
- The queue board can show a **"played with" progress ring** per player (e.g., 9/15 partners) — players can see the mixing is real.
- Opponent diversity is a soft penalty (β·times_opposed): repeated *matchups* are pushed apart but not forbidden, since with small pools forbidding both partners and opponents over-constrains quickly.
- With N active players, full partner coverage needs at least N−1 rounds — often longer than a session. The goal is **maximal progress toward coverage**, guaranteed no-repeat while unexplored pairs exist, not guaranteed completion.

**Late-arrival catch-up.** A player checking in mid-session keeps their true `games_played = 0` and gets a **deficit** = `min_games_of_active_pool − games_played` (recomputed as the pool moves):

- Deficit players sort ahead of everyone in the draw (step 2a), so they go on nearly every rotation until their deficit reaches 0 — they *play more* until they've matched the group.
- **Monopoly guard:** max consecutive games while catching up = 2 (configurable); after 2 in a row they sit one rotation even if deficit remains. Prevents one very late arrival from freezing everyone else.
- **Catch-up target (configurable per club):**
  - `full` (default): target = current minimum of the on-time pool — late arrival fully equalizes total games.
  - `prorated`: target = games the pool has played *since* their check-in — they equalize going forward but don't reclaim games missed before arriving. Use this if regulars complain that very late arrivals eat court time.
- Catch-up players are exempt from invariant #1 (their games_played is legitimately behind); the board shows a **"catching up"** badge so priority is transparent, not suspicious.
- No-show conversion: a player who signed up, arrived >X min late (default 60) enters with `prorated` regardless of club setting — protects the people who showed up on time.

**Facilitator custom pairing (override).** The host can hand-build a game — pick 4 players and set the exact teams — even when it breaks the no-repeat-partner rule (e.g., a requested rematch, coaching pairs, accommodating a couple who came together):

- Available from the host console: pick players from the pool → drag into Team A/B → assign to a court. Engine validation is shown but **advisory only** ("repeats partner ×2", "skill gap 1.5") — the host can proceed anyway.
- Every custom game is logged to `audit_events` with actor, players, and which rules it bypassed, and is flagged **"manual"** on the queue board — fairness stays transparent even when overridden.
- Custom games still count toward `games_played` and the partner matrix by default (so the engine routes around the repeat afterward). Host can mark a game **"exhibition"** to exclude it from counts, ratings, and the partner matrix entirely.
- Players placed in a manual game are removed from the auto-draw for that rotation; everyone else rotates normally.
- Optional player-side request: "prefer to play with X" / "keep us together" flags the host, who decides — requests never feed the auto-engine directly, so the shuffle stays unbiased.

### 4.6 Edge cases

| Case | Handling |
|---|---|
| Player count not divisible by 4 | Extra players simply have highest queue priority for the next opening; spread ≤ 1 invariant still holds |
| < 4 eligible when court frees | Court idles; game starts as soon as the 4th player is eligible |
| Late arrival mid-session | Keeps true `games_played = 0` → enters **catch-up** with deficit priority until equalized (§4.5); monopoly guard caps them at 2 consecutive games |
| Player steps out (bathroom, break) | Self-serve **pause**; excluded from draws; resume restores position fairly (keeps their games_played) |
| Player leaves without pausing | Missed 1 "you're up" call → auto-paused; host notified |
| Game running long | Soft time cap (e.g., 20 min) → board flags court; host can call it |
| Injury / abandoned game | Host voids game (no rating change) or records partial result |
| Odd skill distribution in tiered session | Host can merge/split tiers live; engine rebalances pools |

---

## 5. Architecture

```
┌─────────────────────────────┐
│  PWA (Next.js 15, App Router)│  players + host + admin UIs
│  Queue Board view (TV/kiosk) │  mobile-first, TV mode route
└──────────┬──────────────────┘
           │ HTTPS / WebSocket
┌──────────▼──────────────────┐
│  API (Node — Fastify + TS)  │  REST + auth (JWT via Auth.js)
│  Rotation Engine (package)  │  pure, unit-testable core
│  Socket.IO                  │  realtime queue/board updates
└───┬──────────────┬──────────┘
    │              │
┌───▼────┐   ┌─────▼─────┐
│Postgres│   │  Redis     │  live session state, queues,
│(Prisma)│   │            │  pub/sub, locks
└────────┘   └───────────┘
```

**Stack:** Next.js 15 (App Router, PWA) + a standalone Node API (Fastify + TypeScript + Socket.IO) + Postgres via Prisma + Redis. Monorepo (pnpm workspaces / Turborepo) with the rotation engine as a shared `packages/engine` — pure TypeScript, imported by the API and by tests. Deploy: single VPS (Fly.io/DigitalOcean) or Vercel (frontend) + Fly (API+WS) — one venue never needs more.

**Why a separate Node API instead of Next.js API routes:** the rotation engine needs long-lived WebSocket connections and Redis-backed locks — awkward in serverless/route handlers, natural in a persistent Fastify process. Next.js stays a pure frontend (plus server components for fast initial board render). Trade-off: two deployables instead of one; acceptable for the realtime guarantees.

**Key decisions & trade-offs**

- **Redis for live state, Postgres for record:** rotation decisions need low-latency atomic ops (locks per court assignment); Postgres alone would work at this scale, but Redis makes the realtime path simple. Trade-off: dual-write discipline — mitigate by treating Redis as cache-of-truth only during `live` and flushing to Postgres on every game event.
- **Rotation engine as a pure module:** given (pool, history, config, rng) → assignment. No I/O inside. This makes fairness properties unit-testable and the audit log reproducible.
- **WebSockets over polling:** courtside UX needs instant "you're up" — polling at 2s would also be acceptable fallback for flaky gym Wi-Fi (PWA falls back automatically).
- **PWA over native:** install-free, QR-friendly; push notifications via Web Push (works on iOS ≥16.4).

---

## 6. Data Model

```sql
users            (id, name, email, phone, role, rating, rating_confidence,
                  dupr_id?, strikes, created_at)
memberships      (id, user_id, plan_id, status, starts_at, ends_at)
plans            (id, name, price_cents, period, drop_in_price_cents)
payments         (id, user_id, session_id?, membership_id?, amount_cents,
                  method, status, created_at)
courts           (id, number, label, is_active)
sessions         (id, starts_at, ends_at, capacity, mode, tier_min, tier_max,
                  status, signup_opens_at, grace_minutes, seed_commitment,
                  config JSONB)
session_courts   (session_id, court_id)
signups          (id, session_id, user_id, status: signed_up|waitlisted|
                  checked_in|no_show|cancelled, checked_in_at, position)
games            (id, session_id, court_id, started_at, ended_at,
                  team_a_score, team_b_score, status: live|final|void,
                  assignment_type: auto|manual, is_exhibition bool)
game_players     (game_id, user_id, team: A|B, rating_before, rating_after)
pair_history     (session_id, player_a, player_b, times_partnered, times_opposed)
audit_events     (id, session_id, type, actor_id?, payload JSONB, created_at)
```

Indexes that matter: `signups(session_id, status)`, `game_players(user_id)`, `games(session_id, status)`, `pair_history(session_id, player_a, player_b)`.

---

## 7. API Sketch (REST)

```
POST   /auth/register|login                      # JWT (Auth.js compatible)
GET    /sessions?from=&to=                       # schedule
POST   /sessions                                  # admin
POST   /sessions/{id}/signups                     # player signs up
DELETE /sessions/{id}/signups/me                  # cancel (waitlist promote)
POST   /sessions/{id}/checkin   {qr_token}        # check in
POST   /sessions/{id}/pause     /resume           # player self-pause
GET    /sessions/{id}/board                       # queue board state (also via WS)
POST   /sessions/{id}/start|close                 # host
POST   /games/{id}/score        {a, b}            # report
POST   /games/{id}/confirm|dispute|void
POST   /sessions/{id}/assignments/manual          # host override (audited)
PATCH  /games/{id}/court        {court_id}        # move game to another court
PATCH  /games/{id}/players                        # drag edits pre-start (audited)
PATCH  /sessions/{id}/queue/reorder               # host queue bump (audited)
GET    /sessions/{id}/audit                       # audit log
GET    /me/stats                                  # games, win %, rating history
CRUD   /courts /plans /memberships /users         # admin
```

**WebSocket channels:** `session.{id}.board` (queue + court state), `user.{id}` ("you're up on Court 3").

---

## 8. Key Screens

1. **Player home** — upcoming sessions, one-tap sign-up, my rating/stats.
2. **Check-in** — camera QR scan → confirmation.
3. **Live queue (player)** — position, est. wait, current courts, pause button, big "YOU'RE UP — COURT 2" takeover.
4. **Queue board (TV mode)** — courts grid + next-up list + games-played column (transparency builds trust in fairness).
5. **Host console** — a drag-and-drop court map (see below), pool overview, custom pairing builder, start/void games, no-show management.

### Host console: drag-and-drop court map

The main host view is a live board of **numbered court cards** (Court 1…N) plus a **queue rail** of waiting players. Everything is draggable (dnd-kit):

| Drag | Effect |
|---|---|
| Player card: queue → court slot | Adds to a forming game (advisory warnings shown, override logged) |
| Player card: court → court | Swaps/moves before game start; blocked once game is live |
| Player card: court → queue | Removes from forming game, returns to fair queue position |
| Player card within a court: Team A ⇄ Team B | Rearranges teams pre-start |
| Whole game card: court → court | Reassigns the game to a different court number (e.g., Court 2's net broke) |
| Queue rail reorder | **Host-only, logged** — bumps a player up/down; flagged on the public board |

Rules: auto-assigned games appear pre-placed and start untouched with one tap; any drag converts the game to `manual` (audited). Drops that violate hard rules show a confirm dialog with the warning, never a silent block. All drag mutations go through the same API as auto-assignment, so audit and realtime broadcast are uniform.

**Court numbering & assignment.** Courts have a number and label (`Court 1 — "Near entrance"`), set in admin. Per session the host picks which courts are in play (`session_courts`) and can renumber/disable a court mid-session (game in progress moves via game-card drag). Auto-assignment fills the **lowest-numbered idle court** by default (configurable: round-robin across courts to even out surface wear/lighting complaints). The player "you're up" alert and TV board always show the court number prominently.
6. **Admin** — schedule builder, members, payments, rotation config, audit viewer.

---

## 9. Non-Functional Requirements

| Concern | Target |
|---|---|
| Scale | ≤ 200 concurrent users, ≤ 8 courts — trivial load; single server fine |
| Latency | Assignment decision < 100 ms; board update < 1 s |
| Availability | Session-time is critical: health checks + auto-restart; offline-tolerant board (last state cached in PWA) |
| Concurrency | Court-assignment behind a Redis lock per session — prevents double-assignment when two courts free simultaneously |
| Privacy | Ratings visible per club policy toggle; phone/email never public |
| Audit | Every assignment, override, and rating change is an `audit_events` row |

---

## 10. Build Plan

**Phase 1 — Rotation MVP (2–3 wks)**
Auth, sessions, check-in (host-managed), full-rotation engine + CSPRNG shuffle **with no-repeat-partner rule and late-arrival catch-up** (both are core engine, not add-ons), live queue board, host console. *Usable at the venue immediately — this alone replaces the paddle stack.*

**Phase 2 — Player self-service (1–2 wks)**
Sign-up/waitlist, QR self check-in, pause/resume, Web Push "you're up", no-show strikes.

**Phase 3 — Skill & fairness+ (2 wks)**
Ratings + Elo updates, score reporting/confirmation, tiered sessions, opponent-diversity weighting, "played with" coverage ring on the board, seed commit–reveal audit.

**Phase 4 — Club management (2 wks)**
Memberships/plans, drop-in payments (Stripe), stats dashboards, admin reports.

### Competitive research: picklehub.ph (2026-07)

Analyzed PickleHub's live open-play system (event pages, a completed 36-player session, list page). Findings and what we adopted:

**Their model:** open plays are ticketed events (₱100–500/player) hosted by clubs/communities at venues, with capacity + waitlist, court numbers listed per event, "All Levels" badges, private events with passcodes. Event page tabs: Details / Participants / Match / Chat. The Match tab is a **leaderboard** (rank, W-L, win %, point differential, top-3 medals + prizes) where tapping a player opens their **match history** (per court: partner, opponents, score to 11, WIN/LOSS). Sessions end in a "Completed / Thanks for playing!" state with standings preserved.

**Adopted (implemented):** session title/description/organizer/price-per-player, event detail page with Details/Participants/Leaderboard tabs, capacity progress bars + "spots left", court-number chips on event cards, leaderboard ranked by wins → win % → point differential with medal icons, tap-a-player match history, completed-session end state, leaderboard on the TV board.

**Notable gap in their engine (verified from real session data):** their matchmaking repeated the same partner pair up to 6 times in 8 games (JB + BOBBY). Our no-repeat-partner hard rule is a direct differentiator — surfaced via the coverage ring.

**Deferred to roadmap:** in-event chat, prizes for top 3, private events + passcodes, day-filter strip on the list page ("Today / Tomorrow / Weekend / Free entry"), payments (GCash), "Hubby" AI assistant, venue pages with directions/add-to-calendar.

### Future service phases (full-platform roadmap)

| Phase | Service | Scope |
|---|---|---|
| **5 — Courts & booking** | Court reservations outside open play | Availability calendar, booking slots, conflicts with open-play blocks, cancellation policy |
| **6 — Find a Game** | Player-initiated matchmaking | "Looking to play" posts, skill/time filters, auto-match into foursomes, notifications |
| **7 — Tournaments** | Brackets & events | Single/double elimination + round robin, seeding from club ratings, registration + fees, live bracket board |
| **8 — Community** | Club social layer | Activity feed, groups, game recaps from audit data ("you played with 9 new partners!"), announcements |
| **9 — Programs & clinics** | Lessons and structured programs | Coach profiles, class schedules, enrollment + payments, skill-progression tracking |
| **10 — Club pages / directory** | Multi-venue growth | Public club landing pages, discovery ("clubs near you"), per-club branding — the step that turns the single-venue system into a platform (tenant model per §11) |

Each service reuses the same foundation: users + ratings from Phase 3, payments from Phase 4, and the realtime board infrastructure from Phase 1.

**Testing focus:** property-based tests on the engine — for random pools/sequences assert: spread ≤ 1, uniformity of shuffle (chi-squared over many draws), no starvation, deterministic replay from audit log.

---

## 11. What to Revisit as It Grows

- Multi-venue → tenant column + per-venue config (schema already isolates by session).
- DUPR API integration for official ratings.
- If Redis feels heavy for one venue, engine state can live in Postgres advisory locks + LISTEN/NOTIFY — same pure engine, simpler ops.
- Native push (Capacitor wrapper) if iOS Web Push proves unreliable at your venue.
