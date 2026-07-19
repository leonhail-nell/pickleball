"use client";

import { Box, CircularProgress, Stack, Typography } from "@mui/material";

/** COURTS n · PLAYERS n · QUEUE n header strip. */
export function StatsBar({
  courts,
  players,
  queue,
}: {
  courts: number;
  players: number;
  queue: number;
}) {
  const item = (label: string, value: number, color: string) => (
    <Stack direction="row" spacing={0.5} alignItems="baseline">
      <Typography
        variant="caption"
        sx={{ letterSpacing: 1, color: "text.secondary", fontWeight: 700 }}
      >
        {label}
      </Typography>
      <Typography fontWeight={800} sx={{ color }}>
        {value}
      </Typography>
    </Stack>
  );
  return (
    <Stack direction="row" spacing={3}>
      {item("COURTS", courts, courts > 0 ? "#16a34a" : "#ef4444")}
      {item("PLAYERS", players, "#111827")}
      {item("QUEUE", queue, "#d97706")}
    </Stack>
  );
}

/** Coverage ring with a visible track (readable even at 0%). */
export function CoverageRing({
  played,
  total,
}: {
  played: number;
  total: number;
}) {
  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <CircularProgress
        variant="determinate"
        size={34}
        thickness={4}
        value={100}
        sx={{ color: "rgba(17,24,39,0.12)" }}
      />
      <CircularProgress
        variant="determinate"
        size={34}
        thickness={4}
        value={total ? (played / total) * 100 : 0}
        color="success"
        sx={{ position: "absolute", left: 0 }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="caption" fontWeight={700}>
          {played}
        </Typography>
      </Box>
    </Box>
  );
}
