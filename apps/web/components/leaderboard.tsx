'use client';

import { useState } from 'react';
import { api, type PlayerGame, type Standing } from '@/lib/api';
import {
  Avatar, Box, Chip, Dialog, DialogContent, DialogTitle, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';
import { avatarSrcFor } from '@/components/board';

const MEDALS = ['#e8a812', '#8fa3b5', '#c96a1b']; // gold, silver, bronze

/** Design-system leaderboard: medal · avatar + name (+/- below) · W-L · win %.
 *  Tap a row for that player's match history. */
export function Leaderboard({
  sessionId, standings, dense = false, limit, title = false,
}: {
  sessionId: string;
  standings: Standing[];
  dense?: boolean;
  limit?: number;
  /** Render the in-card "Leaderboard — by win rate" heading. */
  title?: boolean;
}) {
  const [history, setHistory] = useState<{ name: string; games: PlayerGame[] } | null>(null);

  async function openHistory(row: Standing) {
    try {
      const games = await api<PlayerGame[]>(`/sessions/${sessionId}/players/${row.userId}/games`);
      setHistory({ name: row.name, games });
    } catch {
      /* history unavailable */
    }
  }

  const rows = limit ? standings.slice(0, limit) : standings;
  const headSx = {
    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
    textTransform: 'uppercase' as const, color: 'rgba(28,42,26,0.45)',
    borderColor: '#eef3ea',
  };

  return (
    <>
      {title && (
        <Stack direction="row" spacing={1.25} alignItems="baseline" sx={{ px: 2.5, pt: 2.25, pb: 0.5 }}>
          <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Leaderboard</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.45)' }}>by win rate</Typography>
        </Stack>
      )}
      <Box sx={{ overflowX: 'auto' }}>
      <Table size={dense ? 'small' : 'medium'} sx={{ minWidth: 360 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...headSx, width: 52 }}>#</TableCell>
            <TableCell sx={headSx}>Player</TableCell>
            <TableCell sx={headSx} align="right">W – L</TableCell>
            <TableCell sx={headSx} align="right">Win %</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.userId}
              hover
              onClick={() => openHistory(r)}
              sx={{ cursor: 'pointer', '& td': { borderColor: '#eef3ea', py: dense ? 1 : 1.75 } }}
            >
              <TableCell>
                {r.rank <= 3 ? (
                  <MilitaryTechIcon sx={{ color: MEDALS[r.rank - 1], fontSize: dense ? 22 : 28 }} />
                ) : (
                  <Typography sx={{ fontWeight: 700, color: 'rgba(28,42,26,0.45)', pl: 0.5 }}>{r.rank}</Typography>
                )}
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar
                    src={avatarSrcFor({ id: r.userId, name: r.name, avatarUrl: r.avatarUrl })}
                    alt={r.name}
                    sx={{ width: dense ? 34 : 46, height: dense ? 34 : 46, fontSize: '0.9rem', bgcolor: '#d1e7c9' }}
                  >
                    {r.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 800, fontSize: dense ? '0.9rem' : '1.05rem' }}>
                      {r.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{ color: 'rgba(28,42,26,0.45)' }}
                    >
                      {r.diff >= 0 ? `+${r.diff}` : r.diff}
                    </Typography>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell align="right">
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: dense ? '0.9rem' : '1.05rem',
                    whiteSpace: 'nowrap',
                    color: '#2f6b2b',
                  }}
                >
                  {r.wins} – {r.losses}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography sx={{ fontWeight: 800, fontSize: dense ? '0.9rem' : '1.05rem' }}>
                  {Math.round(r.winPct * 100)}%
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={4} sx={{ borderColor: '#eef3ea' }}>
                <Typography color="text.secondary" variant="body2">
                  No completed games yet.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      </Box>

      <Dialog open={!!history} onClose={() => setHistory(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{history?.name} — match history</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            {history?.games.map((g) => (
              <Box key={g.gameId} sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    size="small"
                    label={g.win ? 'WIN' : 'LOSS'}
                    color={g.win ? 'success' : 'error'}
                    sx={{ fontWeight: 800, height: 20 }}
                  />
                  <Typography variant="body2" fontWeight={700}>
                    {g.myScore ?? '–'} - {g.theirScore ?? '–'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">Court {g.court}</Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  with {g.partner} · vs {g.opponents.join(' + ')}
                </Typography>
              </Box>
            ))}
            {history && !history.games.length && (
              <Typography color="text.secondary" variant="body2">No games yet.</Typography>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
