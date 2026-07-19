/** Shared formatting helpers. */

/** Format cents as pesos, e.g. 150000 → "₱1,500". */
export const peso = (c: number) => `₱${(c / 100).toLocaleString()}`;
