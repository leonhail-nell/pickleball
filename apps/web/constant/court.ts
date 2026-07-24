/**
 * Court & player design tokens.
 * Single source of truth for the pickleball-court look shared across the
 * board, host console, and play views. Matches the mint green system in
 * DESIGN-CONVENTIONS.md and the product mockups.
 */

/** Team accent colors (TeamPanel / win buttons). */
export const TEAM_BLUE = "#3b82f6";
export const TEAM_GREEN = "#2f6b2b";
export const TEAM_ORANGE = "#f59e0b";

/** Page / surface mint used across host, board, session. */
export const PAGE_BG = "#f0f7f2";

/** Court / player palette: white card, pale slots, dark kitchen + hatch. */
export const COURT = {
  card: "#fff",
  surface: "#dcefd4", // pale mint playing / slot surface
  surfaceAlt: "#d4e9cb", // slightly deeper when live
  kitchen: "#cde6c2", // light kitchen strips flanking the net
  line: "rgba(254, 255, 255, 0.87)",
  net: "#2f5d2b",
  netHatch: "#40763a",
  ring: "#ffffff",
  ringShadow: "rgba(47,125,50,0.28)",
  text: "#1c2a1a",
  courtText: "#1c2a1a", // ink on pale slots
  kitchenText: "rgba(28,42,26,0.3)",
  pillBg: "#e2f2dc",
  pillText: "#2f6b2b",
  liveDot: "#4c9a44",
  border: "rgba(20,54,26,0.08)",
  courtLine: "#fff",
  star: "#e8a531",
} as const;

/** Consistent radii across cards, court surface, queue rows. */
export const R = {
  card: "16px",
  court: "16px",
  surface: "9px",
  row: "14px",
} as const;

/** Diagonally-hatched dark-green net (matches the mockup). */
export const NET_HATCH = `repeating-linear-gradient(-45deg, ${COURT.net} 0 6px, ${COURT.netHatch} 6px 12px)`;

/**
 * Venue Pro themeable court palette (TV board / host / admin preview).
 * Keys match the admin theme editor and API `club.theme` payload.
 */
export const LEGACY_COURT = {
  frame: "#a3cd94",
  slot: "#dcefd4",
  kitchen: "#cde6c2",
  netA: "#2f5d2b",
  netB: "#40763a",
  netEdge: "#24481f",
  pillBg: "#f2f8ef",
  pillBorder: "#dcead5",
  pillText: "#2f5d2b",
  dot: "#4c9a44",
  chipBg: "#e2f2dc",
  chipText: "#2f6b2b",
  star: "#e8a531",
  ink: "#1c2a1a",
  inkFaint: "rgba(28,42,26,0.45)",
} as const;

export type CourtPalette = Partial<
  Record<
    | "frame"
    | "slot"
    | "kitchen"
    | "netA"
    | "netB"
    | "netEdge"
    | "star"
    | "chipBg"
    | "chipText",
    string
  >
>;
