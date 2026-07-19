'use client';

import { useState } from 'react';
import { api, type PlayerGame, type Standing } from '@/lib/api';
import {
  Avatar, Box, Chip, Dialog, DialogContent, DialogTitle, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';

const MEDALS = ['#e8a812', '#8fa3b5', '#c96a1b']; // gold, silver, bronze

/** PickleHub-style leaderboard: rank · player · +/- · W-L · win %.
 *  Tap a row for that player's match history. */
export function Leaderboard({
  sessionId, standings, dense = false, limit,
}: {
  sessionId: string;
  standings: Standing[];
  dense?: boolean;
  limit?: number;
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

  return (
    <>
      <Table size={dense ? 'small' : 'medium'}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 48 }}>#</TableCell>
            <TableCell>Player</TableCell>
            <TableCell align="right">W - L</TableCell>
            <TableCell align="right">Win %</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.userId}
              hover
              onClick={() => openHistory(r)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell>
                {r.rank <= 3 ? (
                  <EmojiEventsIcon sx={{ color: MEDALS[r.rank - 1], fontSize: 20 }} />
                ) : (
                  r.rank
                )}
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Avatar src={r.avatarUrl ?? undefined} sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: 'secondary.main' }}>
                    {r.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={700} variant="body2">{r.name}</Typography>
                    <Typography variant="caption" color={r.diff >= 0 ? 'success.main' : 'error.main'}>
                      {r.diff >= 0 ? `+${r.diff}` : r.diff}
                    </Typography>
                  </Box>
                </Stack>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700}>
                  <Box component="span" sx={{ color: 'success.main' }}>{r.wins}</Box>
                  {' - '}
                  <Box component="span" sx={{ color: 'error.main' }}>{r.losses}</Box>
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="body2" fontWeight={700}>
                  {Math.round(r.winPct * 100)}%
                </Typography>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={4}>
                <Typography color="text.secondary" variant="body2">
                  No completed games yet.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

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
