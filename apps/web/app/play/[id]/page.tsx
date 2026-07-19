'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser, type Board } from '@/lib/api';
import { useBoard } from '@/lib/useBoard';
import { useClub } from '@/lib/useClub';
import { TopNav } from '@/components/nav';
import { PaddleLogo } from '@/components/logo';
import { CourtCard, QueueChip } from '@/components/board';
import {
  Alert, Box, Button, Card, CardContent, Chip, LinearProgress, Stack, TextField, Typography,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import NotificationsIcon from '@mui/icons-material/Notifications';
import Grid from '@mui/material/Grid2';

/** Player's personal live view: my position, my court, pause/resume, alerts. */
export default function PlayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { board, setBoard, youreUp, error, setError } = useBoard(id);
  const club = useClub();
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

  async function pauseResume(action: 'pause' | 'resume') {
    try {
      setBoard(await api<Board>(`/sessions/${id}/pause`, { method: 'POST', json: { action } }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function reportScore() {
    if (!myCourt?.gameId) return;
    try {
      setBoard(await api<Board>(`/games/${myCourt.gameId}/report`, {
        method: 'POST',
        json: { sessionId: id, a: Number(score.a), b: Number(score.b) },
      }));
      setScore({ a: '', b: '' });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function confirmOrDispute(gameId: string, action: 'confirm' | 'dispute') {
    try {
      setBoard(await api<Board>(`/games/${gameId}/${action}`, {
        method: 'POST',
        json: { sessionId: id },
      }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // reported games involving me, waiting on the other team
  const myPending = (board?.pending ?? []).filter((p) =>
    [...p.teamA, ...p.teamB].some((x) => x.id === me?.id),
  );

  async function enableNotifications() {
    const perm = await Notification.requestPermission();
    setNotifOk(perm === 'granted');
  }

  if (error && error.includes('not live')) {
    return (
      <>
      <TopNav />
      <Box sx={{ maxWidth: 480, mx: 'auto', p: 3, textAlign: 'center' }}>
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
    <Box sx={{ maxWidth: 480, mx: 'auto', p: 2 }}>
      {(youreUp || myCourt) && (
        <Alert severity="success" sx={{ mb: 2, fontSize: '1.3rem' }}>
          🏓 YOU&apos;RE UP — COURT {youreUp?.court ?? myCourt?.number}
        </Alert>
      )}

      <Typography variant="h5" gutterBottom>Hi {me.name} 👋</Typography>

      {!my ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          You&apos;re not checked in to this session yet — scan the QR code at the venue.
        </Alert>
      ) : (
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Card>
            <CardContent>
              {my.status === 'playing' && myCourt ? (
                <>
                  <Typography variant="h6">
                    You&apos;re playing on <strong>Court {myCourt.number}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Game over? Report the score (Team 1 = {myCourt.teamA.map((x) => x.name).join(' + ')})
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                      size="small" sx={{ width: 72 }} label="Team 1" inputMode="numeric"
                      value={score.a} onChange={(e) => setScore({ ...score, a: e.target.value })}
                    />
                    <TextField
                      size="small" sx={{ width: 72 }} label="Team 2" inputMode="numeric"
                      value={score.b} onChange={(e) => setScore({ ...score, b: e.target.value })}
                    />
                    <Button variant="contained" size="small" disabled={!score.a || !score.b} onClick={reportScore}>
                      Report
                    </Button>
                  </Stack>
                </>
              ) : my.status === 'paused' ? (
                <Typography variant="h6">You&apos;re paused ⏸</Typography>
              ) : queuePos >= 0 ? (
                <>
                  <Typography variant="h6">
                    You&apos;re <strong>#{queuePos + 1}</strong> in the queue
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.max(5, 100 - (queuePos / Math.max(1, board.waiting.length)) * 100)}
                    sx={{ mt: 1 }}
                  />
                </>
              ) : (
                <Typography variant="h6">Waiting for the next draw…</Typography>
              )}
              <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
                <Chip label={`${my.gamesPlayed} games`} />
                <Chip label={`paired ${my.coverage.played}/${my.coverage.total}`} variant="outlined" />
                {my.deficit > 0 && <Chip label={`catching up +${my.deficit}`} color="warning" />}
              </Stack>
            </CardContent>
          </Card>

          <Stack direction="row" spacing={1}>
            {my.status === 'paused' ? (
              <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={() => pauseResume('resume')}>
                I&apos;m back
              </Button>
            ) : my.status === 'active' ? (
              <Button variant="outlined" startIcon={<PauseIcon />} onClick={() => pauseResume('pause')}>
                Step out (pause)
              </Button>
            ) : null}
            {!notifOk && typeof Notification !== 'undefined' && (
              <Button variant="outlined" startIcon={<NotificationsIcon />} onClick={enableNotifications}>
                Alert me when I&apos;m up
              </Button>
            )}
          </Stack>

          {myPending.length > 0 && (
            <Card sx={{ borderColor: 'rgba(251,191,36,0.6)' }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>Confirm score</Typography>
                {myPending.map((p) => {
                  const iReported = p.reportedById === me.id;
                  return (
                    <Stack key={p.gameId} spacing={1} mb={1}>
                      <Typography variant="body2">
                        {p.teamA.map((x) => x.name).join(' + ')} <strong>{p.a}</strong> —{' '}
                        <strong>{p.b}</strong> {p.teamB.map((x) => x.name).join(' + ')}
                        {p.disputed && ' · ⚠️ disputed (host will resolve)'}
                      </Typography>
                      {!iReported && !p.disputed && (
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="contained" onClick={() => confirmOrDispute(p.gameId, 'confirm')}>
                            Confirm
                          </Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => confirmOrDispute(p.gameId, 'dispute')}>
                            Dispute
                          </Button>
                        </Stack>
                      )}
                      {iReported && !p.disputed && (
                        <Typography variant="caption" color="text.secondary">
                          Waiting for the other team (auto-confirms in 10 min)
                        </Typography>
                      )}
                    </Stack>
                  );
                })}
              </CardContent>
            </Card>
          )}

        </Stack>
      )}

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Courts right now
            </Typography>
            <Stack spacing={1.5}>
              {board.courts.map((c) => (
                <Box key={c.courtId} sx={{ opacity: c.gameId ? 1 : 0.8 }}>
                  <CourtCard
                    size="sm"
                    palette={club?.theme}
                    number={c.number}
                    startedAt={c.gameId ? c.startedAt : null}
                    teamA={c.teamA}
                    teamB={c.teamB}
                    headerRight={!c.gameId ? (
                      <Chip size="small" label="OPEN" variant="outlined" sx={{ height: 20, fontWeight: 700 }} />
                    ) : undefined}
                  />
                </Box>
              ))}
              {board.nextMatch && (
                <CourtCard
                  size="sm"
                  palette={club?.theme}
                  title="Up next" chipLabel="Next match"
                  teamA={board.nextMatch.teamA}
                  teamB={board.nextMatch.teamB}
                  headerRight={<Chip size="small" label="Auto" color="success" sx={{ height: 20, fontWeight: 700 }} />}
                />
              )}
            </Stack>
            <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" useFlexGap>
              {board.waiting.map((p, i) => (
                <QueueChip
                  key={p.id} small
                  player={p}
                  prefix={`${i + 1}. `}
                  highlight={p.id === me.id}
                  warn={p.id !== me.id && p.deficit > 0}
                />
              ))}
            </Stack>
          </Box>
    </Box>
    </>
  );
}
