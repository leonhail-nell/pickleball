# Code Review: PicklePlay monorepo (live-session flow, payments, engine)

## Summary
Solid architecture: the fairness engine is pure and well-tested (15 property tests), the API keeps live state in memory with Postgres checkpoints and crash recovery, and the UI is consistent MUI. Verdict: **approve with fixes** — four real bugs found, all fixed in this pass.

## Blocking issues — FIXED in this pass
- **apps/api/src/live.ts:154 — duplicate check-in wiped player state.** `engine.checkIn` overwrites the pool entry, so a host double-click or a player re-scanning the QR reset their games-played/partner coverage to zero — and could flip a mid-game player back to `active`, corrupting rotation. *Fix:* idempotency guard — existing players are ignored (paused ones are resumed).
- **routes.ts (cancel signup) — waitlist promotion skipped the fee.** The promoted player never got a Payment row, silently losing revenue on paid sessions. *Fix:* `ensureSessionPayment` on promotion.
- **routes.ts (self check-in) — waitlisted players could QR-scan past capacity.** The QR path never checked waitlist status. *Fix:* blocked with a clear message when the session is at capacity.
- **live.ts removePlayer — orphaned PENDING fees.** Removed players kept unpaid fee rows, inflating the admin "uncollected" stat forever. *Fix:* pending payments deleted on removal.

## Important, not blocking (open)
- **JWT carries the role** (auth.ts): promoting a player to HOST only takes effect after they log in again. Fine for now; re-issue tokens or read role from DB if it bites.
- **Host `finish` on an already-reported game returns a 500** ("game not live") instead of a 400 — the host console shows the message either way; cosmetic API hygiene.
- **Socket.IO rooms are unauthenticated** — anyone who knows a userId could join their room and see "you're up" pings. Harmless data, but add a token handshake in Phase 5.
- **Queue display order vs engine order** — the visible queue sorts by raw games played; the engine uses prorated-adjusted counts. A prorated latecomer may appear higher in the list than their true draw priority. Display-only.

## Nits
- `apps/web/app/host/[id]/page.tsx` is 750+ lines — split dialogs into components next touch.
- `live.ts` (630 lines) would benefit from extracting a `payments`/`games` module before Phase 5.
- Engine `substitute` doesn't transfer the leaver's consecutive-game count — acceptable, but note the sub can briefly exceed the catch-up cap.

## What this codebase does well
- The engine's fairness invariants are enforced *and tested* (spread ≤1, no-repeat-partner, monopoly guard, seeded replay, chi-squared shuffle uniformity).
- Commit–reveal RNG with persisted chain counter is a genuinely verifiable fairness story.
- Crash recovery (engine checkpoint + LIVE-game restore + reconcile) survived real mid-session restarts during development.
- Every override (manual game, swap, queue bump) is audited and publicly flagged — trust-preserving by design.
