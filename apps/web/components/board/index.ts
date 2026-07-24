/**
 * Barrel for the board design components. Import from "@/components/board".
 * Split across avatar / clock / court / rows / stats / up-next for readability;
 * design tokens live in "@/constant/court" and skill helpers in
 * "@/constant/skill" (re-exported here for backwards compatibility).
 */

export {
  playerAvatarUrl,
  avatarSrcFor,
  PlayerAvatar,
  PlayerStars,
  Stars,
} from "@/components/board/avatar";
export { DotClock, LiveClock } from "@/components/board/clock";
export {
  CourtSurface,
  CourtStatusPill,
  CourtCard,
} from "@/components/board/court";
export { LegacyCourtCard } from "@/components/board/legacy-court";
export { QueueRow, CheckInRow, TeamPanel } from "@/components/board/rows";
export { StatsBar, CoverageRing, CoverageTile } from "@/components/board/stats";
export { UpNextCard, QueueChip } from "@/components/board/up-next";

export {
  TEAM_BLUE,
  TEAM_GREEN,
  TEAM_ORANGE,
  PAGE_BG,
  COURT,
  LEGACY_COURT,
  R,
  NET_HATCH,
  type CourtPalette,
} from "@/constant/court";
export { skillLabel } from "@/constant/skill";
