'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { io as socketIo } from 'socket.io-client';
import { API, api, getUser } from '@/lib/api';
import { TopNav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { LabeledField } from '@/components/labeled-field';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Stack, TextField, Typography,
} from '@mui/material';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

interface TPlayer { id: string; name: string; partner: string | null; seed: number; pool: number }
interface TMatch {
  id: string; stage: string; pool: number | null; round: number; slot: number;
  aPlayerId: string | null; bPlayerId: string | null;
  aName: string | null; bName: string | null;
  aScore: number | null; bScore: number | null; games: { a: number; b: number }[] | null; winnerId: string | null;
}
type Format = 'SINGLE_ELIM' | 'DOUBLE_ELIM' | 'POOLS_KO';
interface Tournament {
  id: string; name: string; status: 'SETUP' | 'LIVE' | 'DONE'; thirdPlace: boolean;
  format: Format; poolCount: number; advancePerPool: number; doubles: boolean; bestOf: number;
  createdById: string | null; players: TPlayer[]; matches: TMatch[];
  club?: { name: string };
}

/** Rank a pool by wins, then point differential, then seed (mirrors the API). */
function standings(pool: TPlayer[], matches: TMatch[]) {
  const stat = new Map<string, { wins: number; losses: number; diff: number }>();
  for (const p of pool) stat.set(p.id, { wins: 0, losses: 0, diff: 0 });
  for (const m of matches) {
    if (!m.winnerId || !m.aPlayerId || !m.bPlayerId) continue;
    const a = stat.get(m.aPlayerId), b = stat.get(m.bPlayerId);
    const d = (m.aScore ?? 0) - (m.bScore ?? 0);
    if (a) { a.diff += d; if (m.winnerId === m.aPlayerId) a.wins++; else a.losses++; }
    if (b) { b.diff -= d; if (m.winnerId === m.bPlayerId) b.wins++; else b.losses++; }
  }
  return [...pool].sort((x, y) => {
    const sx = stat.get(x.id)!, sy = stat.get(y.id)!;
    return sy.wins - sx.wins || sy.diff - sx.diff || (x.seed || 999) - (y.seed || 999);
  }).map((p, i) => ({ ...p, ...stat.get(p.id)!, rank: i + 1 }));
}

/** Standard bracket seeding order for size n (power of two) — mirrors the API. */
function seedOrder(n: number): number[] {
  let rounds = [0, 1];
  while (rounds.length < n) {
    const next: number[] = [];
    const top = rounds.length * 2 - 1;
    for (const s of rounds) { next.push(s); next.push(top - s); }
    rounds = next;
  }
  return rounds;
}

/** Preview the first-round matchups a seeded bracket would produce (client-only). */
function previewRound1(players: TPlayer[]): [TPlayer | null, TPlayer | null][] {
  if (players.length < 2) return [];
  let size = 1;
  while (size < players.length) size *= 2;
  size = Math.max(size, 2);
  const order = seedOrder(size);
  const bySlot = order.map((rank) => players[rank] ?? null);
  const pairs: [TPlayer | null, TPlayer | null][] = [];
  for (let s = 0; s < size / 2; s++) pairs.push([bySlot[2 * s], bySlot[2 * s + 1]]);
  return pairs;
}

/** Preview the snake-seeded pool draw (client-only, mirrors the API). */
function previewPools(players: TPlayer[], poolCount: number): TPlayer[][] {
  const pools: TPlayer[][] = Array.from({ length: poolCount }, () => []);
  players.forEach((p, i) => {
    const cycle = Math.floor(i / poolCount);
    const pos = i % poolCount;
    const idx = cycle % 2 === 0 ? pos : poolCount - 1 - pos;
    pools[idx].push(p);
  });
  return pools;
}

export default function BracketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [t, setT] = useState<Tournament | null>(null);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newPartner, setNewPartner] = useState('');
  // inline editing + drag-and-drop
  const [editTitle, setEditTitle] = useState<string | null>(null);
  const [editPid, setEditPid] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<{ name: string; partner: string }>({ name: '', partner: '' });
  const [dragId, setDragId] = useState<string | null>(null);
  const [scoreFor, setScoreFor] = useState<TMatch | null>(null);
  const [gameRows, setGameRows] = useState<{ a: string; b: string }[]>([]);
  // optimistic pool-match scores, keyed by match id (so rapid +/- taps accumulate)
  const [poolScores, setPoolScores] = useState<Record<string, { a: number; b: number }>>({});
  const me = getUser();

  const load = useCallback(() => {
    api<Tournament>(`/tournaments/${id}`).then(setT).catch((e) => setError(e.message));
  }, [id]);

  // initial fetch + live updates over Socket.IO
  useEffect(() => {
    load();
    const socket = socketIo(API);
    socket.emit('join-tournament', id);
    socket.on('tournament', (data: Tournament) => setT(data));
    return () => { socket.disconnect(); };
  }, [id, load]);

  if (error) return <><TopNav /><Box p={3}><Typography color="error">{error}</Typography></Box></>;
  if (!t) return <><TopNav /><Box p={3}><Typography>Loading…</Typography></Box></>;

  const isOwner = !!me && (me.role === 'ADMIN' || me.id === t.createdById);

  async function addPlayer() {
    if (!newName.trim()) return;
    try {
      await api(`/tournaments/${id}/players`, { method: 'POST', json: { name: newName.trim(), partner: newPartner.trim() || undefined } });
      setNewName(''); setNewPartner(''); load();
    } catch (e) { setError((e as Error).message); }
  }
  async function removePlayer(pid: string) {
    try { await api(`/tournaments/${id}/players/${pid}`, { method: 'DELETE' }); load(); }
    catch (e) { setError((e as Error).message); }
  }
  async function saveTitle() {
    const name = (editTitle ?? '').trim();
    setEditTitle(null);
    if (!name || name === t?.name) return;
    try { setT(await api<Tournament>(`/tournaments/${id}`, { method: 'PATCH', json: { name } })); }
    catch (e) { setError((e as Error).message); }
  }
  async function savePlayerEdit() {
    const pid = editPid;
    setEditPid(null);
    if (!pid || !editVals.name.trim()) return;
    try { await api(`/tournaments/${id}/players/${pid}`, { method: 'PATCH', json: { name: editVals.name.trim(), partner: editVals.partner.trim() } }); load(); }
    catch (e) { setError((e as Error).message); }
  }
  /** Drop the dragged player at the target's position (reorders seeds). */
  async function reorderTo(targetId: string) {
    const src = dragId; setDragId(null);
    if (!src || !t || src === targetId) return;
    const ids = [...t.players].sort((a, b) => a.seed - b.seed).map((p) => p.id);
    const from = ids.indexOf(src); const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1); ids.splice(to, 0, src);
    try { await api(`/tournaments/${id}/reorder`, { method: 'POST', json: { order: ids } }); load(); }
    catch (e) { setError((e as Error).message); }
  }
  /** Move the dragged player into a pool (persists a full manual pool draw). */
  async function assignPool(targetPool: number, currentLayout: TPlayer[][]) {
    const src = dragId; setDragId(null);
    if (!src) return;
    const next = currentLayout.map((pool) => pool.filter((p) => p.id !== src));
    const moved = t?.players.find((p) => p.id === src);
    if (moved) next[targetPool].push(moved);
    const assignments: { playerId: string; pool: number }[] = [];
    next.forEach((pool, pi) => pool.forEach((p) => assignments.push({ playerId: p.id, pool: pi })));
    try { await api(`/tournaments/${id}/pools`, { method: 'POST', json: { assignments } }); load(); }
    catch (e) { setError((e as Error).message); }
  }
  /** Clear manual pools → revert to automatic snake seeding. */
  async function autoSeedPools() {
    if (!t) return;
    const assignments = t.players.map((p) => ({ playerId: p.id, pool: -1 }));
    try { await api(`/tournaments/${id}/pools`, { method: 'POST', json: { assignments } }); load(); }
    catch (e) { setError((e as Error).message); }
  }
  async function start() {
    try { setT(await api<Tournament>(`/tournaments/${id}/start`, { method: 'POST' })); }
    catch (e) { setError((e as Error).message); }
  }
  async function toKnockout() {
    try { setT(await api<Tournament>(`/tournaments/${id}/knockout`, { method: 'POST' })); }
    catch (e) { setError((e as Error).message); }
  }
  const bestOf = Math.max(1, t.bestOf);
  const gamesNeeded = Math.floor(bestOf / 2) + 1;
  /** Count games won per side from the dialog rows. */
  function tallyGames(rows: { a: string; b: string }[]) {
    let wa = 0, wb = 0;
    for (const r of rows) {
      if (r.a === '' || r.b === '') continue;
      const a = Number(r.a), b = Number(r.b);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) continue;
      if (a > b) wa++; else wb++;
    }
    return { wa, wb };
  }
  /** Open the score dialog for a match; single game pre-marks the tapped leader. */
  function openScore(m: TMatch, presumedWinnerId: string) {
    const rows = Array.from({ length: bestOf }, () => ({ a: '', b: '' }));
    if (bestOf === 1) rows[0] = { a: presumedWinnerId === m.aPlayerId ? '11' : '', b: presumedWinnerId === m.bPlayerId ? '11' : '' };
    setGameRows(rows);
    setScoreFor(m);
  }
  async function saveScore() {
    if (!scoreFor) return;
    const { wa, wb } = tallyGames(gameRows);
    if (wa < gamesNeeded && wb < gamesNeeded) return;
    const games = gameRows
      .map((r) => ({ a: Number(r.a), b: Number(r.b) }))
      .filter((g) => Number.isFinite(g.a) && Number.isFinite(g.b) && !(g.a === 0 && g.b === 0) && g.a !== g.b);
    const mid = scoreFor.id;
    setScoreFor(null);
    try { setT(await api<Tournament>(`/tournaments/${id}/matches/${mid}/win`, { method: 'POST', json: { games } })); }
    catch (e) { setError((e as Error).message); }
  }
  const setRow = (i: number, side: 'a' | 'b', v: string) =>
    setGameRows((rows) => rows.map((r, j) => (j === i ? { ...r, [side]: v } : r)));

  /** Current score for a pool match: optimistic local value, else the server's. */
  function poolScoreOf(m: TMatch) {
    return poolScores[m.id] ?? { a: m.aScore ?? 0, b: m.bScore ?? 0 };
  }
  /** Nudge one side of a pool-match score by ±1 and persist (winner derived server-side). */
  async function bump(m: TMatch, side: 'a' | 'b', delta: number) {
    const cur = poolScoreOf(m);
    const next = { a: cur.a, b: cur.b, [side]: Math.max(0, cur[side] + delta) } as { a: number; b: number };
    setPoolScores((s) => ({ ...s, [m.id]: next }));
    try { setT(await api<Tournament>(`/tournaments/${id}/matches/${m.id}/score`, { method: 'POST', json: next })); }
    catch (e) { setError((e as Error).message); }
  }

  const poolMatches = t.matches.filter((m) => m.stage === 'POOL');
  const ko = t.matches.filter((m) => m.stage === 'KO');
  const wbMatches = t.matches.filter((m) => m.stage === 'WB');
  const lbMatches = t.matches.filter((m) => m.stage === 'LB');
  const gfMatches = t.matches.filter((m) => m.stage === 'GF').sort((a, b) => a.round - b.round);
  const third = t.matches.find((m) => m.stage === 'THIRD');
  const isPools = t.format === 'POOLS_KO';
  const isDouble = t.format === 'DOUBLE_ELIM';
  const hasKO = ko.length > 0;
  const hasBracket = hasKO || wbMatches.length > 0;
  const poolsAllDone = poolMatches.length > 0 && poolMatches.every((m) => m.winnerId);

  const nameForWinner = (m: TMatch) =>
    m.winnerId ? [m.aName, m.bName][[m.aPlayerId, m.bPlayerId].indexOf(m.winnerId)] : null;
  const koFinal = ko.length ? ko.reduce((a, b) => (a.round >= b.round ? a : b)) : null;
  const decidedGf = gfMatches.filter((m) => m.winnerId).sort((a, b) => b.round - a.round)[0];
  const champion = decidedGf ? nameForWinner(decidedGf) : koFinal?.winnerId ? nameForWinner(koFinal) : null;

  const canWin = (m: TMatch) =>
    isOwner && t.status !== 'DONE' && !m.winnerId && !!m.aPlayerId && !!m.bPlayerId;

  const CARD_W = 236;
  const MatchCard = ({ m, width = CARD_W, highlight = false }: { m: TMatch; width?: number; highlight?: boolean }) => {
    const rowSx = (pid: string | null, isWinner: boolean) => ({
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.75,
      px: 1.5, py: 1.15, borderRadius: '9px',
      bgcolor: isWinner ? '#e4f1dd' : '#f7faf5',
      border: `1px solid ${isWinner ? '#a9d29a' : '#eef2ec'}`,
      cursor: canWin(m) ? 'pointer' : 'default',
      opacity: pid ? 1 : 0.55,
      transition: 'background 120ms ease',
      '&:hover': canWin(m) ? { bgcolor: '#eaf4e4' } : {},
    });
    const scoreChip = (score: number | null, isWinner: boolean) =>
      score == null ? null : (
        <Box sx={{
          minWidth: 20, textAlign: 'center', fontSize: '0.9rem', fontWeight: 800,
          color: isWinner ? '#2f6b2b' : 'rgba(28,42,26,0.5)',
        }}>{score}</Box>
      );
    const row = (pid: string | null, name: string | null, score: number | null) => {
      const isWinner = m.winnerId === pid;
      return (
        <Box onClick={() => canWin(m) && pid && openScore(m, pid)} sx={rowSx(pid, isWinner)}>
          <Typography noWrap sx={{ flex: 1, fontSize: '0.92rem', fontWeight: isWinner ? 800 : 700 }}>{name ?? '—'}</Typography>
          {isWinner && <EmojiEventsIcon sx={{ fontSize: 16, color: '#e8a531' }} />}
          {scoreChip(score, isWinner)}
        </Box>
      );
    };
    return (
      <Box sx={{
        width, bgcolor: '#fff', borderRadius: '14px', p: 1,
        border: `${highlight ? 2 : 1}px solid ${highlight ? '#7bbf6a' : '#e7efe2'}`,
        boxShadow: highlight ? '0 0 0 4px rgba(123,191,106,0.12)' : 'none',
        display: 'flex', flexDirection: 'column',
      }}>
        {row(m.aPlayerId, m.aName, m.aScore)}
        {/* vs divider */}
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1, py: 0.35 }}>
          <Box sx={{ flex: 1, borderTop: '1px dashed #d5e2ce' }} />
          <Typography sx={{ fontSize: '0.66rem', fontWeight: 800, letterSpacing: '0.06em', color: 'rgba(28,42,26,0.38)' }}>vs</Typography>
          <Box sx={{ flex: 1, borderTop: '1px dashed #d5e2ce' }} />
        </Stack>
        {row(m.bPlayerId, m.bName, m.bScore)}
      </Box>
    );
  };

  // Round labels per bracket type.
  const koName = (r: number, max: number) => {
    const e = max - r;
    return e === 0 ? 'Final' : e === 1 ? 'Semifinals' : e === 2 ? 'Quarterfinals' : `Round ${r}`;
  };
  const wbName = (r: number, max: number) => {
    const e = max - r;
    return e === 0 ? 'Winners Final' : e === 1 ? 'Winners Semis' : `Winners R${r}`;
  };
  const lbName = (r: number, max: number) => (r === max ? 'Losers Final' : `Losers R${r}`);

  /** Round-column bracket with optional elbow connectors between rounds. */
  const BracketColumns = ({ matches, connectors, roundLabel, highlightLastRound, labelColor = '#2f5d2b' }: {
    matches: TMatch[]; connectors: boolean; roundLabel: (r: number, max: number) => string;
    highlightLastRound?: boolean; labelColor?: string;
  }) => {
    const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
    if (!rounds.length) return null;
    const maxR = rounds[rounds.length - 1];
    return (
      <Box sx={{ overflowX: 'auto', pb: 2 }}>
        <Box sx={{ display: 'flex', gap: '52px', minWidth: 'min-content', alignItems: 'stretch' }}>
          {rounds.map((r, ri) => {
            const feeds = connectors && ri < rounds.length - 1;
            const receives = connectors && ri > 0;
            const ms = matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot);
            return (
              <Box key={r} sx={{ display: 'flex', flexDirection: 'column' }}>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: labelColor, mb: 1.5, pl: 0.5 }}>
                  {roundLabel(r, maxR)}
                </Typography>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
                  {ms.map((m, mi) => {
                    const isTop = mi % 2 === 0;
                    const line = '2px solid #cbe0c1';
                    return (
                      <Box key={m.id} sx={{
                        position: 'relative', flex: 1, py: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        ...(feeds && { '&::after': { content: '""', position: 'absolute', left: '100%', width: '26px', height: '50%', borderRight: line, ...(isTop ? { top: '50%', borderTop: line } : { bottom: '50%', borderBottom: line }) } }),
                        ...(receives && { '&::before': { content: '""', position: 'absolute', right: '100%', width: '26px', top: '50%', borderTop: line } }),
                      }}>
                        <MatchCard m={m} highlight={!!highlightLastRound && r === maxR && !!m.aPlayerId && !!m.bPlayerId} />
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  };

  const PoolBlock = ({ pi }: { pi: number }) => {
    const pool = t.players.filter((p) => p.pool === pi);
    const pms = poolMatches.filter((m) => m.pool === pi);
    const ranked = standings(pool, pms);
    const cut = t.advancePerPool;
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
          <Typography variant="h6" fontWeight={800} mb={1.5}>Pool {String.fromCharCode(65 + pi)}</Typography>
          {/* standings */}
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" sx={{ px: 1, pb: 0.5, color: 'rgba(28,42,26,0.5)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em' }}>
              <Box sx={{ width: 22 }}>#</Box>
              <Box sx={{ flex: 1 }}>PLAYER</Box>
              <Box sx={{ width: 34, textAlign: 'center' }}>W</Box>
              <Box sx={{ width: 34, textAlign: 'center' }}>L</Box>
              <Box sx={{ width: 40, textAlign: 'right' }}>DIFF</Box>
            </Stack>
            <Stack spacing={0.5}>
              {ranked.map((p) => {
                const advancing = p.rank <= cut;
                return (
                  <Stack key={p.id} direction="row" alignItems="center" sx={{
                    px: 1, py: 0.75, borderRadius: '8px',
                    bgcolor: advancing ? '#e9f4e3' : '#f7faf5',
                    border: `1px solid ${advancing ? '#bcdcae' : '#eef2ec'}`,
                  }}>
                    <Box sx={{ width: 22, fontWeight: 800, color: advancing ? '#2f6b2b' : 'rgba(28,42,26,0.45)' }}>{p.rank}</Box>
                    <Typography noWrap sx={{ flex: 1, fontWeight: 700, fontSize: '0.88rem' }}>{p.name}</Typography>
                    <Box sx={{ width: 34, textAlign: 'center', fontWeight: 800, color: '#2f6b2b' }}>{p.wins}</Box>
                    <Box sx={{ width: 34, textAlign: 'center', color: 'rgba(28,42,26,0.5)' }}>{p.losses}</Box>
                    <Box sx={{ width: 40, textAlign: 'right', fontWeight: 700, color: p.diff > 0 ? '#2f6b2b' : p.diff < 0 ? '#a04a35' : 'rgba(28,42,26,0.5)' }}>
                      {p.diff > 0 ? `+${p.diff}` : p.diff}
                    </Box>
                  </Stack>
                );
              })}
            </Stack>
            {!hasKO && (
              <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.5)', mt: 0.75, display: 'block' }}>
                Top {cut} advance (highlighted).
              </Typography>
            )}
          </Box>
          {/* matches — inline +/- score steppers */}
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2f5d2b', mb: 1 }}>
            Matches
          </Typography>
          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
            {pms.map((m) => <PoolMatchCard key={m.id} m={m} />)}
          </Box>
        </CardContent>
      </Card>
    );
  };

  const stepBtnSx = {
    width: 28, height: 28, borderRadius: '8px', border: '1px solid #cfe0c6', color: '#2f6b2b',
    '&:hover': { bgcolor: '#eef4e9', borderColor: '#a9d29a' },
    '&.Mui-disabled': { opacity: 0.4, borderColor: '#e3ebe0' },
  };
  const PoolMatchCard = ({ m }: { m: TMatch }) => {
    const sc = poolScoreOf(m);
    const decided = sc.a !== sc.b;
    const editable = isOwner && t.status !== 'DONE';
    const stepRow = (side: 'a' | 'b', pid: string | null, name: string | null, val: number, isWin: boolean) => (
      <Stack direction="row" alignItems="center" spacing={1} sx={{
        px: 1.25, py: 0.85, borderRadius: '9px',
        bgcolor: isWin ? '#e4f1dd' : '#f7faf5',
        border: `1px solid ${isWin ? '#a9d29a' : '#eef2ec'}`, opacity: pid ? 1 : 0.55,
      }}>
        <Typography noWrap sx={{ flex: 1, fontWeight: isWin ? 800 : 700, fontSize: '0.9rem' }}>{name ?? '—'}</Typography>
        {isWin && <EmojiEventsIcon sx={{ fontSize: 15, color: '#e8a531' }} />}
        <IconButton size="small" disableRipple disabled={!editable || val <= 0} onClick={() => bump(m, side, -1)} sx={stepBtnSx}><RemoveIcon sx={{ fontSize: 16 }} /></IconButton>
        <Typography sx={{ minWidth: 18, textAlign: 'center', fontWeight: 800, fontSize: '0.98rem' }}>{val}</Typography>
        <IconButton size="small" disableRipple disabled={!editable} onClick={() => bump(m, side, 1)} sx={stepBtnSx}><AddIcon sx={{ fontSize: 16 }} /></IconButton>
      </Stack>
    );
    return (
      <Box sx={{ bgcolor: '#fff', border: '1px solid #e7efe2', borderRadius: '14px', p: 1, display: 'flex', flexDirection: 'column' }}>
        {stepRow('a', m.aPlayerId, m.aName, sc.a, decided && sc.a > sc.b)}
        <Box sx={{ borderTop: '1px dashed #d5e2ce', mx: 1, my: 0.4 }} />
        {stepRow('b', m.bPlayerId, m.bName, sc.b, decided && sc.b > sc.a)}
      </Box>
    );
  };

  // Read-only preview shown while adding players (mirrors the seeding the API will use).
  const PreviewMatch = ({ a, b }: { a: TPlayer | null; b: TPlayer | null }) => {
    const prow = (p: TPlayer | null) => (
      <Box sx={{
        display: 'flex', alignItems: 'center', px: 1.25, py: 0.75, borderRadius: '8px',
        bgcolor: '#f7faf5', border: '1px solid #e7efe2',
        opacity: p ? 1 : 0.55,
      }}>
        <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 700, fontStyle: p ? 'normal' : 'italic', color: p ? 'inherit' : 'rgba(28,42,26,0.5)' }}>
          {p ? (p.partner ? `${p.name} & ${p.partner}` : p.name) : 'Bye'}
        </Typography>
      </Box>
    );
    return (
      <Box sx={{ width: 200, bgcolor: '#fff', border: '1px solid #e7efe2', borderRadius: '12px', p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {prow(a)}
        {prow(b)}
      </Box>
    );
  };

  const SetupPreview = () => {
    if (t.players.length < 2) {
      return <Typography variant="body2" color="text.secondary">Add at least 2 players to preview the {isPools ? 'pool draw' : 'bracket'}.</Typography>;
    }
    if (isPools) {
      const sorted = [...t.players].sort((a, b) => a.seed - b.seed);
      const manual = t.players.some((p) => p.pool >= 0);
      let layout: TPlayer[][];
      if (manual) {
        layout = Array.from({ length: t.poolCount }, () => [] as TPlayer[]);
        const fits = (p: TPlayer) => p.pool >= 0 && p.pool < t.poolCount;
        for (const p of sorted.filter(fits)) layout[p.pool].push(p);
        for (const p of sorted.filter((p) => !fits(p))) {
          let mi = 0; for (let k = 1; k < t.poolCount; k++) if (layout[k].length < layout[mi].length) mi = k;
          layout[mi].push(p);
        }
      } else {
        layout = previewPools(sorted, t.poolCount);
      }
      return (
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
            <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.55)' }}>
              {manual ? 'Custom draw' : `Snake-seeded into ${t.poolCount} pools`} · top {t.advancePerPool} of each advance. Drag players between pools.
            </Typography>
            {manual && (
              <Button size="small" onClick={autoSeedPools} sx={{ color: '#2f6b2b', fontWeight: 700, textTransform: 'none' }}>Auto-seed</Button>
            )}
          </Stack>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
            {layout.map((pool, pi) => (
              <Box
                key={pi}
                onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                onDrop={() => assignPool(pi, layout)}
                sx={{ bgcolor: '#f4f7f2', border: '1px dashed #cfe0c6', borderRadius: '12px', p: 1.5, minHeight: 90 }}
              >
                <Typography sx={{ fontWeight: 800, mb: 1 }}>Pool {String.fromCharCode(65 + pi)}</Typography>
                <Stack spacing={0.5}>
                  {pool.map((p) => (
                    <Stack
                      key={p.id} direction="row" alignItems="center" spacing={1}
                      draggable onDragStart={() => setDragId(p.id)} onDragEnd={() => setDragId(null)}
                      sx={{ bgcolor: dragId === p.id ? '#e4f1dd' : '#fff', border: `1px solid ${dragId === p.id ? '#a9d29a' : '#e7efe2'}`, borderRadius: '8px', px: 1, py: 0.6, cursor: 'grab' }}
                    >
                      <DragIndicatorIcon sx={{ fontSize: 16, color: 'rgba(28,42,26,0.3)' }} />
                      <Box sx={{ width: 18, fontSize: '0.72rem', fontWeight: 800, color: 'rgba(28,42,26,0.45)' }}>{p.seed}</Box>
                      <Typography noWrap sx={{ flex: 1, fontWeight: 700, fontSize: '0.85rem' }}>{p.partner ? `${p.name} & ${p.partner}` : p.name}</Typography>
                    </Stack>
                  ))}
                  {!pool.length && <Typography variant="caption" color="text.secondary">Drop players here</Typography>}
                </Stack>
              </Box>
            ))}
          </Box>
        </Stack>
      );
    }
    const pairs = previewRound1(t.players);
    return (
      <Stack spacing={1.5}>
        <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.55)' }}>
          First-round matchups (seeded {t.players.length}-player bracket{t.thirdPlace ? ', with 3rd-place match' : ''}).
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={1}>
          {pairs.map(([a, b], i) => <PreviewMatch key={i} a={a} b={b} />)}
        </Stack>
      </Stack>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopNav />
      <Box sx={{ maxWidth: 1300, mx: 'auto', p: { xs: 2, md: 3 }, width: '100%', flex: 1 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={0.5} flexWrap="wrap" useFlexGap>
          <EmojiEventsIcon sx={{ color: '#e8a531', fontSize: 30 }} />
          {editTitle !== null ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <TextField
                size="small" autoFocus value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditTitle(null); }}
                sx={{ minWidth: 200 }}
              />
              <IconButton size="small" onClick={saveTitle} sx={{ color: '#2f6b2b' }}><CheckIcon fontSize="small" /></IconButton>
              <IconButton size="small" onClick={() => setEditTitle(null)} sx={{ color: '#a86a5c' }}><CloseIcon fontSize="small" /></IconButton>
            </Stack>
          ) : (
            <>
              <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>{t.name}</Typography>
              {isOwner && t.status === 'SETUP' && (
                <IconButton size="small" onClick={() => setEditTitle(t.name)} sx={{ color: 'rgba(28,42,26,0.4)' }} aria-label="Rename tournament"><EditIcon fontSize="small" /></IconButton>
              )}
            </>
          )}
          <Chip
            size="small" label={t.status}
            sx={{ fontWeight: 800, height: 24, ...(t.status === 'LIVE' ? { bgcolor: '#4c9a44', color: '#fff' } : t.status === 'DONE' ? { bgcolor: '#e8ebe6', color: '#5a6b56' } : { bgcolor: '#e2f2dc', color: '#2f6b2b' }) }}
          />
          <Chip
            size="small"
            label={isPools ? `${t.poolCount} pools → knockout` : 'single elimination'}
            sx={{ fontWeight: 700, height: 24, bgcolor: '#eef4e9', color: '#2f5d2b' }}
          />
        </Stack>
        {t.club?.name && <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.5)', mb: 3 }}>{t.club.name}</Typography>}
        {error && <Typography color="error" mb={2}>{error}</Typography>}

        {hasBracket && (
          <Card sx={{ mb: 3, background: champion ? 'linear-gradient(135deg,#22c55e,#15803d)' : 'linear-gradient(135deg,#5aa54f,#3c7a34)', color: '#fff' }}>
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Typography sx={{ fontWeight: 700, opacity: 0.9 }}>🏆 Champion</Typography>
              <Typography variant="h4" fontWeight={900}>{champion ?? 'TBD'}</Typography>
            </CardContent>
          </Card>
        )}

        {/* SETUP: add players + live preview */}
        {t.status === 'SETUP' && isOwner && (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start', mb: 3 }}>
          <Card>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h6" fontWeight={800} mb={1.5}>{t.doubles ? 'Teams' : 'Players'} ({t.players.length})</Typography>
              <Stack direction="row" spacing={1.5} alignItems="flex-end" mb={2}>
                <Box sx={{ flex: 1 }}>
                  <LabeledField
                    label={t.doubles ? 'Player 1' : 'Add player'} placeholder={t.doubles ? 'Ann' : 'Player name'} value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(); }}
                  />
                </Box>
                {t.doubles && (
                  <Box sx={{ flex: 1 }}>
                    <LabeledField
                      label="Player 2" placeholder="Bob" value={newPartner}
                      onChange={(e) => setNewPartner(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addPlayer(); }}
                    />
                  </Box>
                )}
                <Button variant="contained" onClick={addPlayer} disabled={!newName.trim()} sx={{ bgcolor: '#2f6b2b', mb: '1px', '&:hover': { bgcolor: '#24551f' } }}>Add</Button>
              </Stack>
              {t.players.length > 1 && (
                <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.5)', mb: 0.75, display: 'block' }}>
                  Drag rows to reorder seeds. Tap the pencil to rename.
                </Typography>
              )}
              <Stack spacing={0.75}>
                {t.players.map((p, i) => {
                  const editing = editPid === p.id;
                  return (
                    <Stack
                      key={p.id} direction="row" alignItems="center" spacing={1}
                      draggable={!editing}
                      onDragStart={() => setDragId(p.id)}
                      onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                      onDrop={() => reorderTo(p.id)}
                      onDragEnd={() => setDragId(null)}
                      sx={{
                        bgcolor: dragId === p.id ? '#e4f1dd' : '#f4f7f2',
                        border: `1px solid ${dragId === p.id ? '#a9d29a' : '#e7efe2'}`,
                        borderRadius: '10px', px: 1, py: 1, cursor: editing ? 'default' : 'grab',
                      }}
                    >
                      {!editing && <DragIndicatorIcon fontSize="small" sx={{ color: 'rgba(28,42,26,0.3)' }} />}
                      <Chip size="small" label={`Seed ${i + 1}`} sx={{ bgcolor: '#eef4e9', color: '#2f5d2b', fontWeight: 700 }} />
                      {editing ? (
                        <>
                          <TextField size="small" autoFocus value={editVals.name} onChange={(e) => setEditVals((v) => ({ ...v, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') savePlayerEdit(); if (e.key === 'Escape') setEditPid(null); }} placeholder="Name" sx={{ flex: 1 }} />
                          {t.doubles && <TextField size="small" value={editVals.partner} onChange={(e) => setEditVals((v) => ({ ...v, partner: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') savePlayerEdit(); }} placeholder="Partner" sx={{ flex: 1 }} />}
                          <IconButton size="small" onClick={savePlayerEdit} sx={{ color: '#2f6b2b' }}><CheckIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => setEditPid(null)} sx={{ color: '#a86a5c' }}><CloseIcon fontSize="small" /></IconButton>
                        </>
                      ) : (
                        <>
                          <Typography sx={{ flex: 1, fontWeight: 700 }} noWrap>{p.partner ? `${p.name} & ${p.partner}` : p.name}</Typography>
                          <IconButton size="small" onClick={() => { setEditPid(p.id); setEditVals({ name: p.name, partner: p.partner ?? '' }); }} sx={{ color: 'rgba(28,42,26,0.4)' }} aria-label="Rename"><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => removePlayer(p.id)} sx={{ color: '#a86a5c' }}><PersonRemoveIcon fontSize="small" /></IconButton>
                        </>
                      )}
                    </Stack>
                  );
                })}
                {!t.players.length && <Typography color="text.secondary" variant="body2">Add at least 2 {t.doubles ? 'teams' : 'players'} to start.</Typography>}
              </Stack>
              <Button
                variant="contained" size="large" fullWidth
                disabled={t.players.length < (isPools ? t.poolCount * 2 : 2)} onClick={start}
                sx={{ mt: 2, bgcolor: '#2f6b2b', fontWeight: 800, '&:hover': { bgcolor: '#24551f' } }}
              >
                {isPools ? `Draw ${t.poolCount} pools & start` : isDouble ? 'Generate double-elim bracket & start' : 'Generate seeded bracket & start'}
              </Button>
              {isPools && t.players.length < t.poolCount * 2 && (
                <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.5)', mt: 1, display: 'block', textAlign: 'center' }}>
                  Need at least {t.poolCount * 2} players for {t.poolCount} pools.
                </Typography>
              )}
            </CardContent>
          </Card>
          <Card sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h6" fontWeight={800} mb={1.5}>
                {isPools ? 'Pool draw preview' : 'Bracket preview'}
              </Typography>
              <SetupPreview />
            </CardContent>
          </Card>
          </Box>
        )}
        {t.status === 'SETUP' && !isOwner && (
          <Typography color="text.secondary">This tournament hasn&apos;t started yet.</Typography>
        )}

        {/* POOL PHASE */}
        {t.status !== 'SETUP' && isPools && poolMatches.length > 0 && (
          <Box sx={{ mb: hasKO ? 4 : 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} mb={1.5}>
              <Typography variant="h5" fontWeight={800}>{hasKO ? 'Pool results' : 'Pool play'}</Typography>
              {!hasKO && isOwner && (
                <Button
                  variant="contained" disabled={!poolsAllDone} onClick={toKnockout}
                  sx={{ bgcolor: '#2f6b2b', fontWeight: 800, '&:hover': { bgcolor: '#24551f' } }}
                >
                  {poolsAllDone ? 'Advance to knockout →' : 'Finish all pool matches'}
                </Button>
              )}
            </Stack>
            {!hasKO && isOwner && (
              <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.55)', mb: 2 }}>
                Tap a pool match and enter the score. When every pool is complete, advance the top {t.advancePerPool} of each to a seeded bracket.
              </Typography>
            )}
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: t.poolCount >= 3 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' } }}>
              {Array.from({ length: t.poolCount }, (_, pi) => <PoolBlock key={pi} pi={pi} />)}
            </Box>
          </Box>
        )}

        {/* SINGLE-ELIM / POOLS KNOCKOUT BRACKET */}
        {t.status !== 'SETUP' && hasKO && (
          <>
            {isPools && <Typography variant="h5" fontWeight={800} mb={1.5}>Knockout bracket</Typography>}
            {isOwner && t.status !== 'DONE' && (
              <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.55)', mb: 1.5 }}>
                Tap a match and enter the score to advance the bracket.
              </Typography>
            )}
            <BracketColumns matches={ko} connectors roundLabel={koName} highlightLastRound />
            {third && (
              <Box mt={3}>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#b07f24', mb: 1 }}>
                  3rd-place match
                </Typography>
                <MatchCard m={third} />
              </Box>
            )}
          </>
        )}

        {/* DOUBLE ELIMINATION: winners bracket, losers bracket, grand final */}
        {t.status !== 'SETUP' && isDouble && wbMatches.length > 0 && (
          <>
            {isOwner && t.status !== 'DONE' && (
              <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.55)', mb: 1.5 }}>
                Tap a match and enter the score. A loss drops a {t.doubles ? 'team' : 'player'} to the consolation bracket; two losses eliminates.
              </Typography>
            )}
            <Typography variant="h5" fontWeight={800} mb={0.5}>Winners bracket</Typography>
            <BracketColumns matches={wbMatches} connectors roundLabel={wbName} />

            {lbMatches.length > 0 && (
              <>
                <Typography variant="h5" fontWeight={800} mt={3} mb={0.5} sx={{ color: '#b07f24' }}>Consolation bracket</Typography>
                <BracketColumns matches={lbMatches} connectors={false} roundLabel={lbName} labelColor="#b07f24" />
              </>
            )}

            <Typography variant="h5" fontWeight={800} mt={3} mb={1}>Grand final</Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="flex-start">
              {gfMatches.map((m) => (
                (m.round === 1 || m.aPlayerId || m.bPlayerId) ? (
                  <Box key={m.id}>
                    {gfMatches.length > 1 && (
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2f5d2b', mb: 1 }}>
                        {m.round === 1 ? 'Final' : 'Reset'}
                      </Typography>
                    )}
                    <MatchCard m={m} highlight={m.round === 1 && !!m.aPlayerId && !!m.bPlayerId} />
                  </Box>
                ) : null
              ))}
            </Stack>
            <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.5)', mt: 1.5, display: 'block' }}>
              The winners-bracket champion needs one win; the consolation champion must win twice (a reset game).
            </Typography>
          </>
        )}

        {t.status !== 'SETUP' && !isPools && !isDouble && !hasKO && (
          <Typography color="text.secondary">Bracket is being generated…</Typography>
        )}
      </Box>

      {/* score entry (single game or best-of-N) */}
      <Dialog open={!!scoreFor} onClose={() => setScoreFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>{bestOf > 1 ? `Report result · best of ${bestOf}` : 'Report score'}</DialogTitle>
        <DialogContent>
          {scoreFor && (() => {
            const { wa, wb } = tallyGames(gameRows);
            const decided = wa >= gamesNeeded || wb >= gamesNeeded;
            const winner = wa > wb ? scoreFor.aName : scoreFor.bName;
            const fld = (i: number, side: 'a' | 'b', winning: boolean) => (
              <TextField
                type="number" size="small" value={gameRows[i][side]}
                onChange={(e) => setRow(i, side, e.target.value)} onFocus={(e) => e.target.select()}
                inputProps={{ min: 0, style: { textAlign: 'center', fontWeight: 800 } }}
                sx={{ flex: 1, bgcolor: winning ? '#e9f4e3' : undefined, borderRadius: '8px' }}
              />
            );
            return (
              <Stack spacing={1.25} mt={0.5}>
                <Stack direction="row" spacing={1} sx={{ px: 0.5 }}>
                  {bestOf > 1 && <Box sx={{ width: 52 }} />}
                  <Typography noWrap sx={{ flex: 1, fontWeight: 800, fontSize: '0.9rem', textAlign: 'center' }}>{scoreFor.aName}</Typography>
                  <Typography noWrap sx={{ flex: 1, fontWeight: 800, fontSize: '0.9rem', textAlign: 'center' }}>{scoreFor.bName}</Typography>
                </Stack>
                {gameRows.map((r, i) => {
                  const a = Number(r.a), b = Number(r.b);
                  const played = r.a !== '' && r.b !== '' && a !== b;
                  return (
                    <Stack key={i} direction="row" spacing={1} alignItems="center">
                      {bestOf > 1 && <Typography sx={{ width: 52, fontSize: '0.76rem', fontWeight: 700, color: 'rgba(28,42,26,0.5)' }}>Game {i + 1}</Typography>}
                      {fld(i, 'a', played && a > b)}
                      {fld(i, 'b', played && b > a)}
                    </Stack>
                  );
                })}
                <Typography variant="caption" sx={{ textAlign: 'center', fontWeight: 700, color: decided ? '#2f6b2b' : 'rgba(28,42,26,0.5)', minHeight: 18 }}>
                  {bestOf > 1
                    ? `Games ${wa}–${wb}${decided ? ` · ${winner} wins` : ` · first to ${gamesNeeded}`}`
                    : decided ? `Winner: ${winner}` : 'Enter the score'}
                </Typography>
              </Stack>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setScoreFor(null)} sx={{ color: '#5a6b56', fontWeight: 700 }}>Cancel</Button>
          <Button
            variant="contained" onClick={saveScore}
            disabled={(() => { const { wa, wb } = tallyGames(gameRows); return wa < gamesNeeded && wb < gamesNeeded; })()}
            sx={{ bgcolor: '#2f6b2b', fontWeight: 800, '&:hover': { bgcolor: '#24551f' } }}
          >
            Save result
          </Button>
        </DialogActions>
      </Dialog>

      <Footer />
    </Box>
  );
}
