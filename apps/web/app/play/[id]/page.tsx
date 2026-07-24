'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser, type Board } from '@/lib/api';
import { useBoard } from '@/lib/useBoard';
import { TopNav } from '@/components/nav';
import { PaddleLogo } from '@/components/logo';
import { QueueRow } from '@/components/board';
import { CourtsNow } from '@/components/play/CourtsNow';
import { MyStatusPanel } from '@/components/play/MyStatusPanel';
import {
  Alert, Box, Stack, Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';

/** Player's personal live view: my position, my court, pause/resume, alerts. */
export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { board, setBoard, youreUp, error, setError } = useBoard(id);
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [notifOk, setNotifOk] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );

  useEffect(() => {
    const u = getUser();
    if (!u) router.push(`/login?next=/play/${id}`);
    else setMe(u);
  }, [id, router]);

  const my = board?.players.find((p) => p.id === me?.id);
  const queuePos = board ? board.waiting.findIndex((p) => p.id === me?.id) : -1;
  const myCourt = board?.courts.find(
    (c) => [...c.teamA, ...c.teamB].some((p) => p.id === me?.id),
  );
  const [score, setScore] = useState({ a: '', b: '' });

  const myPending = (board?.pending ?? []).filter((p) =>
    [...p.teamA, ...p.teamB].some((x) => x.id === me?.id),
  );

  if (error && error.includes('not live')) {
    return (
      <>
        <TopNav />
        <Box sx={{ maxWidth: 480, mx: 'auto', p: { xs: 2, md: 3 }, textAlign: 'center' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}><PaddleLogo size={44} /></Box>
          <Typography variant="h6" gutterBottom>You&apos;re all set!</Typography>
          <Typography color="text.secondary">
            The session hasn&apos;t started yet. The live courts will appear here
            automatically as soon as the host opens play.
          </Typography>
        </Box>
      </>
    );
  }
  if (error) return <Box p={3}><Alert severity="error">{error}</Alert></Box>;
  if (!board || !me) return <Box p={3}><Typography>Loading…</Typography></Box>;

  return (
    <>
      <TopNav />
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
        {(youreUp || myCourt) && (
          <Alert severity="success" sx={{ mb: 2, fontSize: '1.3rem' }}>
            🏓 YOU&apos;RE UP — COURT {youreUp?.court ?? myCourt?.number}
          </Alert>
        )}

        <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }} gutterBottom>
          Hi {me.name} 👋
        </Typography>

        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            {!my ? (
              <Alert severity="info" sx={{ mb: 2 }}>
                You&apos;re not checked in to this session yet — scan the QR code at the venue.
              </Alert>
            ) : (
              <MyStatusPanel
                me={me}
                my={my}
                myCourt={myCourt}
                queuePos={queuePos}
                queueLength={board.waiting.length}
                score={score}
                onScore={setScore}
                onReport={async () => {
                  if (!myCourt?.gameId) return;
                  try {
                    setBoard(await api<Board>(`/games/${myCourt.gameId}/report`, {
                      method: 'POST',
                      json: { sessionId: id, a: Number(score.a), b: Number(score.b) },
                    }));
                    setScore({ a: '', b: '' });
                  } catch (e) { setError((e as Error).message); }
                }}
                onPauseResume={async (action) => {
                  try {
                    setBoard(await api<Board>(`/sessions/${id}/pause`, { method: 'POST', json: { action } }));
                  } catch (e) { setError((e as Error).message); }
                }}
                notifOk={notifOk}
                onEnableNotifications={async () => {
                  const perm = await Notification.requestPermission();
                  setNotifOk(perm === 'granted');
                }}
                myPending={myPending}
                onConfirmOrDispute={async (gameId, action) => {
                  try {
                    setBoard(await api<Board>(`/games/${gameId}/${action}`, {
                      method: 'POST',
                      json: { sessionId: id },
                    }));
                  } catch (e) { setError((e as Error).message); }
                }}
              />
            )}
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            <CourtsNow board={board} meId={me.id} />

            <Stack direction="row" spacing={1} alignItems="baseline" mt={3} mb={1.5}>
              <Typography fontWeight={800} sx={{ fontSize: '1.2rem', letterSpacing: '-0.01em' }}>
                Waiting queue
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.45)' }}>
                your spot updates live
              </Typography>
            </Stack>
            <Grid container spacing={1.25}>
              {board.waiting.map((p, i) => (
                <Grid key={p.id} size={{ xs: 12, sm: 6 }}>
                  <QueueRow player={p} rank={i + 1} highlight={p.id === me.id} />
                </Grid>
              ))}
              {!board.waiting.length && (
                <Grid size={12}>
                  <Typography color="text.secondary">Everyone is playing.</Typography>
                </Grid>
              )}
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </>
  );
}
