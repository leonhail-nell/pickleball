"use client";

import { CourtCard } from "@/components/board";
import type { Board } from "@/lib/api";
import { Box, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";

/** Read-only "Courts right now" section for the player's personal view. */
export function CourtsNow({ board, meId }: { board: Board; meId: string }) {
  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        Courts right now
      </Typography>
      <Grid container spacing={1.5}>
        {board.courts.map((c) => (
          <Grid key={c.courtId} size={{ xs: 12, sm: 6 }}>
            <CourtCard
              compact
              number={c.number}
              statusLabel={c.gameId ? "Open Play" : "Filling"}
              startedAt={c.gameId ? c.startedAt : undefined}
              teamA={c.teamA}
              teamB={c.teamB}
              live={!!c.gameId}
            />
          </Grid>
        ))}
      </Grid>
      {board.nextMatch && (
        <Box sx={{ mt: 1.5 }}>
          <CourtCard
            compact
            title="Next match"
            chipLabel="Auto"
            teamA={board.nextMatch.teamA}
            teamB={board.nextMatch.teamB}
          />
        </Box>
      )}
      <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" useFlexGap>
        {board.waiting.map((p, i) => (
          <Chip
            key={p.id}
            size="small"
            label={`${i + 1}. ${p.name}`}
            color={p.id === meId ? "primary" : p.deficit > 0 ? "warning" : "default"}
            variant={p.id === meId ? "filled" : "outlined"}
          />
        ))}
      </Stack>
    </Box>
  );
}
