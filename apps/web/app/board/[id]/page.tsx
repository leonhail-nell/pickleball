'use client';

import { use, useEffect, useState } from 'react';
import { api, type Standing } from '@/lib/api';
import { useBoard } from '@/lib/useBoard';
import { CourtCard, UpNextCard, StatsBar, CoverageTile } from '@/components/board';
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
    <Box className="tv" sx={{ maxWidth: 1500, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {youreUp && (
        <Alert severity="success" sx={{ mb: 2, fontSize: '1.4rem' }}>
          🏓 YOU&apos;RE UP — COURT {youreUp.court}
        </Alert>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="baseline" flexWrap="wrap" gap={1.5} mb={2.5}>
        <Stack direction="row" spacing={1.5} alignItems="baseline" flexWrap="wrap" useFlexGap>
          <Typography variant="h4" component="h1" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
            Open Play — Live
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}>
            {board.courts.filter((c) => c.gameId).length} of {board.courts.length} courts active
          </Typography>
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
                palette={board.clubTheme}
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

      </Grid>

      {/* ── up next: waiting courts auto-filled from the queue ──── */}
      <Stack direction="row" spacing={1.25} alignItems="baseline" mt={4} mb={1.5}>
        <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Up next</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.45)' }}>
          waiting courts · auto-filled from the queue
        </Typography>
      </Stack>
      <Grid container spacing={2}>
        {(() => {
          const idleCourts = board.courts.filter((c) => !c.gameId).length;
          const nm = board.nextMatch;
          const nmPlayers = nm ? [...nm.teamA, ...nm.teamB] : [];
          const nmIds = new Set(nmPlayers.map((p) => p.id));
          const rest = board.waiting.filter((w) => !nmIds.has(w.id));
          const groups: { players: typeof nmPlayers; label: string }[] = [];
          if (nm) groups.push({ players: nmPlayers, label: 'Auto-matched' });
          for (let i = 0; i < rest.length; i += 4) {
            const chunk = rest.slice(i, i + 4);
            groups.push({ players: chunk, label: `Queue #${i + 1}–${i + chunk.length}` });
          }
          const cardCount = Math.min(4, Math.max(groups.length, board.courts.length, 1));
          while (groups.length < cardCount) groups.push({ players: [], label: 'Empty' });
          return groups.slice(0, 4).map((g, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <UpNextCard
                title={`Up Next ${i + 1}`}
                rightLabel={g.label}
                players={g.players}
                footer={
                  g.players.length === 4
                    ? (idleCourts === 0 ? 'All courts full' : 'Starting soon…')
                    : g.players.length
                      ? 'Waiting for more players'
                      : 'No players waiting'
                }
              />
            </Grid>
          ));
        })()}
      </Grid>

      <Grid container spacing={2.5} mt={2}>
        {standings.length > 0 && (
          <Grid size={{ xs: 12, md: 5 }}>
            <Card sx={{ pb: 1 }}>
              <Leaderboard sessionId={id} standings={standings} limit={10} title />
            </Card>
          </Grid>
        )}
        <Grid size={{ xs: 12, md: standings.length > 0 ? 7 : 12 }}>
          <Card>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={1.25} alignItems="baseline" mb={2}>
                <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                  Fairness check
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.45)' }}>
                  games played & partner coverage
                </Typography>
              </Stack>
              <Grid container spacing={1.5}>
                {board.players
                  .slice()
                  .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
                  .map((p) => (
                    <Grid key={p.id} size={{ xs: 12, sm: 6 }}>
                      <CoverageTile player={p} />
                    </Grid>
                  ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="caption" color="text.secondary" display="block" mt={4}>
        🔒 Fair play guaranteed — every matchup is drawn by a verified random shuffle.
      </Typography>
    </Box>
    </>
  );
}
