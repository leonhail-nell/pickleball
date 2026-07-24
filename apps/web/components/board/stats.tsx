"use client";

import { avatarSrcFor, Stars } from "@/components/board/avatar";
import { LEGACY_COURT } from "@/constant/court";
import type { BoardPlayer } from "@/types/board";
import { Avatar, Badge, Box, CircularProgress, Stack, Typography } from "@mui/material";

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

/**
 * Fairness-check tile: avatar with an on-court dot, games + partner coverage,
 * and an amber progress bar (design-system "Fairness check" card).
 */
export function CoverageTile({ player }: { player: BoardPlayer }) {
  const pct = player.coverage.total
    ? Math.min(100, (player.coverage.played / player.coverage.total) * 100)
    : 0;
  return (
    <Box
      sx={{
        bgcolor: "#ffffff",
        border: "1px solid #e7efe2",
        borderRadius: "14px",
        p: 1.75,
        display: "flex",
        gap: 1.75,
        alignItems: "center",
        height: "100%",
        boxSizing: "border-box",
      }}
    >
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        variant="dot"
        invisible={player.status !== "playing"}
        sx={{
          "& .MuiBadge-dot": {
            bgcolor: "#22c55e",
            width: 13,
            height: 13,
            borderRadius: "50%",
            border: "2.5px solid #ffffff",
            top: 5,
            right: 5,
          },
        }}
      >
        <Avatar
          src={avatarSrcFor(player)}
          alt={player.name}
          sx={{ width: 56, height: 56, bgcolor: "#d1e7c9" }}
        />
      </Badge>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontWeight: 800, fontSize: "1rem", color: LEGACY_COURT.ink }}>
          {player.name}
          {player.status === "paused" ? " ⏸" : ""}
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(28,42,26,0.55)", display: "block" }}>
          {player.gamesPlayed} games · {player.coverage.played}/{player.coverage.total} partners
        </Typography>
        <Box
          sx={{
            mt: 0.9,
            height: 5,
            borderRadius: 999,
            bgcolor: "rgba(28,42,26,0.10)",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 999,
              bgcolor: LEGACY_COURT.star,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
