import type { FastifyInstance } from 'fastify';
import type { Server } from 'socket.io';
import { prisma, Prisma } from '@pickleplay/db';
import { requireRole, type AuthUser } from './auth.js';
import { callerClub, venueProActiveForClub } from './club.js';

const HOSTS = ['HOST', 'ADMIN'] as const;

/** Tournaments are a Venue Pro feature (admins exempt). Returns an error string if blocked. */
async function requirePro(user: AuthUser & { name?: string }): Promise<string | null> {
  if (user.role === 'ADMIN') return null;
  const club = await callerClub(user);
  return venueProActiveForClub(club)
    ? null
    : 'Tournaments are a Venue Pro feature — start a free trial in your club dashboard to run them.';
}

const tournamentInclude = {
  club: { select: { name: true } },
  players: { orderBy: { seed: 'asc' } },
  matches: { orderBy: [{ round: 'asc' }, { slot: 'asc' }] },
} satisfies Prisma.TournamentInclude;

/** Load the full tournament and push it to everyone watching this bracket. */
async function emitTournament(io: Server | undefined, id: string) {
  if (!io) return;
  const t = await prisma.tournament.findUnique({ where: { id }, include: tournamentInclude });
  if (t) io.to(`tournament:${id}`).emit('tournament', t);
}

/** Standard bracket seeding order for a bracket of size n (power of two).
 *  Returns seed indices (0-based) laid out so #1 meets the lowest seed, etc. */
function seedOrder(n: number): number[] {
  let rounds = [0, 1];
  while (rounds.length < n) {
    const next: number[] = [];
    const top = rounds.length * 2 - 1;
    for (const s of rounds) { next.push(s); next.push(top - s); }
    rounds = next;
  }
  return rounds; // e.g. n=4 → [0,3,1,2]
}

interface Player { id: string; name: string; seed: number; pool?: number; partner?: string | null }

/** Display name for an entry — "Ann & Bob" for doubles, else the single name. */
function entryName(p: Player, doubles: boolean): string {
  return doubles && p.partner ? `${p.name} & ${p.partner}` : p.name;
}

type Game = { a: number; b: number };
/**
 * Decide a bracket match from either per-game scores (best-of-N) or a single
 * game. Returns games-won tallies and the winning side, or null if undecided.
 */
function decideBracket(
  games: Game[] | undefined, a: number | undefined, b: number | undefined, bestOf: number,
): { side: 'A' | 'B'; aScore: number; bScore: number; games: Game[] } | null {
  const need = Math.floor(bestOf / 2) + 1;
  if (games && games.length) {
    const clean = games.filter((g) => Number.isFinite(g.a) && Number.isFinite(g.b) && !(g.a === 0 && g.b === 0));
    let wa = 0, wb = 0;
    for (const g of clean) { if (g.a > g.b) wa++; else if (g.b > g.a) wb++; }
    if (wa < need && wb < need) return null;
    return { side: wa > wb ? 'A' : 'B', aScore: wa, bScore: wb, games: clean };
  }
  if (a == null || b == null || a === b) return null;
  return { side: a > b ? 'A' : 'B', aScore: a, bScore: b, games: [{ a, b }] };
}

/**
 * Generate a seeded single-elimination bracket. Players are seeded (byes fill
 * to the next power of two), first-round matches are created in standard
 * seeding order, later rounds are created empty and wired via nextMatchId,
 * and any bye auto-advances its opponent.
 */
async function generateBracket(tournamentId: string, players: Player[], thirdPlace: boolean, doubles = false) {
  // clear any previous knockout matches (pool matches, if any, are preserved)
  await prisma.tournamentMatch.deleteMany({ where: { tournamentId, stage: { in: ['KO', 'THIRD'] } } });

  const seeded = [...players].sort((a, b) => (a.seed || 999) - (b.seed || 999));
  let size = 1;
  while (size < seeded.length) size *= 2;
  size = Math.max(size, 2);
  const order = seedOrder(size);
  // slot i holds the player with seed-rank order[i] (or a bye)
  const bySlot: (Player | null)[] = order.map((rank) => seeded[rank] ?? null);

  const totalRounds = Math.log2(size);
  // create all matches, later rounds first won't work; build round 1..final
  const roundMatchIds: string[][] = [];
  for (let r = 1; r <= totalRounds; r++) {
    const count = size / 2 ** r;
    const ids: string[] = [];
    for (let slot = 0; slot < count; slot++) {
      const m = await prisma.tournamentMatch.create({
        data: { tournamentId, stage: 'KO', round: r, slot },
        select: { id: true },
      });
      ids.push(m.id);
    }
    roundMatchIds.push(ids);
  }
  // wire winners forward
  for (let r = 1; r < totalRounds; r++) {
    for (let slot = 0; slot < roundMatchIds[r - 1].length; slot++) {
      const nextId = roundMatchIds[r][Math.floor(slot / 2)];
      await prisma.tournamentMatch.update({
        where: { id: roundMatchIds[r - 1][slot] },
        data: { nextMatchId: nextId, nextSlot: slot % 2 === 0 ? 'A' : 'B' },
      });
    }
  }
  // seed round 1 players
  for (let slot = 0; slot < roundMatchIds[0].length; slot++) {
    const a = bySlot[slot * 2];
    const b = bySlot[slot * 2 + 1];
    await prisma.tournamentMatch.update({
      where: { id: roundMatchIds[0][slot] },
      data: {
        aPlayerId: a?.id ?? null, aName: a ? entryName(a, doubles) : 'Bye',
        bPlayerId: b?.id ?? null, bName: b ? entryName(b, doubles) : 'Bye',
      },
    });
  }
  // optional third-place match (fed by the two semifinal losers)
  if (thirdPlace && totalRounds >= 2) {
    await prisma.tournamentMatch.create({
      data: { tournamentId, stage: 'THIRD', round: totalRounds, slot: 1 },
    });
  }
  // auto-advance byes in round 1
  const r1 = await prisma.tournamentMatch.findMany({ where: { tournamentId, round: 1 } });
  for (const m of r1 as { id: string; aPlayerId: string | null; bPlayerId: string | null; aName: string | null; bName: string | null }[]) {
    const aBye = !m.aPlayerId, bBye = !m.bPlayerId;
    if (aBye !== bBye) {
      const winId = aBye ? m.bPlayerId : m.aPlayerId;
      const winName = aBye ? m.bName : m.aName;
      await advanceWinner(m.id, winId, winName);
    }
  }
}

// ── Pool play (round-robin groups → seeded knockout) ────────────────────────

interface PoolMatchRow {
  aPlayerId: string | null; bPlayerId: string | null;
  aScore: number | null; bScore: number | null; winnerId: string | null;
}

/**
 * Snake-seed players into `poolCount` pools and generate a full round-robin
 * inside each pool. Snake seeding (0,1,2,2,1,0,0,1,…) keeps pools balanced by
 * strength. Pool matches are stage="POOL" with `pool` set; scheduled into
 * parallel rounds via the circle method.
 */
async function generatePools(tournamentId: string, players: Player[], poolCount: number, doubles = false) {
  await prisma.tournamentMatch.deleteMany({ where: { tournamentId } });

  const seeded = [...players].sort((a, b) => (a.seed || 999) - (b.seed || 999));
  const pools: Player[][] = Array.from({ length: poolCount }, () => []);
  // if any entry has an explicit pool, honor the organizer's manual draw (filling
  // any still-unassigned entries into the least-full pool); otherwise snake-seed
  const fits = (p: Player) => (p.pool ?? -1) >= 0 && (p.pool ?? -1) < poolCount;
  const manual = seeded.some(fits);
  if (manual) {
    for (const p of seeded.filter(fits)) pools[p.pool as number].push(p);
    for (const p of seeded.filter((p) => !fits(p))) {
      let mi = 0; for (let k = 1; k < poolCount; k++) if (pools[k].length < pools[mi].length) mi = k;
      pools[mi].push(p);
    }
  } else {
    seeded.forEach((p, i) => {
      const cycle = Math.floor(i / poolCount);
      const pos = i % poolCount;
      const idx = cycle % 2 === 0 ? pos : poolCount - 1 - pos; // snake
      pools[idx].push(p);
    });
  }

  for (let pi = 0; pi < poolCount; pi++) {
    const pool = pools[pi];
    // persist each player's pool assignment
    for (const p of pool) {
      await prisma.tournamentPlayer.update({ where: { id: p.id }, data: { pool: pi } });
    }
    // circle-method round-robin schedule
    const ring = [...pool];
    if (ring.length % 2 === 1) ring.push({ id: '', name: 'Bye', seed: 0 }); // bye placeholder
    const n = ring.length;
    for (let round = 0; round < n - 1; round++) {
      for (let g = 0; g < n / 2; g++) {
        const a = ring[g];
        const b = ring[n - 1 - g];
        if (!a.id || !b.id) continue; // skip bye pairings
        await prisma.tournamentMatch.create({
          data: {
            tournamentId, stage: 'POOL', pool: pi, round: round + 1, slot: g,
            aPlayerId: a.id, aName: entryName(a, doubles), bPlayerId: b.id, bName: entryName(b, doubles),
          },
        });
      }
      // rotate all but the first
      ring.splice(1, 0, ring.pop() as Player);
    }
  }
}

/**
 * Rank a pool using USA Pickleball tiebreakers: match wins, then (for a 2-way
 * tie) head-to-head, then point differential, then points-for, then seed.
 */
function poolStandings(pool: Player[], matches: PoolMatchRow[]) {
  const stat = new Map<string, { wins: number; losses: number; diff: number; pf: number }>();
  for (const p of pool) stat.set(p.id, { wins: 0, losses: 0, diff: 0, pf: 0 });
  for (const m of matches) {
    if (!m.winnerId || !m.aPlayerId || !m.bPlayerId) continue;
    const a = stat.get(m.aPlayerId), b = stat.get(m.bPlayerId);
    const d = (m.aScore ?? 0) - (m.bScore ?? 0);
    if (a) { a.diff += d; a.pf += m.aScore ?? 0; if (m.winnerId === m.aPlayerId) a.wins++; else a.losses++; }
    if (b) { b.diff -= d; b.pf += m.bScore ?? 0; if (m.winnerId === m.bPlayerId) b.wins++; else b.losses++; }
  }
  const headToHead = (xId: string, yId: string): string | null => {
    const m = matches.find((mm) => mm.winnerId &&
      ((mm.aPlayerId === xId && mm.bPlayerId === yId) || (mm.aPlayerId === yId && mm.bPlayerId === xId)));
    return m?.winnerId ?? null;
  };
  const byMetrics = (x: Player, y: Player) => {
    const sx = stat.get(x.id)!, sy = stat.get(y.id)!;
    return sy.diff - sx.diff || sy.pf - sx.pf || (x.seed || 999) - (y.seed || 999);
  };
  // group by wins (desc); within a group, 2-way ties use head-to-head, larger ties use metrics
  const groups = new Map<number, Player[]>();
  for (const p of pool) {
    const w = stat.get(p.id)!.wins;
    (groups.get(w) ?? groups.set(w, []).get(w)!).push(p);
  }
  const ordered: Player[] = [];
  for (const w of [...groups.keys()].sort((a, b) => b - a)) {
    const g = groups.get(w)!;
    if (g.length === 2) {
      const h = headToHead(g[0].id, g[1].id);
      if (h) g.sort((x) => (x.id === h ? -1 : 1));
      else g.sort(byMetrics);
    } else {
      g.sort(byMetrics);
    }
    ordered.push(...g);
  }
  return ordered.map((p, i) => ({ ...p, ...stat.get(p.id)!, rank: i + 1 }));
}

/**
 * After all pool matches are decided, take the top `advancePerPool` from each
 * pool and build a seeded knockout bracket. Qualifiers are ordered by finish
 * rank first (all pool winners, then all runners-up, …) so same-pool players
 * land on opposite sides of the bracket and can only meet again in the final.
 */
async function advanceToKnockout(tournamentId: string): Promise<{ ok: true } | { error: string }> {
  const t = await prisma.tournament.findUniqueOrThrow({
    where: { id: tournamentId },
    select: { poolCount: true, advancePerPool: true, thirdPlace: true, doubles: true },
  });
  const players = await prisma.tournamentPlayer.findMany({ where: { tournamentId } }) as Player[];
  const poolMatches = await prisma.tournamentMatch.findMany({ where: { tournamentId, stage: 'POOL' } });
  if (poolMatches.some((m: { winnerId: string | null }) => !m.winnerId)) {
    return { error: 'finish all pool matches first' };
  }
  const qualifiers: { player: Player; rank: number }[] = [];
  for (let pi = 0; pi < t.poolCount; pi++) {
    const pool = players.filter((p) => p.pool === pi);
    const ranked = poolStandings(pool, poolMatches.filter((m: { pool: number | null }) => m.pool === pi) as PoolMatchRow[]);
    for (const r of ranked.slice(0, t.advancePerPool)) qualifiers.push({ player: r, rank: r.rank });
  }
  if (qualifiers.length < 2) return { error: 'not enough qualifiers' };
  // order by finish rank, then pool → reseed 1..M
  qualifiers.sort((a, b) => a.rank - b.rank || (a.player.pool ?? 0) - (b.player.pool ?? 0));
  const reseeded = qualifiers.map((q, i) => ({ ...q.player, seed: i + 1 }));
  await generateBracket(tournamentId, reseeded, t.thirdPlace, t.doubles);
  return { ok: true };
}

/** Set one slot of a match, then auto-resolve it if it now contains a bye. */
async function fillSlot(matchId: string | null, slot: string | null, playerId: string | null, name: string | null): Promise<void> {
  if (!matchId || (slot !== 'A' && slot !== 'B')) return;
  await prisma.tournamentMatch.update({
    where: { id: matchId },
    data: slot === 'A' ? { aPlayerId: playerId, aName: name } : { bPlayerId: playerId, bName: name },
  });
  await maybeAutoResolve(matchId);
}

/** If a match now pairs a real entry against a bye (or two byes), resolve and cascade. */
async function maybeAutoResolve(matchId: string): Promise<void> {
  const m = await prisma.tournamentMatch.findUniqueOrThrow({ where: { id: matchId } });
  if (m.winnerId) return;
  const aDet = m.aPlayerId != null || m.aName === 'Bye';
  const bDet = m.bPlayerId != null || m.bName === 'Bye';
  if (!aDet || !bDet) return;
  const aReal = m.aPlayerId != null, bReal = m.bPlayerId != null;
  if (aReal && bReal) return; // a real matchup — wait for a reported result
  if (aReal || bReal) {
    const winId = aReal ? m.aPlayerId : m.bPlayerId;
    const winName = aReal ? m.aName : m.bName;
    await prisma.tournamentMatch.update({ where: { id: m.id }, data: { winnerId: winId } });
    await fillSlot(m.nextMatchId, m.nextSlot, winId, winName);
    await fillSlot(m.loserNextMatchId, m.loserNextSlot, null, 'Bye');
  } else {
    await fillSlot(m.nextMatchId, m.nextSlot, null, 'Bye');
    await fillSlot(m.loserNextMatchId, m.loserNextSlot, null, 'Bye');
  }
}

/** Record a real match winner; push the winner forward and (double elim) drop the loser. */
async function advanceWinner(
  matchId: string, winnerId: string | null, winnerName: string | null,
  loserId?: string | null, loserName?: string | null,
): Promise<void> {
  const m = await prisma.tournamentMatch.findUniqueOrThrow({ where: { id: matchId } });
  await prisma.tournamentMatch.update({ where: { id: matchId }, data: { winnerId } });
  await fillSlot(m.nextMatchId, m.nextSlot, winnerId, winnerName);
  if (m.loserNextMatchId && loserId !== undefined) {
    await fillSlot(m.loserNextMatchId, m.loserNextSlot, loserId ?? null, loserName ?? 'Bye');
  }
}

/**
 * Generate a seeded double-elimination bracket: a winners bracket, a losers
 * bracket fed by winners-bracket losers, and a grand final (with a reset game
 * if the losers-bracket champion wins the first grand final). Byes cascade.
 */
async function generateDoubleElim(tournamentId: string, players: Player[], doubles = false) {
  await prisma.tournamentMatch.deleteMany({ where: { tournamentId } });
  const seeded = [...players].sort((a, b) => (a.seed || 999) - (b.seed || 999));
  let size = 1; while (size < seeded.length) size *= 2; size = Math.max(size, 2);
  const order = seedOrder(size);
  const bySlot: (Player | null)[] = order.map((rank) => seeded[rank] ?? null);
  const k = Math.round(Math.log2(size)); // winners-bracket rounds

  const mk = async (stage: string, round: number, slot: number) =>
    (await prisma.tournamentMatch.create({ data: { tournamentId, stage, round, slot }, select: { id: true } })).id;
  const wire = (id: string, data: Record<string, unknown>) => prisma.tournamentMatch.update({ where: { id }, data });

  // winners bracket
  const wb: string[][] = [];
  for (let r = 1; r <= k; r++) {
    const ids: string[] = [];
    for (let s = 0; s < size / 2 ** r; s++) ids.push(await mk('WB', r, s));
    wb.push(ids);
  }
  for (let r = 1; r < k; r++)
    for (let s = 0; s < wb[r - 1].length; s++)
      await wire(wb[r - 1][s], { nextMatchId: wb[r][Math.floor(s / 2)], nextSlot: s % 2 === 0 ? 'A' : 'B' });

  // losers bracket
  const lb: string[][] = [];
  if (size >= 4) {
    const lbRounds = 2 * (k - 1);
    for (let lr = 1; lr <= lbRounds; lr++) {
      const pair = Math.floor((lr - 1) / 2);   // 0,0,1,1,2,2,…
      const count = size / 2 ** (pair + 2);    // R1,R2→size/4; R3,R4→size/8; …
      const ids: string[] = [];
      for (let s = 0; s < count; s++) ids.push(await mk('LB', lr, s));
      lb.push(ids);
    }
    for (let lr = 1; lr < lbRounds; lr++) {
      const cur = lb[lr - 1], nxt = lb[lr];
      const minor = lr % 2 === 1; // odd LB round = minor: winners feed next major's slot A
      for (let s = 0; s < cur.length; s++) {
        if (minor) await wire(cur[s], { nextMatchId: nxt[s], nextSlot: 'A' });
        else await wire(cur[s], { nextMatchId: nxt[Math.floor(s / 2)], nextSlot: s % 2 === 0 ? 'A' : 'B' });
      }
    }
    // winners-bracket losers drop into the losers bracket
    for (let s = 0; s < wb[0].length; s++)
      await wire(wb[0][s], { loserNextMatchId: lb[0][Math.floor(s / 2)], loserNextSlot: s % 2 === 0 ? 'A' : 'B' });
    for (let i = 2; i <= k; i++) {
      const major = lb[2 * (i - 1) - 1];
      for (let s = 0; s < wb[i - 1].length; s++)
        await wire(wb[i - 1][s], { loserNextMatchId: major[s], loserNextSlot: 'B' });
    }
  }

  // grand final (+ reset game 2)
  const gf1 = await mk('GF', 1, 0);
  await mk('GF', 2, 0);
  await wire(wb[k - 1][0], { nextMatchId: gf1, nextSlot: 'A' });
  if (size >= 4) await wire(lb[lb.length - 1][0], { nextMatchId: gf1, nextSlot: 'B' });
  else await wire(wb[0][0], { loserNextMatchId: gf1, loserNextSlot: 'B' });

  // seed winners round 1 (byes cascade through both brackets)
  for (let s = 0; s < wb[0].length; s++) {
    const a = bySlot[s * 2], b = bySlot[s * 2 + 1];
    await fillSlot(wb[0][s], 'A', a?.id ?? null, a ? entryName(a, doubles) : 'Bye');
    await fillSlot(wb[0][s], 'B', b?.id ?? null, b ? entryName(b, doubles) : 'Bye');
  }
}

export function tournamentRoutes(app: FastifyInstance, io?: Server) {
  // list this club's tournaments (Venue Pro)
  app.get('/tournaments', { preHandler: requireRole(...HOSTS) }, async (req, reply) => {
    const gate = await requirePro(req.user as AuthUser & { name?: string });
    if (gate) return reply.code(402).send({ error: gate });
    const club = await callerClub(req.user as AuthUser & { name?: string });
    return prisma.tournament.findMany({
      where: { clubId: club.id },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { players: true } } },
    });
  });

  // public tournament view (bracket)
  app.get<{ Params: { id: string } }>('/tournaments/:id', async (req, reply) => {
    const t = await prisma.tournament.findUnique({
      where: { id: req.params.id },
      include: {
        club: { select: { name: true } },
        players: { orderBy: { seed: 'asc' } },
        matches: { orderBy: [{ round: 'asc' }, { slot: 'asc' }] },
      },
    });
    if (!t) return reply.code(404).send({ error: 'not found' });
    return t;
  });

  app.post<{ Body: { name?: string; thirdPlace?: boolean; format?: string; poolCount?: number; advancePerPool?: number; doubles?: boolean; bestOf?: number } }>(
    '/tournaments',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      const gate = await requirePro(req.user as AuthUser & { name?: string });
      if (gate) return reply.code(402).send({ error: gate });
      const club = await callerClub(req.user as AuthUser & { name?: string });
      const raw = req.body.format;
      const format = raw === 'POOLS_KO' ? 'POOLS_KO' : raw === 'DOUBLE_ELIM' ? 'DOUBLE_ELIM' : 'SINGLE_ELIM';
      const bestOf = [1, 3, 5].includes(req.body.bestOf ?? 1) ? (req.body.bestOf as number) : 1;
      return prisma.tournament.create({
        data: {
          clubId: club.id,
          name: req.body.name?.trim() || 'Tournament',
          thirdPlace: format === 'DOUBLE_ELIM' ? false : (req.body.thirdPlace ?? false),
          format,
          poolCount: format === 'POOLS_KO' ? Math.max(2, Math.min(8, req.body.poolCount ?? 2)) : 0,
          advancePerPool: Math.max(1, Math.min(4, req.body.advancePerPool ?? 2)),
          doubles: !!req.body.doubles,
          bestOf,
          createdById: (req.user as AuthUser).id,
        },
      });
    },
  );

  async function ownTournament(id: string, user: AuthUser): Promise<boolean> {
    if (user.role === 'ADMIN') return true;
    const t = await prisma.tournament.findUnique({ where: { id }, select: { createdById: true } });
    return t?.createdById === user.id;
  }

  // add an entry (player, or a doubles team via partner)
  app.post<{ Params: { id: string }; Body: { name: string; partner?: string; userId?: string; seed?: number } }>(
    '/tournaments/:id/players',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      const t = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, select: { status: true, doubles: true, _count: { select: { players: true } } } });
      if (t.status !== 'SETUP') return reply.code(400).send({ error: 'bracket already started' });
      if (!req.body.name?.trim()) return reply.code(400).send({ error: 'name required' });
      return prisma.tournamentPlayer.create({
        data: {
          tournamentId: req.params.id,
          name: req.body.name.trim(),
          partner: t.doubles ? (req.body.partner?.trim() || null) : null,
          userId: req.body.userId ?? null,
          seed: req.body.seed ?? (t._count.players + 1),
        },
      });
    },
  );

  app.delete<{ Params: { id: string; playerId: string } }>(
    '/tournaments/:id/players/:playerId',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      await prisma.tournamentPlayer.delete({ where: { id: req.params.playerId } });
      return { ok: true };
    },
  );

  // rename the tournament
  app.patch<{ Params: { id: string }; Body: { name?: string } }>(
    '/tournaments/:id',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      const name = req.body.name?.trim();
      if (!name) return reply.code(400).send({ error: 'name required' });
      await prisma.tournament.update({ where: { id: req.params.id }, data: { name } });
      await emitTournament(io, req.params.id);
      return prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, include: tournamentInclude });
    },
  );

  // rename an entry (name / partner) — only before the bracket starts
  app.patch<{ Params: { id: string; playerId: string }; Body: { name?: string; partner?: string } }>(
    '/tournaments/:id/players/:playerId',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      const t = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, select: { status: true, doubles: true } });
      if (t.status !== 'SETUP') return reply.code(400).send({ error: 'bracket already started' });
      const data: { name?: string; partner?: string | null } = {};
      if (req.body.name?.trim()) data.name = req.body.name.trim();
      if (t.doubles) data.partner = req.body.partner?.trim() || null;
      await prisma.tournamentPlayer.update({ where: { id: req.params.playerId }, data });
      return prisma.tournamentPlayer.findUniqueOrThrow({ where: { id: req.params.playerId } });
    },
  );

  // reorder seeds from an ordered list of player ids (drag-and-drop)
  app.post<{ Params: { id: string }; Body: { order: string[] } }>(
    '/tournaments/:id/reorder',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      const t = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, select: { status: true } });
      if (t.status !== 'SETUP') return reply.code(400).send({ error: 'bracket already started' });
      await Promise.all((req.body.order ?? []).map((pid, i) =>
        prisma.tournamentPlayer.update({ where: { id: pid }, data: { seed: i + 1 } })));
      return { ok: true };
    },
  );

  // set explicit pool assignments (drag players between pools); pool = 0-based, -1 clears
  app.post<{ Params: { id: string }; Body: { assignments: { playerId: string; pool: number }[] } }>(
    '/tournaments/:id/pools',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      const t = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, select: { status: true } });
      if (t.status !== 'SETUP') return reply.code(400).send({ error: 'bracket already started' });
      await Promise.all((req.body.assignments ?? []).map((a) =>
        prisma.tournamentPlayer.update({ where: { id: a.playerId }, data: { pool: a.pool } })));
      return { ok: true };
    },
  );

  // start: generate the bracket (or pools) and go LIVE
  app.post<{ Params: { id: string } }>(
    '/tournaments/:id/start',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      const players = await prisma.tournamentPlayer.findMany({ where: { tournamentId: req.params.id } });
      if (players.length < 2) return reply.code(400).send({ error: 'add at least 2 players' });
      const t = await prisma.tournament.findUniqueOrThrow({
        where: { id: req.params.id },
        select: { thirdPlace: true, format: true, poolCount: true, doubles: true },
      });
      if (t.format === 'POOLS_KO') {
        if (players.length < t.poolCount * 2) {
          return reply.code(400).send({ error: `need at least ${t.poolCount * 2} players for ${t.poolCount} pools` });
        }
        await generatePools(req.params.id, players as Player[], t.poolCount, t.doubles);
      } else if (t.format === 'DOUBLE_ELIM') {
        await generateDoubleElim(req.params.id, players as Player[], t.doubles);
      } else {
        await generateBracket(req.params.id, players as Player[], t.thirdPlace, t.doubles);
      }
      await prisma.tournament.update({ where: { id: req.params.id }, data: { status: 'LIVE', startsAt: new Date() } });
      await emitTournament(io, req.params.id);
      return prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, include: tournamentInclude });
    },
  );

  // advance from pool play into the seeded knockout bracket
  app.post<{ Params: { id: string } }>(
    '/tournaments/:id/knockout',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      const res = await advanceToKnockout(req.params.id);
      if ('error' in res) return reply.code(400).send(res);
      await emitTournament(io, req.params.id);
      return prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, include: tournamentInclude });
    },
  );

  // report a bracket match result (single game, best-of-N games, or explicit winner)
  app.post<{ Params: { id: string; matchId: string }; Body: { winnerId?: string; a?: number; b?: number; games?: Game[] } }>(
    '/tournaments/:id/matches/:matchId/win',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      const m = await prisma.tournamentMatch.findUniqueOrThrow({ where: { id: req.params.matchId } });
      if (m.tournamentId !== req.params.id) return reply.code(400).send({ error: 'match not in this tournament' });
      const tour = await prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, select: { format: true, bestOf: true } });

      // resolve the result: from per-game scores, a single game, or an explicit winnerId
      let winnerId: string | null;
      let aScore: number | null = m.aScore, bScore: number | null = m.bScore;
      let gamesJson: Game[] | undefined;
      if ((req.body.games && req.body.games.length) || req.body.a != null) {
        const bestOf = ['WB', 'LB', 'GF', 'KO', 'THIRD'].includes(m.stage) ? tour.bestOf : 1;
        const dec = decideBracket(req.body.games, req.body.a, req.body.b, bestOf);
        if (!dec) return reply.code(400).send({ error: 'the scores do not decide this match' });
        winnerId = dec.side === 'A' ? m.aPlayerId : m.bPlayerId;
        aScore = dec.aScore; bScore = dec.bScore; gamesJson = dec.games;
      } else {
        winnerId = req.body.winnerId ?? null;
      }
      if (winnerId !== m.aPlayerId && winnerId !== m.bPlayerId) {
        return reply.code(400).send({ error: 'winner must be one of the two entries' });
      }
      const winName = winnerId === m.aPlayerId ? m.aName : m.bName;
      const loserId = winnerId === m.aPlayerId ? m.bPlayerId : m.aPlayerId;
      const loserName = winnerId === m.aPlayerId ? m.bName : m.aName;
      await prisma.tournamentMatch.update({
        where: { id: m.id },
        data: { aScore, bScore, ...(gamesJson ? { games: gamesJson as object } : {}) },
      });

      if (m.stage === 'GF') {
        // grand final: WB champ (slot A) needs one win; LB champ (slot B) must win twice (reset)
        await prisma.tournamentMatch.update({ where: { id: m.id }, data: { winnerId } });
        if (m.round === 1 && winnerId === m.bPlayerId) {
          const gf2 = await prisma.tournamentMatch.findFirst({ where: { tournamentId: req.params.id, stage: 'GF', round: 2 } });
          if (gf2) await prisma.tournamentMatch.update({
            where: { id: gf2.id },
            data: { aPlayerId: m.aPlayerId, aName: m.aName, bPlayerId: m.bPlayerId, bName: m.bName },
          });
        } else {
          await prisma.tournament.update({ where: { id: req.params.id }, data: { status: 'DONE' } });
        }
      } else if (m.stage === 'WB' || m.stage === 'LB') {
        await advanceWinner(m.id, winnerId, winName ?? null, loserId, loserName ?? null);
      } else {
        // single-elimination knockout (KO) + optional third-place
        await advanceWinner(m.id, winnerId, winName ?? null);
        const totalRounds = Math.max(...(await prisma.tournamentMatch.findMany({ where: { tournamentId: req.params.id, stage: 'KO' }, select: { round: true } })).map((x: { round: number }) => x.round), 1);
        if (m.stage === 'KO' && m.round === totalRounds - 1 && loserId) {
          const third = await prisma.tournamentMatch.findFirst({ where: { tournamentId: req.params.id, stage: 'THIRD' } });
          if (third) await prisma.tournamentMatch.update({
            where: { id: third.id },
            data: !third.aPlayerId ? { aPlayerId: loserId, aName: loserName } : { bPlayerId: loserId, bName: loserName },
          });
        }
        const all = await prisma.tournamentMatch.findMany({ where: { tournamentId: req.params.id } });
        const finalMatch = (all as { stage: string; round: number; winnerId: string | null }[]).find((x) => x.stage === 'KO' && x.round === totalRounds);
        const thirdDone = (all as { stage: string; winnerId: string | null }[]).filter((x) => x.stage === 'THIRD').every((x) => x.winnerId);
        if (finalMatch?.winnerId && thirdDone) {
          await prisma.tournament.update({ where: { id: req.params.id }, data: { status: 'DONE' } });
        }
      }
      await emitTournament(io, req.params.id);
      return prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, include: tournamentInclude });
    },
  );

  // set a POOL match score inline; winner is derived from the score (tie clears it)
  app.post<{ Params: { id: string; matchId: string }; Body: { a?: number; b?: number } }>(
    '/tournaments/:id/matches/:matchId/score',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      const m = await prisma.tournamentMatch.findUniqueOrThrow({ where: { id: req.params.matchId } });
      if (m.tournamentId !== req.params.id) return reply.code(400).send({ error: 'match not in this tournament' });
      if (m.stage !== 'POOL') return reply.code(400).send({ error: 'use the win endpoint for bracket matches' });
      const a = Math.max(0, Math.floor(req.body.a ?? 0));
      const b = Math.max(0, Math.floor(req.body.b ?? 0));
      const winnerId = a > b ? m.aPlayerId : b > a ? m.bPlayerId : null;
      await prisma.tournamentMatch.update({ where: { id: m.id }, data: { aScore: a, bScore: b, winnerId } });
      await emitTournament(io, req.params.id);
      return prisma.tournament.findUniqueOrThrow({ where: { id: req.params.id }, include: tournamentInclude });
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/tournaments/:id',
    { preHandler: requireRole(...HOSTS) },
    async (req, reply) => {
      if (!(await ownTournament(req.params.id, req.user as AuthUser))) return reply.code(403).send({ error: 'not your tournament' });
      await prisma.tournamentMatch.deleteMany({ where: { tournamentId: req.params.id } });
      await prisma.tournamentPlayer.deleteMany({ where: { tournamentId: req.params.id } });
      await prisma.tournament.delete({ where: { id: req.params.id } });
      return { ok: true };
    },
  );
}
