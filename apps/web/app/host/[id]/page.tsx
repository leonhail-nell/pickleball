'use client';

import { use, useEffect, useState } from 'react';
import { api, type Board } from '@/lib/api';
import { useBoard } from '@/lib/useBoard';
import { useClub } from '@/lib/useClub';
import { TopNav } from '@/components/nav';
import { CourtCard, QueueRow, UpNextCard, Stars, StatsBar, avatarSrcFor } from '@/components/board';
import { ConfirmDialog, type ConfirmState } from '@/components/confirm-dialog';
import { LabeledField } from '@/components/labeled-field';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Link, MenuItem, Rating, Select, Stack, TextField, Typography,
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
  // design-system confirmation modal (replaces window.confirm)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  // search filters: waiting-queue rail + assign/swap dialogs
  const [queueSearch, setQueueSearch] = useState('');
  const [dialogSearch, setDialogSearch] = useState('');
  const matches = (name: string, q: string) => !q.trim() || name.toLowerCase().includes(q.trim().toLowerCase());
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
  // opening the host console auto-starts the session (unless it's closed)
  const [autoStartTried, setAutoStartTried] = useState(false);
  useEffect(() => {
    if (autoStartTried || board || !error.includes('not live')) return;
    setAutoStartTried(true);
    api<{ status: string }>(`/sessions/${id}`)
      .then((s) => { if (s.status !== 'CLOSED') startSession(); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, error, autoStartTried, id]);
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
  const removeFromSession = (userId: string, name: string) =>
    setConfirm({
      title: `Remove ${name}?`,
      message: 'They will be taken off this session and any unpaid drop-in fee is dropped. They can check in again later.',
      confirmLabel: 'Remove player',
      onConfirm: () => void call(() => api(`/sessions/${id}/players/${userId}/remove`, { method: 'POST' })),
    });
  const toggleRotations = () =>
    call(() =>
      api(`/sessions/${id}/rotations`, {
        method: 'POST',
        json: { action: board?.rotationsPaused ? 'resume' : 'pause' },
      }),
    );
  const endSession = () =>
    setConfirm({
      title: 'End this open play?',
      message: 'Final standings are published and the shuffle seed is revealed for the fairness audit. This closes the session for everyone.',
      confirmLabel: 'End session',
      onConfirm: async () => {
        try {
          await api(`/sessions/${id}/close`, { method: 'POST' });
          router.push(`/session/${id}`);
        } catch (e) {
          setError((e as Error).message);
        }
      },
    });
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

  async function openQr() {
    try {
      const { token } = await api<{ token: string }>(`/sessions/${id}/qr`);
      if (!token) throw new Error('no QR token yet — start the session first');
      setQrDataUrl(await QRCode.toDataURL(`${window.location.origin}/checkin/${token}`, { width: 420, margin: 1 }));
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
    // "not live" is expected on open — we auto-start. A different error is a real problem.
    const hardError = error && !error.includes('not live');
    return (
      <>
      <TopNav />
      <Box sx={{ maxWidth: 600, mx: 'auto', p: { xs: 2, md: 3 } }}>
        <Typography variant="h4" gutterBottom>Host console</Typography>
        {hardError ? (
          <>
            <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            <Typography color="text.secondary" mb={2}>Couldn&apos;t start the session.</Typography>
            <Button variant="contained" size="large" onClick={startSession}>Try again</Button>
          </>
        ) : (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 2 }}>
            <CircularProgress size={22} sx={{ color: '#2f6b2b' }} />
            <Typography color="text.secondary">Starting your session…</Typography>
          </Stack>
        )}
      </Box>
      </>
    );
  }

  return (
    <>
    <TopNav />
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
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
              <Button variant="outlined" size="small" startIcon={<QrCode2Icon />} onClick={openQr}>
                Check-in QR
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
      {/* ── check-in QR modal ──────────────────────────────────── */}
      <Dialog open={!!qrDataUrl} onClose={() => setQrDataUrl(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, textAlign: 'center', pb: 0.5 }}>
          Scan to check in
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.55)', mb: 2 }}>
            Players scan this with their phone camera to join the queue instantly.
          </Typography>
          {qrDataUrl && (
            <Box
              sx={{
                display: 'inline-block', p: 2, borderRadius: '16px',
                bgcolor: '#ffffff', border: '1px solid #e7efe2',
                boxShadow: '0 6px 24px rgba(46,90,40,0.10)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Check-in QR code" style={{ display: 'block', width: '100%', maxWidth: 300 }} />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'center' }}>
          <Button
            variant="contained" onClick={() => setQrDataUrl(null)}
            sx={{ bgcolor: '#2f6b2b', fontWeight: 700, '&:hover': { bgcolor: '#24551f' } }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

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
                      <Stack spacing={1.25}>
                        <Stack direction="row" spacing={1.25}>
                          <Button
                            fullWidth variant="contained"
                            sx={{
                              bgcolor: '#2f6b2b', color: '#fff', fontWeight: 700, py: 1.1,
                              '&:hover': { bgcolor: '#24551f' },
                            }}
                            onClick={() => setScoreFor({ gameId: c.gameId!, winner: 'A' })}
                          >
                            Team 1 Wins
                          </Button>
                          <Button
                            fullWidth variant="contained"
                            sx={{
                              bgcolor: '#d1913c', color: '#fff', fontWeight: 700, py: 1.1,
                              '&:hover': { bgcolor: '#b87f2f' },
                            }}
                            onClick={() => setScoreFor({ gameId: c.gameId!, winner: 'B' })}
                          >
                            Team 2 Wins
                          </Button>
                        </Stack>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {c.assignmentType === 'manual' && <Chip size="small" color="error" label="manual" />}
                          <Button
                            size="small"
                            sx={{ color: '#a04a35', fontWeight: 800, minWidth: 0 }}
                            onClick={() =>
                              setConfirm({
                                title: `Void the game on Court ${c.number}?`,
                                message: 'The game ends with no result — no scores and no rating changes. All four players go back into the queue.',
                                confirmLabel: 'Void game',
                                onConfirm: () => void voidGame(c.gameId!),
                              })
                            }
                          >
                            Void
                          </Button>
                          <Button
                            size="small" variant="outlined" startIcon={<DeleteOutlineIcon />}
                            sx={{
                              color: '#5a6b56', fontWeight: 700, borderColor: 'rgba(17,24,39,0.15)',
                              '&:hover': { borderColor: '#cfe3c6', bgcolor: '#f2f8ef' },
                            }}
                            onClick={() =>
                              setConfirm({
                                title: `Remove Court ${c.number}?`,
                                message: 'The current game will be voided and its players return to the queue. Other courts refill automatically.',
                                confirmLabel: 'Remove court',
                                onConfirm: () => void call(() => api(`/sessions/${id}/courts/${c.courtId}`, { method: 'DELETE' })),
                              })
                            }
                          >
                            Remove court
                          </Button>
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
                          onClick={() =>
                            setConfirm({
                              title: `Remove Court ${c.number}?`,
                              message: 'The court is detached from this session. You can add it back any time with “+ Add court”.',
                              confirmLabel: 'Remove court',
                              onConfirm: () => void call(() => api(`/sessions/${id}/courts/${c.courtId}`, { method: 'DELETE' })),
                            })
                          }
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
              {(() => {
                const atFreeLimit =
                  !!club && !club.venuePro && board.courts.length >= (club.freeCourtLimit ?? 4);
                return (
                  <Card
                    sx={{
                      borderStyle: 'dashed', minHeight: 120, height: '100%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', opacity: 0.9,
                      boxSizing: 'border-box',
                    }}
                  >
                    <Stack alignItems="center" spacing={1} py={2} px={2}>
                      <Typography variant="body2" color="text.secondary">
                        {atFreeLimit
                          ? `Free plan runs up to ${club?.freeCourtLimit ?? 4} courts`
                          : 'Need more space?'}
                      </Typography>
                      <Button
                        variant="contained" color="success" disabled={atFreeLimit}
                        onClick={() => call(() => api(`/sessions/${id}/courts`, { method: 'POST' }))}
                      >
                        + Add court
                      </Button>
                      {atFreeLimit && (
                        <Chip
                          size="small" clickable component="a" href="/admin"
                          label="⭐ Upgrade to Pro to add more courts"
                          sx={{ bgcolor: '#fdf1d7', color: '#b07f24', fontWeight: 800 }}
                        />
                      )}
                    </Stack>
                  </Card>
                );
              })()}
            </Grid>

            {/* ── next match preview ─────────────────────────────── */}
            {board.nextMatch && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <UpNextCard
                  title="Up next" chipLabel="Next match" rightLabel="Auto-matched"
                  players={[...board.nextMatch.teamA, ...board.nextMatch.teamB]}
                  footer="Starts when a court frees up"
                />
              </Grid>
            )}
          </Grid>
        </Grid>

        {/* ── queue rail + check-in ──────────────────────────────── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            {/* ── design-system rail: queue + check-in in one card ── */}
            <Card sx={{ overflow: 'hidden' }}>
              <Box sx={{ px: 2.5, pt: 2.25, pb: 1.75, borderBottom: '1px solid #eef3ea' }}>
                <Stack direction="row" spacing={1} alignItems="baseline">
                  <Typography variant="h6" fontWeight={800}>Waiting queue</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.45)' }}>
                    drag onto a court
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                  <Chip
                    size="small" label={`${board.waiting.length} waiting`}
                    sx={{ bgcolor: '#e2f2dc', color: '#2f6b2b', fontWeight: 700, height: 22 }}
                  />
                  <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.4)' }}>
                    Games · Partners
                  </Typography>
                </Stack>
                <TextField
                  size="small" fullWidth placeholder="Search queue…"
                  value={queueSearch} onChange={(e) => setQueueSearch(e.target.value)}
                  sx={{ mt: 1.25, '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', borderRadius: '10px' } }}
                />
              </Box>

              <Box sx={{ maxHeight: 520, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {board.waiting
                  .map((p, i) => ({ p, i }))
                  .filter(({ p }) => matches(p.name, queueSearch))
                  .map(({ p, i }) => (
                  <QueueRow
                    key={p.id}
                    player={p}
                    rank={i + 1}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                    actions={(
                      <Stack direction="row" spacing={0} flexShrink={0}>
                        <IconButton
                          size="small" title="Pause player" onClick={() => pause(p.id, 'pause')}
                          sx={{ color: '#5a6b56', '&:hover': { bgcolor: '#e3ecdd', color: '#2f6b2b' } }}
                        >
                          <PauseIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small" title="Edit name/rating"
                          onClick={() => setEditPlayer({ id: p.id, name: p.name, rating: p.rating.toFixed(2) })}
                          sx={{ color: '#5a6b56', '&:hover': { bgcolor: '#e3ecdd', color: '#2f6b2b' } }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small" title="Remove from session" onClick={() => removeFromSession(p.id, p.name)}
                          sx={{ color: '#a86a5c', '&:hover': { bgcolor: '#f7ece9', color: '#a04a35' } }}
                        >
                          <PersonRemoveIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    )}
                  />
                ))}
                {queueSearch.trim() &&
                  !board.waiting.some((p) => matches(p.name, queueSearch)) &&
                  board.waiting.length > 0 && (
                  <Typography sx={{ py: 2, textAlign: 'center', color: 'rgba(28,42,26,0.4)', fontSize: '0.82rem' }}>
                    No one in the queue matches “{queueSearch.trim()}”
                  </Typography>
                )}
                {board.players.filter((p) => p.status === 'paused' && matches(p.name, queueSearch)).map((p) => (
                  <Stack
                    key={p.id} direction="row" alignItems="center" spacing={1.25}
                    sx={{
                      bgcolor: '#f4f7f2', border: '1px dashed #e7efe2', borderRadius: '12px',
                      px: 1.25, py: 1, opacity: 0.65,
                    }}
                  >
                    <Typography sx={{ width: 20, textAlign: 'center', fontSize: '0.8rem', flexShrink: 0 }}>⏸</Typography>
                    <Avatar src={avatarSrcFor(p)} alt={p.name} sx={{ width: 34, height: 34, bgcolor: '#d1e7c9', flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '0.88rem', fontWeight: 700 }}>{p.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.5)' }}>paused</Typography>
                    </Box>
                    <IconButton
                      size="small" title="Resume player" onClick={() => pause(p.id, 'resume')}
                      sx={{ color: '#5a6b56', '&:hover': { bgcolor: '#e3ecdd', color: '#2f6b2b' } }}
                    >
                      <PlayArrowIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small" title="Remove from session" onClick={() => removeFromSession(p.id, p.name)}
                      sx={{ color: '#a86a5c', '&:hover': { bgcolor: '#f7ece9', color: '#a04a35' } }}
                    >
                      <PersonRemoveIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                {!board.waiting.length && !board.players.some((p) => p.status === 'paused') && (
                  <Typography sx={{ py: 3.5, textAlign: 'center', color: 'rgba(28,42,26,0.4)', fontSize: '0.82rem' }}>
                    Queue is empty
                  </Typography>
                )}
              </Box>

              {/* check-in section */}
              <Box sx={{ borderTop: '1px solid #eef3ea', bgcolor: '#f7faf5', p: 2 }}>
                <Typography fontWeight={800} sx={{ fontSize: '0.95rem', mb: 1.5 }}>
                  Check in a player
                </Typography>
                <TextField
                  size="small" fullWidth placeholder="Walk-in guest name"
                  value={guestName} onChange={(e) => setGuestName(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', borderRadius: '10px' } }}
                />
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" my={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.6)' }}>Skill</Typography>
                    <Rating precision={0.5} max={5} value={guestRating} onChange={(_, v) => setGuestRating(v ?? 3)} />
                  </Stack>
                  <Button
                    variant="contained" size="small" disabled={!guestName.trim()} onClick={addGuest}
                    sx={{ borderRadius: 999, whiteSpace: 'nowrap', px: 2.25 }}
                  >
                    Add & check in
                  </Button>
                </Stack>
                <TextField
                  size="small" fullWidth placeholder="Search members…"
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#ffffff', borderRadius: '10px' } }}
                />
                <Box sx={{ mt: 1, maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  {filteredMembers.slice(0, 12).map((m) => (
                    <Stack
                      key={m.id} direction="row" alignItems="center" spacing={1.25}
                      sx={{ px: 0.75, py: 1, borderRadius: '10px', '&:hover': { bgcolor: '#eef4e9' } }}
                    >
                      <Avatar src={avatarSrcFor(m)} alt={m.name} sx={{ width: 32, height: 32, bgcolor: '#d1e7c9', flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap>
                          <Box component="span" sx={{ fontWeight: 600 }}>{m.name}</Box>{' '}
                          <Box component="span" sx={{ color: 'rgba(28,42,26,0.45)', fontSize: '0.78rem' }}>
                            ({m.rating.toFixed(2)})
                          </Box>
                        </Typography>
                      </Box>
                      <IconButton
                        size="small" title="Edit name/rating"
                        onClick={() => setEditPlayer({ id: m.id, name: m.name, rating: m.rating.toFixed(2) })}
                        sx={{ color: '#5a6b56', '&:hover': { bgcolor: '#e3ecdd', color: '#2f6b2b' } }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <Button
                        size="small" variant="outlined" onClick={() => checkIn(m.id)}
                        sx={{
                          borderRadius: 999, whiteSpace: 'nowrap', color: '#2f6b2b',
                          borderColor: '#cfe3c6', bgcolor: '#ffffff',
                          '&:hover': { bgcolor: '#e4f1dd', borderColor: '#a9d29a' },
                        }}
                      >
                        Check in
                      </Button>
                    </Stack>
                  ))}
                  {!filteredMembers.length && (
                    <Typography sx={{ py: 2, textAlign: 'center', color: 'rgba(28,42,26,0.4)', fontSize: '0.82rem' }}>
                      No members match
                    </Typography>
                  )}
                </Box>
              </Box>
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

      {/* ── confirmation modal ─────────────────────────────────── */}
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />

      {/* ── edit player dialog ─────────────────────────────────── */}
      <Dialog open={!!editPlayer} onClose={() => setEditPlayer(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit player</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <LabeledField
              label="Name" autoFocus
              value={editPlayer?.name ?? ''}
              onChange={(e) => setEditPlayer(editPlayer && { ...editPlayer, name: e.target.value })}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" fontWeight={700}>Skill</Typography>
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
      <Dialog open={!!assignFor} onClose={() => { setAssignFor(null); setDialogSearch(''); }} maxWidth="xs" fullWidth>
        <DialogTitle>
          Fill {assignFor?.team === 'A' ? 'Team 1' : 'Team 2'} slot
        </DialogTitle>
        <DialogContent>
          <TextField
            size="small" fullWidth autoFocus placeholder="Search the queue…"
            value={dialogSearch} onChange={(e) => setDialogSearch(e.target.value)}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { bgcolor: '#f7faf5', borderRadius: '10px' } }}
          />
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2f5d2b', mb: 1 }}>
            Assign from queue
          </Typography>
          <Stack spacing={0.75}>
            {board.waiting
              .filter((w) => {
                const p = assignFor ? pending[assignFor.courtId] : undefined;
                return (!p || (!p.A.includes(w.id) && !p.B.includes(w.id))) && matches(w.name, dialogSearch);
              })
              .map((w) => (
                <Box
                  key={w.id} component="button"
                  onClick={() => {
                    if (assignFor) addPending(assignFor.courtId, w.id, assignFor.team);
                    setAssignFor(null);
                    setDialogSearch('');
                  }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25, width: '100%',
                    bgcolor: '#f2f8ef', border: '1px solid #dcead5', borderRadius: '12px',
                    px: 1.5, py: 1.1, cursor: 'pointer', font: 'inherit', textAlign: 'left',
                    '&:hover': { bgcolor: '#e4f1dd', borderColor: '#bfdcb2' },
                  }}
                >
                  <Avatar src={avatarSrcFor(w)} alt={w.name} sx={{ width: 32, height: 32, bgcolor: '#d1e7c9', flexShrink: 0 }} />
                  <Typography noWrap sx={{ flex: 1, fontWeight: 700, fontSize: '0.9rem', color: '#1c2a1a' }}>{w.name}</Typography>
                  <Stars value={w.rating} fontSize="0.7rem" />
                  <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.5)' }}>{w.gamesPlayed}g</Typography>
                </Box>
              ))}
            {!board.waiting.length && (
              <Typography sx={{ py: 2, textAlign: 'center', color: 'rgba(28,42,26,0.4)', fontSize: '0.82rem' }}>
                No one is waiting — check players in first.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAssignFor(null); setDialogSearch(''); }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* ── swap player dialog ─────────────────────────────────── */}
      <Dialog open={!!swapOut} onClose={() => { setSwapOut(null); setDialogSearch(''); }} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>Swap out {swapOut?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.55)' }} mb={1.5}>
            Pick a replacement — the change is logged as a manual override.
          </Typography>
          <TextField
            size="small" fullWidth autoFocus placeholder="Search the queue…"
            value={dialogSearch} onChange={(e) => setDialogSearch(e.target.value)}
            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { bgcolor: '#f7faf5', borderRadius: '10px' } }}
          />
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#2f5d2b', mb: 1 }}>
            Assign from queue
          </Typography>
          <Stack spacing={0.75}>
            {board.waiting.filter((w) => matches(w.name, dialogSearch)).map((w) => (
              <Box
                key={w.id} component="button" onClick={() => swapIn(w.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.25, width: '100%',
                  bgcolor: '#f2f8ef', border: '1px solid #dcead5', borderRadius: '12px',
                  px: 1.5, py: 1.1, cursor: 'pointer', font: 'inherit', textAlign: 'left',
                  '&:hover': { bgcolor: '#e4f1dd', borderColor: '#bfdcb2' },
                }}
              >
                <Avatar src={avatarSrcFor(w)} alt={w.name} sx={{ width: 32, height: 32, bgcolor: '#d1e7c9', flexShrink: 0 }} />
                <Typography noWrap sx={{ flex: 1, fontWeight: 700, fontSize: '0.9rem', color: '#1c2a1a' }}>{w.name}</Typography>
                <Stars value={w.rating} fontSize="0.7rem" />
                <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.5)' }}>{w.gamesPlayed}g</Typography>
              </Box>
            ))}
            {!board.waiting.length && (
              <Typography sx={{ py: 2, textAlign: 'center', color: 'rgba(28,42,26,0.4)', fontSize: '0.82rem' }}>
                No one is waiting — pause or void instead.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSwapOut(null); setDialogSearch(''); }}>Cancel</Button>
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
