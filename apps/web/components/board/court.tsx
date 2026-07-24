"use client";

import { PlayerAvatar, PlayerStars } from "@/components/board/avatar";
import { LegacyCourtCard } from "@/components/board/legacy-court";
import { COURT, NET_HATCH, R } from "@/constant/court";
import type { NamedPlayer } from "@/lib/api";
import AddIcon from "@mui/icons-material/Add";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { Box, Stack, Typography } from "@mui/material";

/* ── one player seat in a court corner ── */
function CourtSeat({
  player,
  onSwap,
  compact,
}: {
  player: NamedPlayer;
  onSwap?: (id: string) => void;
  compact?: boolean;
}) {
  const size = compact ? 52 : 64;

  return (
    <Stack alignItems="center" spacing={0.4} sx={{ minWidth: 0 }}>
      <PlayerAvatar name={player.name} size={size} />
      <Stack
        direction="row"
        spacing={0.3}
        alignItems="center"
        sx={{ maxWidth: "100%" }}
      >
        <Typography
          fontWeight={800}
          noWrap
          sx={{ color: COURT.courtText, fontSize: compact ? "0.85rem" : "1rem" }}
        >
          {player.name}
        </Typography>
        {onSwap && (
          <SwapHorizIcon
            onClick={() => onSwap(player.id)}
            sx={{
              fontSize: 16,
              color: "rgba(28,42,26,0.45)",
              cursor: "pointer",
              "&:hover": { color: COURT.text },
            }}
          />
        )}
      </Stack>
      <PlayerStars rating={player.rating} size="small" />
    </Stack>
  );
}

/* ── empty "Open slot" seat with dashed ring ── */
function OpenSeat({ compact, onAdd }: { compact?: boolean; onAdd?: () => void }) {
  const size = compact ? 52 : 64;
  return (
    <Stack alignItems="center" spacing={0.4}>
      <Box
        onClick={onAdd}
        sx={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: "2px dashed #6fa761",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#4c8a41",
          cursor: onAdd ? "pointer" : "default",
          bgcolor: "rgba(255,255,255,0.5)",
        }}
      >
        <AddIcon sx={{ fontSize: compact ? 22 : 28 }} />
      </Box>
      <Typography
        fontWeight={700}
        sx={{ color: COURT.pillText, fontSize: compact ? "0.78rem" : "0.9rem" }}
      >
        Open slot
      </Typography>
    </Stack>
  );
}

/**
 * Court diagram: pale mint surface, dark hatched net flanked by KITCHEN
 * labels, four corner seats (avatar + name + swap + stars).
 */
export function CourtSurface({
  teamA,
  teamB,
  onSwap,
  compact,
  live,
}: {
  teamA: NamedPlayer[];
  teamB: NamedPlayer[];
  onSwap?: (id: string) => void;
  compact?: boolean;
  live?: boolean;
}) {
  const seat = (players: NamedPlayer[], idx: number) =>
    players[idx] ? (
      <CourtSeat player={players[idx]} onSwap={onSwap} compact={compact} />
    ) : (
      <OpenSeat compact={compact} />
    );

  const kitchen = (
    <Typography
      sx={{
        writingMode: "vertical-rl",
        transform: "rotate(180deg)",
        letterSpacing: 3,
        fontWeight: 800,
        fontSize: compact ? "0.5rem" : "0.62rem",
        color: COURT.kitchenText,
      }}
    >
      KITCHEN
    </Typography>
  );

  const line = `2px solid ${COURT.courtLine}`;
  const cellPy = compact ? 1.5 : 2.25;

  const half = (players: NamedPlayer[]) => (
    <Stack sx={{ position: "relative", zIndex: 1, bgcolor: live ? COURT.surfaceAlt : COURT.surface }}>
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: cellPy,
          px: 1,
          borderBottom: line,
        }}
      >
        {seat(players, 0)}
      </Box>
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: cellPy,
          px: 1,
        }}
      >
        {seat(players, 1)}
      </Box>
    </Stack>
  );

  return (
    <Box
      sx={{
        borderRadius: R.court,
        position: "relative",
        overflow: "hidden",
        border: `9px solid ${COURT.surface}`,
        boxShadow: "inset 0 0 0 9px #a3cd94",
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto 1fr",
        alignItems: "stretch",
        columnGap: 0,
        bgcolor: "#fff",
      }}
    >
      {half(teamA)}

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: compact ? 0.75 : 1.25,
          backgroundColor: COURT.kitchen,
        }}
      >
        {kitchen}
      </Box>

      <Box
        aria-hidden
        sx={{
          width: compact ? 8 : 11,
          backgroundImage: NET_HATCH,
          alignSelf: "stretch",
        }}
      />

      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: compact ? 0.75 : 1.25,
          backgroundColor: COURT.kitchen,
        }}
      >
        {kitchen}
      </Box>

      {half(teamB)}
    </Box>
  );
}

/** Status pill for a court header ("OPEN PLAY", "FILLING", …). */
export function CourtStatusPill({ label }: { label: string }) {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.3,
        borderRadius: 999,
        bgcolor: COURT.pillBg,
        color: COURT.pillText,
        fontWeight: 800,
        fontSize: "0.68rem",
        letterSpacing: 0.5,
      }}
    >
      {label.toUpperCase()}
    </Box>
  );
}

type LegacyProps = Parameters<typeof LegacyCourtCard>[0];

/**
 * Unified court card — pale-slot / green-frame mockup look (LegacyCourtCard).
 * Accepts both the modern prop names (statusLabel, onSwap, compact, header)
 * and the Venue Pro palette props.
 */
export function CourtCard(
  props: {
    number?: number | string;
    label?: string;
    statusLabel?: string;
    startedAt?: number | null;
    teamA: NamedPlayer[];
    teamB: NamedPlayer[];
    onSwap?: (id: string) => void;
    compact?: boolean;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    live?: boolean;
  } & Partial<LegacyProps>,
) {
  const onPlayerClick =
    props.onPlayerClick ??
    (props.onSwap
      ? (p: NamedPlayer) => {
          props.onSwap!(p.id);
        }
      : undefined);

  return (
    <LegacyCourtCard
      number={props.number}
      title={props.title}
      label={props.label}
      chipLabel={props.chipLabel ?? props.statusLabel ?? "Open Play"}
      startedAt={props.startedAt}
      teamA={props.teamA}
      teamB={props.teamB}
      onPlayerClick={onPlayerClick}
      onEmptySlotClick={props.onEmptySlotClick}
      headerRight={props.headerRight ?? props.header}
      footer={props.footer}
      size={props.size ?? (props.compact ? "sm" : "md")}
      palette={props.palette}
    />
  );
}
