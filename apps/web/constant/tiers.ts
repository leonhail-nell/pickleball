/** Skill-tier gates for sessions (min/max DUPR-ish rating + display label). */

export interface Tier {
  min: number | null;
  max: number | null;
  label: string;
}

export const TIERS: Record<string, Tier> = {
  open: { min: null, max: null, label: "Open (all levels)" },
  beginner: { min: 2.0, max: 3.0, label: "2.0–3.0" },
  intermediate: { min: 3.0, max: 3.5, label: "3.0–3.5" },
  advanced: { min: 3.5, max: 4.0, label: "3.5–4.0" },
  expert: { min: 4.0, max: 5.5, label: "4.0+" },
};
