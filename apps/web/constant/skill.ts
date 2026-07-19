/** Skill-rating thresholds and friendly level labels (DUPR-ish). */

export const SKILL_THRESHOLDS = {
  intermediate: 3.0,
  advanced: 3.5,
  expert: 4.0,
} as const;

/** DUPR-ish rating → friendly level label. */
export function skillLabel(rating: number): string {
  if (rating < SKILL_THRESHOLDS.intermediate) return "Beginner";
  if (rating < SKILL_THRESHOLDS.advanced) return "Intermediate";
  if (rating < SKILL_THRESHOLDS.expert) return "Advanced";
  return "Expert";
}
