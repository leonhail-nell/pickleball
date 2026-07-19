"use client";

import { PlayerAvatar, PlayerStars } from "@/components/board/avatar";
import { DotClock } from "@/components/board/clock";
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
              color: "rgba(244,251,239,0.7)",
              cursor: "pointer",
              "&:hover": { color: "#fff" },
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
          border: "2px dashed rgba(244,251,239,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(244,251,239,0.9)",
          cursor: onAdd ? "pointer" : "default",
          bgcolor: "rgba(255,255,255,0.12)",
        }}
      >
        <AddIcon sx={{ fontSize: compact ? 22 : 28 }} />
      </Box>
      <Typography
        fontWeight={700}
        sx={{ color: COURT.courtText, fontSize: compact ? "0.78rem" : "0.9rem" }}
      >
        Open slot
      </Typography>
    </Stack>
  );
}

/**
 * Court diagram matching the mockup: a green playing surface with a dark net
 * stripe down the middle flanked by two "KITCHEN" labels, and the four player
 * seats in the corners (avatar + name + swap + stars). Empty seats become
 * dashed "Open slot" placeholders.
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

  const line = `3px solid ${COURT.courtLine}`;
  const cellPy = compact ? 1.5 : 2.25;

  /* one player half: two stacked seats split by a horizontal mid-line.
     Padding lives inside the cells so zones fill the surface edge-to-edge. */
  const half = (players: NamedPlayer[]) => (
    <Stack sx={{ position: "relative", zIndex: 1 }}>
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
        bgcolor: live ? COURT.surfaceAlt : COURT.surface,
        borderRadius: R.surface,
        position: "relative",
        overflow: "hidden",
        border: line,
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto 1fr",
        alignItems: "stretch",
        columnGap: 0,
      }}
    >
      {/* left half (Team A) */}
      {half(teamA)}

      {/* left kitchen zone — bordered box, full height */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: compact ? 0.75 : 2,
          borderLeft: line,
          backgroundColor: COURT.kitchen,
        }}
      >
        {kitchen}
      </Box>

      {/* full-height diagonally-striped net */}
      <Box
        aria-hidden
        sx={{
          width: compact ? 8 : 11,
          backgroundImage: NET_HATCH,
          alignSelf: "stretch",
        }}
      />

      {/* right kitchen zone — bordered box, full height */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: compact ? 0.75 : 2,
          borderRight: line,
          backgroundColor: COURT.kitchen,
        }}
      >
        {kitchen}
      </Box>

      {/* right half (Team B) */}
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

/**
 * Full court card: rounded white card with header (Court N + status pill +
 * live dot timer) wrapping a CourtSurface. `header`/`footer` slots let callers
 * inject extra controls (host actions) without changing the shell.
 */
export function CourtCard({
  number,
  label,
  statusLabel,
  startedAt,
  teamA,
  teamB,
  onSwap,
  compact,
  header,
  footer,
  live,
}: {
  number?: number;
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
}) {
  return (
    <Box
      sx={{
        bgcolor: COURT.card,
        borderRadius: R.card,
        p: compact ? 1.75 : 2.25,
        border: `1px solid ${COURT.border}`,
        boxShadow: "0 2px 10px rgba(20,54,26,0.05)",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb={compact ? 1.25 : 1.75}
        gap={1}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.25}
          sx={{ minWidth: 0 }}
        >
          {number ? (
            <Typography
              fontWeight={900}
              sx={{
                color: COURT.text,
                fontSize: compact ? "1.1rem" : "1.4rem",
                letterSpacing: "-0.01em",
              }}
              noWrap
            >
              Court {number}
              {label ? ` · ${label}` : ""}
            </Typography>
          ) : null}
          {statusLabel && <CourtStatusPill label={statusLabel} />}
        </Stack>
        {startedAt != null ? <DotClock startedAt={startedAt} /> : header}
      </Stack>

      <CourtSurface
        teamA={teamA}
        teamB={teamB}
        onSwap={onSwap}
        compact={compact}
        live={live}
      />

      {footer && <Box mt={compact ? 1.25 : 1.75}>{footer}</Box>}
    </Box>
  );
}
