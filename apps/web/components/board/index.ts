/**
 * Barrel for the board design components. Import from "@/components/board".
 * Split across avatar / clock / court / rows / stats for readability;
 * design tokens live in "@/constant/court" and skill helpers in
 * "@/constant/skill" (re-exported here for backwards compatibility).
 */

export { playerAvatarUrl, PlayerAvatar, PlayerStars } from "@/components/board/avatar";
export { DotClock, LiveClock } from "@/components/board/clock";
export {
  CourtSurface,
  CourtStatusPill,
  CourtCard,
} from "@/components/board/court";
export { QueueRow, CheckInRow, TeamPanel } from "@/components/board/rows";
export { StatsBar, CoverageRing } from "@/components/board/stats";

export { TEAM_BLUE, TEAM_ORANGE, COURT, R, NET_HATCH } from "@/constant/court";
export { skillLabel } from "@/constant/skill";
