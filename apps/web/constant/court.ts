/**
 * Court & player design tokens.
 * Single source of truth for the pickleball-court look shared across the
 * board, host console, and play views.
 */

/** Team accent colors (legacy TeamPanel / win buttons). */
export const TEAM_BLUE = "#3b82f6";
export const TEAM_ORANGE = "#f59e0b";

/** Court / player palette: white card, dark-green court, light-green kitchen. */
export const COURT = {
  card: "#fff", // outer white court card
  surface: "#c6efc8", // dark green playing surface
  surfaceAlt: "#aaf6ab", // filled/live surface (slightly deeper)
  kitchen: "#d4edc2", // light green kitchen zone
  line: "rgba(254, 255, 255, 0.87)", // inner court lines
  net: "#035006", // dark net stripe
  netHatch: "#256a29", // darker hatch band
  ring: "#ffffff", // avatar ring
  ringShadow: "rgba(47,125,50,0.28)",
  text: "#14361a", // default ink
  courtText: "#f4fbef", // player text on the dark-green court
  kitchenText: "rgba(47,125,50,0.65)", // KITCHEN label on light-green zone
  pillBg: "#d6eccd",
  pillText: "#2f7d32",
  liveDot: "#FF0000",
  border: "rgba(20,54,26,0.08)",
  courtLine: "#fff", // court zone borders
} as const;

/** Consistent radii across cards, court surface, queue rows. */
export const R = {
  card: "10px", // outer white court card + empty-court shell
  court: "2px", // playing surface
  surface: "2px", // playing surface (alias)
  row: "14px", // queue / list rows
} as const;

/** Diagonally-hatched dark-green net (matches the mockup). */
export const NET_HATCH = `repeating-linear-gradient(-45deg, ${COURT.net} 0 6px, ${COURT.netHatch} 6px 12px)`;
