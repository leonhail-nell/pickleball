'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { api, type Board, type NamedPlayer } from '@/lib/api';
import { useBoard } from '@/lib/useBoard';
import { useClub } from '@/lib/useClub';
import { PAGE_BG } from '@/constant/court';
import { TopNav } from '@/components/nav';
import { ConfirmDialog, type ConfirmState } from '@/components/confirm-dialog';
import { AssignDialog } from '@/components/host/AssignDialog';
import { CheckInPanel } from '@/components/host/CheckInPanel';
import { CourtMap } from '@/components/host/CourtMap';
import { EditPlayerDialog } from '@/components/host/EditPlayerDialog';
import { HostHeader } from '@/components/host/HostHeader';
import { PaymentsPanel } from '@/components/host/PaymentsPanel';
import { PendingScoresPanel } from '@/components/host/PendingScoresPanel';
import { QueueRail } from '@/components/host/QueueRail';
import { ScoreDialog } from '@/components/host/ScoreDialog';
import { SwapDialog } from '@/components/host/SwapDialog';
import type { EditTarget, Member, Pending, ResolveMap, ScoreTarget, SessionPayment, SwapTarget } from '@/types/host';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';

const matches = (name: string, q: string) =>
  !q.trim() || name.toLowerCase().includes(q.trim().toLowerCase());

/** Host console — composes extracted panels; state + API wiring only. */
export default function HostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { board, setBoard, error, setError } = useBoard(id);
  const club = useClub();

  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [resolve, setResolve] = useState<ResolveMap>({});
  const [payments, setPayments] = useState<SessionPayment[]>([]);
  const [guestName, setGuestName] = useState('');
  const [guestRating, setGuestRating] = useState(3);
  const [swapOut, setSwapOut] = useState<SwapTarget | null>(null);
  const [assignFor, setAssignFor] = useState<{ courtId: string; team: 'A' | 'B' } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [queueSearch, setQueueSearch] = useState('');
  const [dialogSearch, setDialogSearch] = useState('');
  const [scoreFor, setScoreFor] = useState<ScoreTarget | null>(null);
  const [winScore, setWinScore] = useState('11');
  const [loseScore, setLoseScore] = useState('');
  const [editPlayer, setEditPlayer] = useState<EditTarget | null>(null);
  const [autoStartTried, setAutoStartTried] = useState(false);

  useEffect(() => { api<Member[]>('/users').then(setMembers).catch(() => {}); }, []);
  useEffect(() => {
    api<SessionPayment[]>(`/sessions/${id}/payments`).then(setPayments).catch(() => {});
  }, [id, board]);

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

  const startSession = () => call(() => api(`/sessions/${id}/start`, { method: 'POST' }));
  useEffect(() => {
    if (autoStartTried || board || !error.includes('not live')) return;
    setAutoStartTried(true);
    api<{ status: string }>(`/sessions/${id}`)
      .then((s) => { if (s.status !== 'CLOSED') startSession(); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, error, autoStartTried, id]);

  const named = (pid: string): NamedPlayer => {
    const p = board?.players.find((x) => x.id === pid);
    const m = members.find((x) => x.id === pid);
    return { id: pid, name: p?.name ?? m?.name ?? pid, rating: p?.rating ?? m?.rating ?? 3 };
  };

  const checkedInIds = new Set(board?.players.map((p) => p.id) ?? []);
  const filteredMembers = members.filter(
    (m) =>
      !checkedInIds.has(m.id) &&
      (m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase())),
  );

  const addPending = (courtId: string, playerId: string, team?: 'A' | 'B') => {
    setPending((prev) => {
      const p = prev[courtId] ?? { A: [], B: [] };
      if (p.A.includes(playerId) || p.B.includes(playerId)) return prev;
      const t = team ?? (p.A.length < 2 ? 'A' : 'B');
      if (p[t].length >= 2) return prev;
      return { ...prev, [courtId]: { ...p, [t]: [...p[t], playerId] } };
    });
  };

  const removePending = (courtId: string, playerId: string) => {
    setPending((prev) => {
      const p = prev[courtId];
      if (!p) return prev;
      return {
        ...prev,
        [courtId]: { A: p.A.filter((x) => x !== playerId), B: p.B.filter((x) => x !== playerId) },
      };
    });
  };

  const atFreeLimit =
    !!club && !club.venuePro && (board?.courts.length ?? 0) >= (club.freeCourtLimit ?? 4);

  if (!board) {
    const hardError = error && !error.includes('not live');
    return (
      <>
        <TopNav />
        <Box sx={{ maxWidth: 600, mx: 'auto', p: { xs: 2, md: 3 } }}>
          <Typography variant="h4" gutterBottom>Host console</Typography>
          {hardError ? (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
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
      <Box sx={{ bgcolor: PAGE_BG, minHeight: 'calc(100vh - 64px)' }}>
      <Box sx={{ maxWidth: 1400, mx: 'auto', p: { xs: 2, md: 3 } }}>
        <HostHeader
          sessionId={id}
          courts={board.courts.length}
          players={board.players.length}
          queue={board.waiting.length}
          rotationsPaused={!!board.rotationsPaused}
          qrShown={!!qrDataUrl}
          onToggleRotations={() =>
            call(() =>
              api(`/sessions/${id}/rotations`, {
                method: 'POST',
                json: { action: board.rotationsPaused ? 'resume' : 'pause' },
              }),
            )
          }
          onToggleQr={async () => {
            if (qrDataUrl) { setQrDataUrl(null); return; }
            try {
              const { token } = await api<{ token: string }>(`/sessions/${id}/qr`);
              if (!token) throw new Error('no QR token yet — start the session first');
              setQrDataUrl(await QRCode.toDataURL(`${window.location.origin}/checkin/${token}`, { width: 420, margin: 1 }));
            } catch (e) { setError((e as Error).message); }
          }}
          onEndSession={() =>
            setConfirm({
              title: 'End this open play?',
              message: 'Final standings are published and the shuffle seed is revealed for the fairness audit.',
              confirmLabel: 'End session',
              onConfirm: async () => {
                try {
                  await api(`/sessions/${id}/close`, { method: 'POST' });
                  router.push(`/session/${id}`);
                } catch (e) { setError((e as Error).message); }
              },
            })
          }
        />

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {warnings.length > 0 && (
          <Alert severity="warning" onClose={() => setWarnings([])} sx={{ mb: 2 }}>
            <strong>Advisory warnings:</strong>
            {warnings.map((w, i) => <div key={i}>• {w}</div>)}
          </Alert>
        )}

        <Dialog open={!!qrDataUrl} onClose={() => setQrDataUrl(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, textAlign: 'center' }}>Scan to check in</DialogTitle>
          <DialogContent sx={{ textAlign: 'center' }}>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="Check-in QR code" style={{ width: '100%', maxWidth: 300 }} />
            )}
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
            <Button variant="contained" onClick={() => setQrDataUrl(null)}>Done</Button>
          </DialogActions>
        </Dialog>

        <PendingScoresPanel
          pending={board.pending}
          resolve={resolve}
          onResolveChange={setResolve}
          onConfirm={(gameId) => call(() => api(`/games/${gameId}/confirm`, { method: 'POST', json: { sessionId: id } }))}
          onResolve={(gameId) => {
            const r = resolve[gameId];
            return call(() =>
              api(`/games/${gameId}/resolve`, {
                method: 'POST',
                json: { sessionId: id, a: Number(r?.a ?? 0), b: Number(r?.b ?? 0) },
              }),
            );
          }}
        />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <CourtMap
              board={board}
              pending={pending}
              dragOver={dragOver}
              named={named}
              onSwapOut={setSwapOut}
              onScoreFor={setScoreFor}
              onVoid={(gameId) => call(() => api(`/games/${gameId}/finish`, { method: 'POST', json: { sessionId: id, void: true } }))}
              onMove={(gameId, courtId) => call(() => api(`/games/${gameId}/move`, { method: 'POST', json: { sessionId: id, courtId } }))}
              onRemoveCourt={(courtId, number, live) =>
                setConfirm({
                  title: `Remove Court ${number}?`,
                  message: live
                    ? 'The current game will be voided and its players return to the queue.'
                    : 'The court is detached from this session.',
                  confirmLabel: 'Remove court',
                  onConfirm: () => void call(() => api(`/sessions/${id}/courts/${courtId}`, { method: 'DELETE' })),
                })
              }
              onAddCourt={() => call(() => api(`/sessions/${id}/courts`, { method: 'POST' }))}
              addCourtDisabled={atFreeLimit}
              addCourtHint={atFreeLimit ? `Free plan runs up to ${club?.freeCourtLimit ?? 4} courts` : undefined}
              onDrop={(courtId, team, e) => {
                e.preventDefault();
                setDragOver(null);
                const playerId = e.dataTransfer.getData('text/plain');
                if (playerId) addPending(courtId, playerId, team);
              }}
              onDragOver={setDragOver}
              onDragLeave={() => setDragOver(null)}
              onAssignSlot={(courtId, team) => {
                setAssignFor({ courtId, team });
                setDialogSearch('');
              }}
              onRemovePending={removePending}
              onStartCustom={async (courtId) => {
                const p = pending[courtId];
                if (!p || p.A.length !== 2 || p.B.length !== 2) return;
                await call(() =>
                  api(`/sessions/${id}/assignments/manual`, {
                    method: 'POST',
                    json: { courtId, teamA: p.A, teamB: p.B },
                  }),
                );
                setPending((prev) => ({ ...prev, [courtId]: { A: [], B: [] } }));
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2}>
              <QueueRail
                waiting={board.waiting}
                paused={board.players.filter((p) => p.status === 'paused')}
                search={queueSearch}
                onSearch={setQueueSearch}
                onPause={(userId) => call(() => api(`/sessions/${id}/pause`, { method: 'POST', json: { userId, action: 'pause' } }))}
                onResume={(userId) => call(() => api(`/sessions/${id}/pause`, { method: 'POST', json: { userId, action: 'resume' } }))}
                onEdit={setEditPlayer}
                onRemove={(userId, name) =>
                  setConfirm({
                    title: `Remove ${name}?`,
                    message: 'They will be taken off this session and any unpaid drop-in fee is dropped.',
                    confirmLabel: 'Remove player',
                    onConfirm: () => void call(() => api(`/sessions/${id}/players/${userId}/remove`, { method: 'POST' })),
                  })
                }
              />
              <CheckInPanel
                members={filteredMembers}
                search={search}
                guestName={guestName}
                guestRating={guestRating}
                onSearch={setSearch}
                onGuestName={setGuestName}
                onGuestRating={setGuestRating}
                onAddGuest={async () => {
                  await call(() =>
                    api(`/sessions/${id}/guests`, { method: 'POST', json: { name: guestName, rating: guestRating || 3.0 } }),
                  );
                  setGuestName('');
                }}
                onCheckIn={(userId) => call(() => api(`/sessions/${id}/checkin`, { method: 'POST', json: { userId } }))}
                onEdit={setEditPlayer}
              />
              <PaymentsPanel
                payments={payments}
                onMarkPaid={async (paymentId, method, waive) => {
                  try {
                    await api(`/payments/${paymentId}/pay`, { method: 'POST', json: { method, waive } });
                    setPayments(await api<SessionPayment[]>(`/sessions/${id}/payments`));
                  } catch (e) { setError((e as Error).message); }
                }}
              />
            </Stack>
          </Grid>
        </Grid>

        <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
        <EditPlayerDialog
          value={editPlayer}
          onChange={setEditPlayer}
          onClose={() => setEditPlayer(null)}
          onSave={async () => {
            if (!editPlayer) return;
            await call(() =>
              api(`/users/${editPlayer.id}`, {
                method: 'PATCH',
                json: { name: editPlayer.name, rating: Number(editPlayer.rating) || undefined, sessionId: id },
              }),
            );
            api<Member[]>('/users').then(setMembers).catch(() => {});
            setEditPlayer(null);
          }}
        />
        <AssignDialog
          assignFor={assignFor}
          waiting={board.waiting}
          pending={pending}
          search={dialogSearch}
          onSearch={setDialogSearch}
          onPick={(playerId) => {
            if (assignFor) addPending(assignFor.courtId, playerId, assignFor.team);
            setAssignFor(null);
            setDialogSearch('');
          }}
          onClose={() => { setAssignFor(null); setDialogSearch(''); }}
          matches={matches}
        />
        <SwapDialog
          target={swapOut}
          waiting={board.waiting}
          search={dialogSearch}
          onSearch={setDialogSearch}
          onPick={(inId) => {
            if (!swapOut) return;
            void call(() =>
              api(`/games/${swapOut.gameId}/players/swap`, {
                method: 'POST',
                json: { sessionId: id, outId: swapOut.outId, inId },
              }),
            );
            setSwapOut(null);
            setDialogSearch('');
          }}
          onClose={() => { setSwapOut(null); setDialogSearch(''); }}
        />
        <ScoreDialog
          target={scoreFor}
          winScore={winScore}
          loseScore={loseScore}
          onWinScore={setWinScore}
          onLoseScore={setLoseScore}
          onClose={() => setScoreFor(null)}
          onSubmit={() => {
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
          }}
        />
      </Box>
      </Box>
    </>
  );
}
