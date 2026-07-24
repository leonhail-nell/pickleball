"use client";

import { avatarSrcFor, Stars } from "@/components/board/avatar";
import { DotClock } from "@/components/board/clock";
import { LEGACY_COURT, type CourtPalette } from "@/constant/court";
import type { NamedPlayer } from "@/lib/api";
import { Avatar, Box, Chip, Stack, Typography } from "@mui/material";

type LegacyPalette = Record<string, string>;

/** One player quadrant on the legacy court card. */
function CourtSlot({
  label,
  player,
  onClick,
  onEmptyClick,
  size,
  palette,
}: {
  label: string;
  player?: NamedPlayer;
  onClick?: (p: NamedPlayer) => void;
  onEmptyClick?: () => void;
  size: "sm" | "md";
  palette: LegacyPalette;
}) {
  const avatar = size === "sm" ? 44 : 56;
  return (
    <Box
      sx={{
        bgcolor: palette.slot,
        px: 1,
        py: size === "sm" ? 1.25 : 1.75,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.75,
        minWidth: 0,
      }}
    >
      <Typography
        sx={{
          fontSize: "0.6rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: LEGACY_COURT.inkFaint,
        }}
      >
        {label}
      </Typography>
      {player ? (
        <>
          <Avatar
            src={avatarSrcFor(player)}
            alt={player.name}
            sx={{
              width: avatar,
              height: avatar,
              fontSize: avatar * 0.4,
              fontWeight: 700,
              bgcolor: "#d1e7c9",
              color: "#2f5d2b",
              boxShadow: "0 0 0 3px #ffffff, 0 4px 10px rgba(46,90,40,0.18)",
            }}
          >
            {player.name?.[0]?.toUpperCase()}
          </Avatar>
          <Box
            onClick={onClick ? () => onClick(player) : undefined}
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.25,
              borderRadius: "10px",
              px: 1,
              py: 0.4,
              maxWidth: "100%",
              ...(onClick && {
                cursor: "pointer",
                "&:hover": { bgcolor: "rgba(62,125,58,0.12)" },
              }),
            }}
          >
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography
                noWrap
                sx={{
                  fontSize: size === "sm" ? "0.85rem" : "0.95rem",
                  fontWeight: 700,
                  color: LEGACY_COURT.ink,
                }}
              >
                {player.name}
              </Typography>
              {onClick && (
                <Typography sx={{ fontSize: "0.7rem", color: "rgba(28,42,26,0.4)" }}>
                  ⇄
                </Typography>
              )}
            </Stack>
            <Stars
              value={player.rating}
              fontSize={size === "sm" ? "0.7rem" : "0.8rem"}
              color={palette.star}
            />
          </Box>
        </>
      ) : (
        <Box
          onClick={onEmptyClick}
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 0.75,
            borderRadius: "12px",
            px: 1.5,
            py: 0.5,
            ...(onEmptyClick && {
              cursor: "pointer",
              "&:hover": { bgcolor: "rgba(62,125,58,0.12)" },
            }),
          }}
        >
          <Box
            sx={{
              width: avatar,
              height: avatar,
              borderRadius: "50%",
              border: "2px dashed #6fa761",
              bgcolor: "rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: avatar * 0.42,
              color: "#4c8a41",
            }}
          >
            +
          </Box>
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: palette.chipText }}>
            Open slot
          </Typography>
          {onEmptyClick && (
            <Typography sx={{ fontSize: "0.66rem", color: "rgba(28,42,26,0.5)", mt: -0.5 }}>
              Tap to add
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

function Kitchen({ palette }: { palette: LegacyPalette }) {
  return (
    <Box
      sx={{
        bgcolor: palette.kitchen,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography
        sx={{
          fontSize: "0.5rem",
          fontWeight: 700,
          letterSpacing: "0.22em",
          color: "rgba(28,42,26,0.3)",
          textTransform: "uppercase",
          writingMode: "vertical-rl",
        }}
      >
          KITCHEN
      </Typography>
    </Box>
  );
}

/**
 * Legacy court card (white card, green frame, palette overrides).
 * Used by TV board, host console (palette mode), admin theme preview.
 */
export function LegacyCourtCard({
  number,
  title,
  label,
  chipLabel = "Open Play",
  startedAt,
  teamA,
  teamB,
  onPlayerClick,
  onEmptySlotClick,
  headerRight,
  footer,
  size = "md",
  palette,
}: {
  number?: number | string;
  title?: string;
  label?: string;
  chipLabel?: string;
  startedAt?: number | null;
  teamA: NamedPlayer[];
  teamB: NamedPlayer[];
  onPlayerClick?: (p: NamedPlayer) => void;
  onEmptySlotClick?: (team: "A" | "B") => void;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md";
  palette?: CourtPalette;
}) {
  const P: LegacyPalette = { ...LEGACY_COURT, ...(palette ?? {}) };
  const kitchenW = size === "sm" ? 20 : 26;
  const netW = size === "sm" ? 14 : 18;
  return (
    <Box
      sx={{
        bgcolor: "#ffffff",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid rgba(17,24,39,0.08)",
        boxShadow: "0 6px 24px rgba(46,90,40,0.10)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, pt: 1.75, pb: 1.25 }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography
            noWrap
            sx={{
              fontSize: size === "sm" ? "1rem" : "1.2rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: LEGACY_COURT.ink,
            }}
          >
            {title ??
              (number != null && number !== ""
                ? `Court ${number}${label ? ` — ${label}` : ""}`
                : "Court")}
          </Typography>
          <Chip
            size="small"
            label={chipLabel}
            sx={{
              bgcolor: P.chipBg,
              color: P.chipText,
              fontWeight: 700,
              fontSize: "0.62rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              height: 22,
            }}
          />
        </Stack>
        {startedAt ? <DotClock startedAt={startedAt} /> : headerRight}
      </Stack>

      <Box sx={{ px: 1.75 }}>
        <Box sx={{ bgcolor: P.frame, borderRadius: "16px", p: "9px" }}>
          <Box
            sx={{
              bgcolor: "#ffffff",
              borderRadius: "9px",
              overflow: "hidden",
              display: "flex",
              gap: "2px",
            }}
          >
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "grid",
                gap: "2px",
                bgcolor: "#ffffff",
                gridTemplateColumns: `1fr ${kitchenW}px`,
                gridTemplateRows: "1fr 1fr",
              }}
            >
              <CourtSlot
                label="Player 1"
                player={teamA[0]}
                onClick={onPlayerClick}
                onEmptyClick={onEmptySlotClick && (() => onEmptySlotClick("A"))}
                size={size}
                palette={P}
              />
              <Box sx={{ gridColumn: 2, gridRow: "1 / -1", display: "grid" }}>
                <Kitchen palette={P} />
              </Box>
              <CourtSlot
                label="Player 2"
                player={teamA[1]}
                onClick={onPlayerClick}
                onEmptyClick={onEmptySlotClick && (() => onEmptySlotClick("A"))}
                size={size}
                palette={P}
              />
            </Box>
            <Box
              sx={{
                width: netW,
                flexShrink: 0,
                background: `repeating-linear-gradient(135deg, ${P.netA} 0 7px, ${P.netB} 7px 14px)`,
                borderLeft: `2px solid ${P.netEdge}`,
                borderRight: `2px solid ${P.netEdge}`,
              }}
            />
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: "grid",
                gap: "2px",
                bgcolor: "#ffffff",
                gridTemplateColumns: `${kitchenW}px 1fr`,
                gridTemplateRows: "1fr 1fr",
              }}
            >
              <Box sx={{ gridColumn: 1, gridRow: "1 / -1", display: "grid" }}>
                <Kitchen palette={P} />
              </Box>
              <Box sx={{ gridColumn: 2, gridRow: 1, display: "grid" }}>
                <CourtSlot
                  label="Player 3"
                  player={teamB[0]}
                  onClick={onPlayerClick}
                  onEmptyClick={onEmptySlotClick && (() => onEmptySlotClick("B"))}
                  size={size}
                  palette={P}
                />
              </Box>
              <Box sx={{ gridColumn: 2, gridRow: 2, display: "grid" }}>
                <CourtSlot
                  label="Player 4"
                  player={teamB[1]}
                  onClick={onPlayerClick}
                  onEmptyClick={onEmptySlotClick && (() => onEmptySlotClick("B"))}
                  size={size}
                  palette={P}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: 1.75, pb: 1.75, pt: footer ? 1.25 : 1.75 }}>{footer}</Box>
    </Box>
  );
}

/** Re-export COURT alias for admin theme swatches that reference legacy keys. */
export { LEGACY_COURT as COURT_LEGACY };
