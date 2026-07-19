'use client';

import { use, useEffect, useState } from 'react';
import { api, type Standing } from '@/lib/api';
import { useBoard } from '@/lib/useBoard';
import { useClub } from '@/lib/useClub';
import { CourtCard, QueueChip, StatsBar, CoverageRing } from '@/components/board';
import { Avatar } from '@mui/material';
import { Leaderboard } from '@/components/leaderboard';
import { TopNav } from '@/components/nav';
import {
  Alert, Box, Card, CardContent, Chip, Stack, Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import { Button } from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';

/** Public TV / kiosk queue board — read-only, live via Socket.IO. */
export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { board, youreUp, error } = useBoard(id);
  const club = useClub();
  const [standings, setStandings] = useState<Standing[]>([]);

  // refresh the leaderboard whenever the board changes (games finish)
  useEffect(() => {
    api<Standing[]>(`/sessions/${id}/standings`).then(setStandings).catch(() => {});
  }, [id, board]);

  if (error) return <Box p={3}><Alert severity="error">{error}</Alert></Box>;
  if (!board) return <Box p={3}><Typography>Loading board…</Typography></Box>;

  return (
    <>
    <TopNav />
    <Box className="tv" sx={{ maxWidth: 1500, mx: 'auto', p: 3 }}>
      {youreUp && (
        <Alert severity="success" sx={{ mb: 2, fontSize: '1.4rem' }}>
          🏓 YOU&apos;RE UP — COURT {youreUp.court}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: '12px !important' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="h4" component="h1">Open Play — Live</Typography>
              {board.rotationsPaused && <Chip color="warning" label="⏸ PAUSED" sx={{ fontWeight: 800 }} />}
            </Stack>
            <Stack direction="row" spacing={2} alignItems="center">
              <StatsBar
                courts={board.courts.length}
                players={board.players.length}
                queue={board.waiting.length}
              />
              <Button
                size="small" variant="outlined" startIcon={<ShareIcon />}
                onClick={async () => {
                  const url = window.location.href;
                  const top = standings.slice(0, 3).map((r) => `${r.rank}. ${r.name} (${r.wins}-${r.losses})`).join('  ');
                  const text = top ? `🏓 Open play standings!\n🏆 ${top}\n${url}` : `🏓 Follow our open play live: ${url}`;
                  try {
                    if (navigator.share) await navigator.share({ title: 'Open Play', text, url });
                    else await navigator.clipboard.writeText(text);
                  } catch { /* cancelled */ }
                }}
              >
                Share
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {board.courts.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This session has no courts attached — games can&apos;t start. Create a new session with courts.
        </Alert>
      )}

      <Grid container spacing={2}>
        {board.courts.map((c) => (
          <Grid key={c.courtId} size={{ xs: 12, sm: 6, md: 4 }}>
            <Box sx={{ opacity: c.gameId ? 1 : 0.8 }}>
              <CourtCard
                number={c.number}
                label={c.label || undefined}
                startedAt={c.gameId ? c.startedAt : null}
                palette={club?.theme}
                teamA={c.teamA}
                teamB={c.teamB}
                headerRight={!c.gameId ? (
                  <Chip size="small" label="OPEN" variant="outlined" sx={{ height: 22, fontWeight: 700 }} />
                ) : undefined}
                footer={c.gameId && c.assignmentType === 'manual' ? (
                  <Chip size="small" color="error" label="manual assignment" />
                ) : undefined}
              />
            </Box>
          </Grid>
        ))}

        {board.nextMatch && (
          <Grid size={{ xs: 12, md: 6 }}>
            <CourtCard
              title="Up next" chipLabel="Next match"
              palette={club?.theme}
              teamA={board.nextMatch.teamA}
              teamB={board.nextMatch.teamB}
              headerRight={<Chip size="small" label="Auto" color="success" sx={{ height: 22, fontWeight: 700 }} />}
            />
          </Grid>
        )}
      </Grid>

      <Typography variant="h6" color="text.secondary" mt={4} mb={1}>Next up</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {board.waiting.map((p, i) => (
          <QueueChip key={p.id} player={p} prefix={`${i + 1}. `} warn={p.deficit > 0} />
        ))}
        {!board.waiting.length && <Typography color="text.secondary">Everyone is playing.</Typography>}
      </Stack>

      {standings.length > 0 && (
        <>
          <Typography variant="h6" color="text.secondary" mt={4} mb={1}>
            🏆 Leaderboard
          </Typography>
          <Card sx={{ maxWidth: 640 }}>
            <Leaderboard sessionId={id} standings={standings} dense limit={10} />
          </Card>
        </>
      )}

      <Typography variant="h6" color="text.secondary" mt={3} mb={1}>
        Fairness check — games played & partner coverage
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {board.players
          .slice()
          .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
          .map((p) => (
            <Card key={p.id} sx={{ px: 1.5, py: 1 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Avatar src={p.avatarUrl ?? undefined} sx={{ width: 34, height: 34, fontSize: '0.85rem', fontWeight: 700, bgcolor: '#4c9a44' }}>
                  {p.name?.[0]?.toUpperCase()}
                </Avatar>
                <CoverageRing played={p.coverage.played} total={p.coverage.total} />
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {p.name}{p.status === 'paused' ? ' ⏸' : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {p.gamesPlayed} games · {p.coverage.played}/{p.coverage.total} partners
                  </Typography>
                </Box>
              </Stack>
            </Card>
          ))}
      </Stack>

      <Typography variant="caption" color="text.secondary" display="block" mt={4}>
        🔒 Fair play guaranteed — every matchup is drawn by a verified random shuffle.
      </Typography>
    </Box>
    </>
  );
}
