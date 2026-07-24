"use client";

import { avatarSrcFor, Stars } from "@/components/board/avatar";
import { LEGACY_COURT } from "@/constant/court";
import type { NamedPlayer } from "@/lib/api";
import { Avatar, Box, Chip, Stack, Typography } from "@mui/material";

/**
 * "Up next" waiting-court card: dashed frame, WAITING chip, 2×2 player tiles
 * (dashed "Open" placeholders for empty seats) and a gray status pill footer.
 */
export function UpNextCard({
  title = "Up next",
  chipLabel = "Waiting",
  rightLabel,
  players,
  footer,
}: {
  title?: string;
  chipLabel?: string;
  rightLabel?: string;
  players: NamedPlayer[];
  footer?: string;
}) {
  const slots: (NamedPlayer | undefined)[] = [
    players[0],
    players[1],
    players[2],
    players[3],
  ];
  return (
    <Box
      sx={{
        bgcolor: "#ffffff",
        border: "2px dashed #cfe3c6",
        borderRadius: "16px",
        p: 2,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: "1.05rem",
            letterSpacing: "-0.02em",
            color: LEGACY_COURT.ink,
          }}
        >
          {title}
        </Typography>
        <Chip
          size="small"
          label={chipLabel}
          sx={{
            bgcolor: "#fdf1d7",
            color: "#b07f24",
            fontWeight: 800,
            height: 22,
            textTransform: "uppercase",
            fontSize: "0.62rem",
            letterSpacing: "0.05em",
          }}
        />
        <Box sx={{ flex: 1 }} />
        {rightLabel && (
          <Typography
            variant="caption"
            sx={{ color: "rgba(28,42,26,0.45)", fontWeight: 600 }}
          >
            {rightLabel}
          </Typography>
        )}
      </Stack>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1.25,
          flex: 1,
        }}
      >
        {slots.map((p, i) =>
          p ? (
            <Stack
              key={p.id}
              direction="row"
              spacing={1.25}
              alignItems="center"
              sx={{
                bgcolor: "#f7faf5",
                border: "1px solid #e7efe2",
                borderRadius: "12px",
                p: 1.25,
                minWidth: 0,
              }}
            >
              <Avatar
                src={avatarSrcFor(p)}
                alt={p.name}
                sx={{ width: 44, height: 44, bgcolor: "#d1e7c9", flexShrink: 0 }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  noWrap
                  sx={{ fontWeight: 800, fontSize: "0.95rem", color: LEGACY_COURT.ink }}
                >
                  {p.name}
                </Typography>
                <Stars value={p.rating} fontSize="0.68rem" />
              </Box>
            </Stack>
          ) : (
            <Stack
              key={`open-${i}`}
              direction="row"
              spacing={1.25}
              alignItems="center"
              sx={{
                bgcolor: "#f7faf5",
                border: "1px solid #e7efe2",
                borderRadius: "12px",
                p: 1.25,
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "2px dashed #b9cfae",
                  flexShrink: 0,
                }}
              />
              <Typography sx={{ color: "rgba(28,42,26,0.45)", fontWeight: 700 }}>
                Open
              </Typography>
            </Stack>
          ),
        )}
      </Box>
      {footer && (
        <Box sx={{ bgcolor: "#e8ebe6", borderRadius: 999, py: 1.1, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 800, color: "#7c877a", fontSize: "0.9rem" }}>
            {footer}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/** "Next up" queue pill: avatar + name + amber stars. */
export function QueueChip({
  player,
  prefix,
  highlight = false,
  warn = false,
  small = false,
}: {
  player: NamedPlayer;
  prefix?: string;
  highlight?: boolean;
  warn?: boolean;
  small?: boolean;
}) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        bgcolor: highlight ? "#22c55e" : warn ? "#fef3c7" : LEGACY_COURT.pillBg,
        border: `1px solid ${highlight ? "#16a34a" : warn ? "#fcd34d" : LEGACY_COURT.pillBorder}`,
        borderRadius: 999,
        pl: 0.5,
        pr: 1.5,
        py: 0.5,
        minWidth: 0,
      }}
    >
      <Avatar
        src={avatarSrcFor(player)}
        alt={player.name}
        sx={{
          width: small ? 24 : 28,
          height: small ? 24 : 28,
          fontSize: "0.7rem",
          fontWeight: 700,
          bgcolor: "#d1e7c9",
        }}
      >
        {player.name?.[0]?.toUpperCase()}
      </Avatar>
      <Typography
        noWrap
        sx={{
          fontSize: small ? "0.78rem" : "0.82rem",
          fontWeight: 600,
          color: highlight ? "#fff" : LEGACY_COURT.ink,
        }}
      >
        {prefix}
        {player.name}
      </Typography>
      <Stars value={player.rating} fontSize={small ? "0.62rem" : "0.68rem"} />
    </Stack>
  );
}
