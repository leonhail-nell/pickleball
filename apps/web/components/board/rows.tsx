"use client";

import { PlayerAvatar, PlayerStars } from "@/components/board/avatar";
import { COURT, R } from "@/constant/court";
import type { NamedPlayer } from "@/lib/api";
import { Box, Stack, Typography } from "@mui/material";

/**
 * Waiting-queue row (mockup): rank number, avatar, name, stars + "Ng · X/Y"
 * stat line, and optional trailing action slot (edit / remove / pause).
 */
export function QueueRow({
  rank,
  player,
  highlight,
  actions,
}: {
  rank: number;
  player: {
    id: string;
    name: string;
    rating: number;
    gamesPlayed?: number;
    coverage?: { played: number; total: number };
    avatarUrl?: string | null;
  };
  highlight?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        pl: 1.5,
        pr: 1.75,
        py: 1.1,
        borderRadius: R.row,
        bgcolor: highlight ? "rgba(245,166,35,0.14)" : "#e6f2dc",
        border: "1px solid rgba(47,125,50,0.1)",
      }}
    >
      <Typography
        sx={{
          width: 20,
          textAlign: "center",
          color: "rgba(20,54,26,0.5)",
          fontWeight: 800,
          fontSize: "1rem",
        }}
      >
        {rank || ""}
      </Typography>
      <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size={44} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography fontWeight={800} noWrap sx={{ color: COURT.text }}>
          {player.name}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <PlayerStars rating={player.rating} size="small" />
          {(player.gamesPlayed != null || player.coverage) && (
            <Typography
              variant="caption"
              sx={{ color: "rgba(20,54,26,0.6)", fontWeight: 600 }}
            >
              {player.gamesPlayed ?? 0}g
              {player.coverage
                ? ` · ${player.coverage.played}/${player.coverage.total}`
                : ""}
            </Typography>
          )}
        </Stack>
      </Box>
      {actions && (
        <Stack direction="row" spacing={0.25} alignItems="center">
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

/** Check-in list row: avatar, name (rating), trailing action slot. */
export function CheckInRow({
  player,
  actions,
}: {
  player: {
    id: string;
    name: string;
    rating: number;
    avatarUrl?: string | null;
  };
  actions?: React.ReactNode;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        pl: 1.5,
        pr: 1.75,
        py: 1.1,
        borderRadius: R.row,
        bgcolor: "#e6f2dc",
        border: "1px solid rgba(47,125,50,0.1)",
      }}
    >
      <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size={44} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography fontWeight={800} sx={{ color: COURT.text }} noWrap>
          {player.name}{" "}
          <Typography
            component="span"
            variant="caption"
            sx={{ color: "rgba(20,54,26,0.55)", fontWeight: 600 }}
          >
            ({player.rating.toFixed(2)})
          </Typography>
        </Typography>
        <PlayerStars rating={player.rating} size="small" />
      </Box>
      {actions && (
        <Stack direction="row" spacing={0.5} alignItems="center">
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

/**
 * Legacy colored team panel with avatars + star ratings (compact layout).
 * Kept for older call sites (next-match previews, drop zones).
 */
export function TeamPanel({
  label,
  players,
  color,
  onRemove,
}: {
  label: string;
  players: NamedPlayer[];
  color: string;
  onRemove?: (id: string) => void;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid rgba(47,125,50,0.14)",
        bgcolor: COURT.surface,
      }}
    >
      <Box sx={{ bgcolor: color, px: 1.5, py: 0.55 }}>
        <Typography
          variant="caption"
          fontWeight={800}
          sx={{ color: "#fff", letterSpacing: 1.2, fontSize: "0.68rem" }}
        >
          {label.toUpperCase()}
        </Typography>
      </Box>
      <Box sx={{ px: 1.25, py: 1, minHeight: 78 }}>
        {players.map((p, i) => (
          <Stack
            key={p.id}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: i === players.length - 1 ? 0 : 1 }}
          >
            <PlayerAvatar name={p.name} size={34} />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography
                  fontWeight={700}
                  noWrap
                  sx={{ fontSize: "0.9rem", color: COURT.text }}
                >
                  {p.name}
                </Typography>
                {onRemove && (
                  <Typography
                    onClick={() => onRemove(p.id)}
                    sx={{
                      cursor: "pointer",
                      color: "text.secondary",
                      fontSize: "0.8rem",
                      pl: 1,
                    }}
                  >
                    ✕
                  </Typography>
                )}
              </Stack>
              <PlayerStars rating={p.rating} size="small" />
            </Box>
          </Stack>
        ))}
        {!players.length && (
          <Typography variant="caption" color="text.secondary">
            Drop players here
          </Typography>
        )}
      </Box>
    </Box>
  );
}
