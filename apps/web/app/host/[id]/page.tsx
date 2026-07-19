'use client';

import { use, useEffect, useState } from 'react';
import { api, type Board } from '@/lib/api';
import { useBoard } from '@/lib/useBoard';
import { useClub } from '@/lib/useClub';
import { TopNav } from '@/components/nav';
import { CourtCard, QueueChip, Stars, StatsBar, TEAM_BLUE, TEAM_ORANGE } from '@/components/board';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Link, MenuItem, Rating, Select, Stack, TextField, Typography,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import EditIcon from '@mui/icons-material/Edit';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import QRCode from 'qrcode';
import Grid from '@mui/material/Grid2';
import { useRouter } from 'next/navigation';

interface Member { id: string; name: string; email: string; rating: number; avatarUrl?: string | null }
type Pending = { A: string[]; B: string[] };
interface SessionPayment {
  id: string;
  amountCents: number;
  status: 'PENDING' | 'PAID' | 'WAIVED' | 'REFUNDED';
  method: string | null;
  user: { id: string; name: string };
}

/** Host console: stats bar, live court cards with one-tap winner buttons,
 *  next-match preview, drag-and-drop custom pairing, score confirmations. */
export default function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { board, setBoard, error, setError } = useBoard(id);
  const club = useClub();
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [resolve, setResolve] = useState<Record<string, { a: string; b: string }>>({});

  const [payments, setPayments] = useState<SessionPayment[]>([]);

  useEffect(() => {
    api<Member[]>('/users').then(setMembers).catch(() => {});
  }, []);

  // refresh fee list as players check in / board changes
  useEffect(() => {
    api<SessionPayment[]>(`/sessions/${id}/payments`).then(setPayments).catch(() => {});
  }, [id, board]);

  async function markPaid(paymentId: string, method?: string, waive = false) {
    try {
      await api(`/payments/${paymentId}/pay`, { method: 'POST', json: { method, waive } });
      setPayments(await api<SessionPayment[]>(`/sessions/${id}/payments`));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function call(fn: () => Promise<Board & { warnings?: string[] }>) {
    setError('');
    try {
      const b = await fn();
      setBoard(b);
      if (b.warnings?.length) setWarnings(b.warnings);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const router = useRouter();
  const [guestName, setGuestName] = useState('');
  const [guestRating, setGuestRating] = useState(3);
  // swap dialog: which live-game player is being replaced
  const [swapOut, setSwapOut] = useState<{ gameId: string; outId: string; name: string } | null>(null);
  // assign dialog: which open slot (court + team) is being filled from the queue
  const [assignFor, setAssignFor] = useState<{ courtId: string; team: 'A' | 'B' } | null>(null);
  // score tally dialog: which team just won
  const [scoreFor, setScoreFor] = useState<{ gameId: string; winner: 'A' | 'B' } | null>(null);
  const [winScore, setWinScore] = useState('11');
  const [loseScore, setLoseScore] = useState('');
  // edit player dialog
  const [editPlayer, setEditPlayer] = useState<{ id: string; name: string; rating: string } | null>(null);

  const savePlayerEdit = async () => {
    if (!editPlayer) return;
    await call(() =>
      api(`/users/${editPlayer.id}`, {
        method: 'PATCH',
        json: { name: editPlayer.name, rating: Number(editPlayer.rating) || undefined, sessionId: id },
      }),
    );
    api<Member[]>('/users').then(setMembers).catch(() => {});
    setEditPlayer(null);
  };

  const startSession = () => call(() => api(`/sessions/${id}/start`, { method: 'POST' }));
  const checkIn = (userId: string) =>
    call(() => api(`/sessions/${id}/checkin`, { method: 'POST', json: { userId } }));
  const swapIn = (inId: string) => {
    if (!swapOut) return;
    void call(() =>
      api(`/games/${swapOut.gameId}/players/swap`, {
        method: 'POST',
        json: { sessionId: id, outId: swapOut.outId, inId },
      }),
    );
    setSwapOut(null);
  };
  const removeFromSession = (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this session?`)) return;
    void call(() => api(`/sessions/${id}/players/${userId}/remove`, { method: 'POST' }));
  };
  const toggleRotations = () =>
    call(() =>
      api(`/sessions/${id}/rotations`, {
        method: 'POST',
        json: { action: board?.rotationsPaused ? 'resume' : 'pause' },
      }),
    );
  const endSession = async () => {
    if (!window.confirm('End this open play? Final standings will be published.')) return;
    try {
      await api(`/sessions/${id}/close`, { method: 'POST' });
      router.push(`/session/${id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const submitScore = () => {
    if (!scoreFor) return;
    const w = Number(winScore || 11);
    const l = Number(loseScore || 0);
    const [a, b] = scoreFor.winner === 'A' ? [w, l] : [l, w];
    void call(() =>
      api(`/games/${scoreFor.gameId}/finish`, {
        method: 'POST',
        json: { sessionId: id, a, b, winner: scoreFor.winner },
      }),
    );
    setScoreFor(null);
    setWinScore('11');
    setLoseScore('');
  };
  const addGuest = async () => {
    await call(() =>
      api(`/sessions/${id}/guests`, {
        method: 'POST',
        json: { name: guestName, rating: guestRating || 3.0 },
      }),
    );
    setGuestName('');
  };
  const pause = (userId: string, action: 'pause' | 'resume') =>
    call(() => api(`/sessions/${id}/pause`, { method: 'POST', json: { userId, action } }));
  const voidGame = (gameId: string) =>
    call(() => api(`/games/${gameId}/finish`, { method: 'POST', json: { sessionId: id, void: true } }));
  const moveGame = (gameId: string, courtId: string) =>
    call(() => api(`/games/${gameId}/court`, { method: 'PATCH', json: { sessionId: id, courtId } }));
  const confirmPending = (gameId: string) =>
    call(() => api(`/games/${gameId}/confirm`, { method: 'POST', json: { sessionId: id } }));
  const resolvePending = (gameId: string) => {
    const r = resolve[gameId];
    return call(() =>
      api(`/games/${gameId}/resolve`, {
        method: 'POST',
        json: { sessionId: id, a: Number(r?.a ?? 0), b: Number(r?.b ?? 0) },
      }),
    );
  };

  async function toggleQr() {
    if (qrDataUrl) { setQrDataUrl(null); return; }
    try {
      const { token } = await api<{ token: string }>(`/sessions/${id}/qr`);
      if (!token) throw new Error('no QR token yet — start the session first');
      setQrDataUrl(await QRCode.toDataURL(`${window.location.origin}/checkin/${token}`, { width: 360, margin: 1 }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // ── drag & drop / tap-to-add custom pairing ─────────────────────────
  /** Add a player to the first open slot on a court (Team 1 fills first). */
  function addPending(courtId: string, playerId: string, team?: 'A' | 'B') {
    setPending((prev) => {
      const p = prev[courtId] ?? { A: [], B: [] };
      if (p.A.includes(playerId) || p.B.includes(playerId)) return prev;
      const t = team ?? (p.A.length < 2 ? 'A' : 'B');
      if (p[t].length >= 2) return prev;
      return { ...prev, [courtId]: { ...p, [t]: [...p[t], playerId] } };
    });
  }

  function onDrop(courtId: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOver(null);
    const playerId = e.dataTransfer.getData('text/plain');
    if (playerId) addPending(courtId, playerId);
  }

  function removePending(courtId: string, playerId: string) {
    setPending((prev) => {
      const p = prev[courtId];
      if (!p) return prev;
      return {
        ...prev,
        [courtId]: { A: p.A.filter((x) => x !== playerId), B: p.B.filter((x) => x !== playerId) },
      };
    });
  }

  async function startCustom(courtId: string) {
    const p = pending[courtId];
    if (!p || p.A.length !== 2 || p.B.length !== 2) return;
    await call(() =>
      api(`/sessions/${id}/assignments/manual`, {
        method: 'POST',
        json: { courtId, teamA: p.A, teamB: p.B },
      }),
    );
    setPending((prev) => ({ ...prev, [courtId]: { A: [], B: [] } }));
  }

  const named = (pid: string) => {
    const p = board?.players.find((x) => x.id === pid);
    const m = members.find((x) => x.id === pid);
    return {
      id: pid,
      name: p?.name ?? m?.name ?? pid,
      rating: p?.rating ?? m?.rating ?? 3,
      avatarUrl: p?.avatarUrl ?? m?.avatarUrl ?? null,
    };
  };

  const checkedInIds = new Set(board?.players.map((p) => p.id) ?? []);
  const filteredMembers = members.filter(
    (m) =>
      !checkedInIds.has(m.id) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase())),
  );

  if (!board) {
    return (
      <>
      <TopNav />
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
        <Typography variant="h4" gutterBottom>Host console</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography color="text.secondary" mb={2}>Session is not live yet.</Typography>
        <Button variant="contained" size="large" onClick={startSession}>Start live session</Button>
      </Box>
      </>
    );
  }

  return (
    <>
    <TopNav />
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
      {/* ── header ──────────────────────────────────────────────── */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: '12px !important' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="h5" fontWeight={800}>Host console</Typography>
              <StatsBar
                courts={board.courts.length}
                players={board.players.length}
                queue={board.waiting.length}
              />
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              {board.rotationsPaused && <Chip color="warning" label="⏸ rotations paused" />}
              <Button
                variant={board.rotationsPaused ? 'contained' : 'outlined'}
                color={board.rotationsPaused ? 'success' : 'warning'}
                size="small"
                startIcon={board.rotationsPaused ? <PlayArrowIcon /> : <PauseIcon />}
                onClick={toggleRotations}
              >
                {board.rotationsPaused ? 'Resume play' : 'Pause play'}
              </Button>
              <Button variant="outlined" size="small" startIcon={<QrCode2Icon />} onClick={toggleQr}>
                {qrDataUrl ? 'Hide QR' : 'Check-in QR'}
              </Button>
              <Button variant="outlined" color="error" size="small" startIcon={<StopCircleIcon />} onClick={endSession}>
                End session
              </Button>
              <Link href={`/board/${id}`} target="_blank" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                TV board <OpenInNewIcon fontSize="small" />
              </Link>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {warnings.length > 0 && (
        <Alert severity="warning" onClose={() => setWarnings([])} sx={{ mb: 2 }}>
          <strong>Advisory warnings (game started anyway, logged):</strong>
          {warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </Alert>
      )}
      {qrDataUrl && (
        <Card sx={{ mb: 2, textAlign: 'center', p: 2 }}>
          <Typography variant="h6" gutterBottom>Scan to check in</Typography>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Check-in QR code" style={{ maxWidth: 360, width: '100%' }} />
        </Card>
      )}

      {/* ── score confirmations ─────────────────────────────────── */}
      {board.pending.length > 0 && (
        <Card sx={{ mb: 2, borderColor: 'rgba(251,191,36,0.5)' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>Awaiting confirmation</Typography>
            <Stack spacing={1}>
              {board.pending.map((p) => (
                <Stack key={p.gameId} direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Typography variant="body2">
                    {p.teamA.map((x) => x.name).join(' + ')} <strong>{p.a}</strong> — <strong>{p.b}</strong>{' '}
                    {p.teamB.map((x) => x.name).join(' + ')}
                  </Typography>
                  {p.disputed && <Chip size="small" color="error" label="DISPUTED" />}
                  <Button size="small" variant="outlined" onClick={() => confirmPending(p.gameId)}>
                    Confirm now
                  </Button>
                  <TextField
                    size="small" sx={{ width: 56 }} placeholder="A"
                    value={resolve[p.gameId]?.a ?? ''}
                    onChange={(e) => setResolve({ ...resolve, [p.gameId]: { a: e.target.value, b: resolve[p.gameId]?.b ?? '' } })}
                  />
                  <TextField
                    size="small" sx={{ width: 56 }} placeholder="B"
                    value={resolve[p.gameId]?.b ?? ''}
                    onChange={(e) => setResolve({ ...resolve, [p.gameId]: { a: resolve[p.gameId]?.a ?? '', b: e.target.value } })}
                  />
                  <Button size="small" onClick={() => resolvePending(p.gameId)}>Resolve</Button>
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        {/* ── court map ──────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Grid container spacing={2}>
            {board.courts.map((c) => (
              <Grid key={c.courtId} size={{ xs: 12, sm: 6 }}>
                {c.gameId ? (
                  <CourtCard
                    number={c.number}
                    palette={club?.theme}
                    startedAt={c.startedAt}
                    teamA={c.teamA}
                    teamB={c.teamB}
                    onPlayerClick={(p) => setSwapOut({ gameId: c.gameId!, outId: p.id, name: p.name })}
                    footer={(
                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1}>
                          <Button
                            fullWidth variant="contained"
                            sx={{ bgcolor: TEAM_BLUE, color: '#fff', '&:hover': { bgcolor: '#2563eb' } }}
                            onClick={() => setScoreFor({ gameId: c.gameId!, winner: 'A' })}
                          >
                            Team 1 Wins
                          </Button>
                          <Button
                            fullWidth variant="contained"
                            sx={{ bgcolor: TEAM_ORANGE, color: '#fff', '&:hover': { bgcolor: '#d97706' } }}
                            onClick={() => setScoreFor({ gameId: c.gameId!, winner: 'B' })}
                          >
                            Team 2 Wins
                          </Button>
                        </Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {c.assignmentType === 'manual' && <Chip size="small" color="error" label="manual" />}
                          <Button size="small" color="error" onClick={() => voidGame(c.gameId!)}>Void</Button>
                          <Select
                            size="small" displayEmpty value="" sx={{ ml: 'auto', minWidth: 140 }}
                            onChange={(e) => e.target.value && moveGame(c.gameId!, e.target.value)}
                          >
                            <MenuItem value="">Move to court…</MenuItem>
                            {board.courts.filter((o) => !o.gameId && o.courtId !== c.courtId).map((o) => (
                              <MenuItem key={o.courtId} value={o.courtId}>Court {o.number}</MenuItem>
                            ))}
                          </Select>
                        </Stack>
                      </Stack>
                    )}
                  />
                ) : (
                <Box
                  className={dragOver === c.courtId ? 'drop-target' : undefined}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(c.courtId); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => onDrop(c.courtId, e)}
                  sx={{ opacity: 0.95 }}
                >
                  <CourtCard
                    number={c.number}
                    label={c.label || undefined}
                    palette={club?.theme}
                    teamA={(pending[c.courtId]?.A ?? []).map(named)}
                    teamB={(pending[c.courtId]?.B ?? []).map(named)}
                    onPlayerClick={(p) => removePending(c.courtId, p.id)}
                    onEmptySlotClick={(team) => setAssignFor({ courtId: c.courtId, team })}
                    headerRight={(
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Chip size="small" label="OPEN" variant="outlined" sx={{ height: 22, fontWeight: 700 }} />
                        <IconButton
                          size="small" title="Remove court"
                          onClick={() => {
                            if (window.confirm(`Remove Court ${c.number} from this session?`)) {
                              void call(() => api(`/sessions/${id}/courts/${c.courtId}`, { method: 'DELETE' }));
                            }
                          }}
                        >
                          ✕
                        </IconButton>
                      </Stack>
                    )}
                    footer={(
                      <Stack spacing={0.75}>
                        <Button
                          fullWidth
                          variant="contained"
                          disabled={(pending[c.courtId]?.A.length ?? 0) !== 2 || (pending[c.courtId]?.B.length ?? 0) !== 2}
                          onClick={() => startCustom(c.courtId)}
                        >
                          Start custom game
                        </Button>
                        {((pending[c.courtId]?.A.length ?? 0) > 0 || (pending[c.courtId]?.B.length ?? 0) > 0) && (
                          <Typography variant="caption" color="text.secondary" textAlign="center">
                            Tap a player to send them back to the queue
                          </Typography>
                        )}
                      </Stack>
                    )}
                  />
                </Box>
                )}
              </Grid>
            ))}

            {/* ── add court ──────────────────────────────────────── */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Card
                sx={{
                  borderStyle: 'dashed', minHeight: 120, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', opacity: 0.85,
                }}
              >
                <Stack alignItems="center" spacing={1} py={2}>
                  <Typography variant="body2" color="text.secondary">Need more space?</Typography>
                  <Button
                    variant="contained" color="success"
                    onClick={() => call(() => api(`/sessions/${id}/courts`, { method: 'POST' }))}
                  >
                    + Add court
                  </Button>
                </Stack>
              </Card>
            </Grid>

            {/* ── next match preview ─────────────────────────────── */}
            {board.nextMatch && (
              <Grid size={12}>
                <CourtCard
                  title="Up next" chipLabel="Next match"
                  palette={club?.theme}
                  teamA={board.nextMatch.teamA}
                  teamB={board.nextMatch.teamB}
                  headerRight={<Chip size="small" label="Auto" color="success" sx={{ height: 22, fontWeight: 700 }} />}
                  footer={(
                    <Typography variant="caption" color="text.secondary">
                      Starts automatically when a court frees up
                    </Typography>
                  )}
                />
              </Grid>
            )}
          </Grid>
        </Grid>

        {/* ── queue rail + check-in ──────────────────────────────── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Waiting queue{' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    (drag onto a court)
                  </Typography>
                </Typography>
                <Stack spacing={1}>
                  {board.waiting.map((p, i) => (
                    <Stack key={p.id} direction="row" alignItems="center" spacing={0.5}>
                      <Box
                        className="draggable"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                        sx={{ flex: 1, minWidth: 0, cursor: 'grab' }}
                      >
                        <QueueChip
                          player={p}
                          prefix={`${i + 1}. `}
                          warn={p.deficit > 0}
                          small
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                          {p.gamesPlayed}g · paired {p.coverage.played}/{p.coverage.total}
                        </Typography>
                      </Box>
                      {p.deficit > 0 && <Chip size="small" label={`+${p.deficit}`} color="warning" />}
                      <IconButton size="small" title="Pause player" onClick={() => pause(p.id, 'pause')}>
                        <PauseIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" title="Edit name/rating" onClick={() => setEditPlayer({ id: p.id, name: p.name, rating: p.rating.toFixed(2) })}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" title="Remove from session" onClick={() => removeFromSession(p.id, p.name)}>
                        <PersonRemoveIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                  {board.players.filter((p) => p.status === 'paused').map((p) => (
                    <Stack key={p.id} direction="row" alignItems="center" spacing={0.5}>
                      <Box sx={{ flex: 1, minWidth: 0, opacity: 0.65 }}>
                        <QueueChip player={p} prefix="⏸ " small />
                      </Box>
                      <IconButton size="small" title="Resume player" onClick={() => pause(p.id, 'resume')}>
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" title="Remove from session" onClick={() => removeFromSession(p.id, p.name)}>
                        <PersonRemoveIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Check in a player</Typography>
                <Stack spacing={1} mb={1.5}>
                  <TextField
                    size="small" label="Walk-in guest name" fullWidth
                    value={guestName} onChange={(e) => setGuestName(e.target.value)}
                  />
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" color="text.secondary">Skill</Typography>
                      <Rating precision={0.5} max={5} value={guestRating} onChange={(_, v) => setGuestRating(v ?? 3)} />
                    </Stack>
                    <Button variant="contained" size="small" disabled={!guestName.trim()} onClick={addGuest}>
                      Add & check in
                    </Button>
                  </Stack>
                </Stack>
                <TextField
                  size="small" fullWidth placeholder="Search members…"
                  value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 1 }}
                />
                <Stack spacing={1}>
                  {filteredMembers.slice(0, 8).map((m) => (
                    <Stack key={m.id} direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                        <Avatar src={m.avatarUrl ?? undefined} sx={{ width: 26, height: 26, fontSize: '0.7rem', bgcolor: '#4c9a44' }}>
                          {m.name?.[0]?.toUpperCase()}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{m.name}</Typography>
                          <Stars value={m.rating} fontSize="0.62rem" />
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" title="Edit name/rating" onClick={() => setEditPlayer({ id: m.id, name: m.name, rating: m.rating.toFixed(2) })}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <Button size="small" variant="outlined" onClick={() => checkIn(m.id)}>
                          Check in
                        </Button>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            {payments.length > 0 && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Drop-in fees{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      ({payments.filter((p) => p.status === 'PENDING').length} unpaid)
                    </Typography>
                  </Typography>
                  <Stack spacing={1}>
                    {payments.map((p) => (
                      <Stack key={p.id} direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                        <Typography variant="body2" sx={{ minWidth: 90 }}>{p.user.name}</Typography>
                        <Chip
                          size="small"
                          label={
                            p.status === 'PENDING'
                              ? `₱${(p.amountCents / 100).toFixed(0)} due`
                              : p.status === 'WAIVED'
                                ? 'waived'
                                : `paid${p.method ? ` · ${p.method.toLowerCase()}` : ''}`
                          }
                          color={p.status === 'PENDING' ? 'warning' : p.status === 'PAID' ? 'success' : 'default'}
                          variant={p.status === 'PENDING' ? 'filled' : 'outlined'}
                        />
                        {p.status === 'PENDING' && (
                          <>
                            <Button size="small" variant="outlined" onClick={() => markPaid(p.id, 'CASH')}>Cash</Button>
                            <Button size="small" variant="outlined" onClick={() => markPaid(p.id, 'GCASH')}>GCash</Button>
                            <Button size="small" onClick={() => markPaid(p.id, undefined, true)}>Waive</Button>
                          </>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>
      </Grid>

      {/* ── edit player dialog ─────────────────────────────────── */}
      <Dialog open={!!editPlayer} onClose={() => setEditPlayer(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit player</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Name" fullWidth autoFocus
              value={editPlayer?.name ?? ''}
              onChange={(e) => setEditPlayer(editPlayer && { ...editPlayer, name: e.target.value })}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">Skill</Typography>
              <Rating
                precision={0.5} max={5}
                value={Number(editPlayer?.rating) || 0}
                onChange={(_, v) => setEditPlayer(editPlayer && { ...editPlayer, rating: String(v ?? editPlayer.rating) })}
              />
              <Typography fontWeight={700}>{Number(editPlayer?.rating || 0).toFixed(1)}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditPlayer(null)}>Cancel</Button>
          <Button variant="contained" disabled={!editPlayer?.name.trim()} onClick={savePlayerEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── assign-from-queue dialog (tap an open slot) ────────── */}
      <Dialog open={!!assignFor} onClose={() => setAssignFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Fill {assignFor?.team === 'A' ? 'Team 1' : 'Team 2'} slot
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1}>
            Assign from the queue:
          </Typography>
          <Stack spacing={1}>
            {board.waiting
              .filter((w) => {
                const p = assignFor ? pending[assignFor.courtId] : undefined;
                return !p || (!p.A.includes(w.id) && !p.B.includes(w.id));
              })
              .map((w) => (
                <Button
                  key={w.id} variant="outlined"
                  sx={{ justifyContent: 'flex-start', textTransform: 'none', gap: 1 }}
                  onClick={() => {
                    if (assignFor) addPending(assignFor.courtId, w.id, assignFor.team);
                    setAssignFor(null);
                  }}
                >
                  <Avatar src={w.avatarUrl ?? undefined} sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#4c9a44' }}>
                    {w.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Typography fontWeight={700} sx={{ flex: 1, textAlign: 'left' }} noWrap>{w.name}</Typography>
                  <Stars value={w.rating} fontSize="0.7rem" />
                  <Typography variant="caption" color="text.secondary">{w.gamesPlayed}g</Typography>
                </Button>
              ))}
            {!board.waiting.length && (
              <Typography color="text.secondary" variant="body2">
                No one is waiting — check players in first.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignFor(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* ── swap player dialog ─────────────────────────────────── */}
      <Dialog open={!!swapOut} onClose={() => setSwapOut(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Swap out {swapOut?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={1}>
            Pick a replacement from the queue (logged as manual):
          </Typography>
          <Stack spacing={1}>
            {board.waiting.map((w) => (
              <Button
                key={w.id} variant="outlined" onClick={() => swapIn(w.id)}
                sx={{ justifyContent: 'flex-start', textTransform: 'none', gap: 1 }}
              >
                <Avatar src={w.avatarUrl ?? undefined} sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#4c9a44' }}>
                  {w.name?.[0]?.toUpperCase()}
                </Avatar>
                <Typography fontWeight={700} sx={{ flex: 1, textAlign: 'left' }} noWrap>{w.name}</Typography>
                <Stars value={w.rating} fontSize="0.7rem" />
                <Typography variant="caption" color="text.secondary">{w.gamesPlayed}g</Typography>
              </Button>
            ))}
            {!board.waiting.length && (
              <Typography color="text.secondary" variant="body2">
                No one is waiting — pause or void instead.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwapOut(null)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* ── score tally dialog ─────────────────────────────────── */}
      <Dialog open={!!scoreFor} onClose={() => setScoreFor(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {scoreFor?.winner === 'A' ? 'Team 1' : 'Team 2'} wins — final score?
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} alignItems="center" mt={1} mb={2}>
            <TextField
              size="small" label="Winner" sx={{ width: 90 }} inputMode="numeric"
              value={winScore} onChange={(e) => setWinScore(e.target.value)}
            />
            <Typography variant="h6">—</Typography>
            <TextField
              size="small" label="Loser" sx={{ width: 90 }} inputMode="numeric" autoFocus
              value={loseScore} onChange={(e) => setLoseScore(e.target.value)}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">Loser&apos;s points:</Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mt={0.5}>
            {Array.from({ length: Math.min(Math.max(Number(winScore) || 11, 1), 22) }, (_, i) => (
              <Chip
                key={i}
                label={i}
                clickable
                color={loseScore === String(i) ? 'primary' : 'default'}
                onClick={() => setLoseScore(String(i))}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScoreFor(null)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={loseScore === '' || Number(loseScore) >= Number(winScore || 11)}
            onClick={submitScore}
          >
            Save {winScore || 11}–{loseScore || '?'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </>
  );
}
