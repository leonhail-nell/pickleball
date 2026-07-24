"use client";

import { COURT, LEGACY_COURT } from "@/constant/court";
import { Avatar, Box, Rating, Typography } from "@mui/material";

/* ── Cartoon avatar (DiceBear, seeded by name — deterministic & free) ── */
export function playerAvatarUrl(
  seed: string,
  avatarUrl?: string | null,
): string {
  if (avatarUrl) return avatarUrl;
  const s = encodeURIComponent(seed || "player");
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${s}&backgroundColor=c0dfb0,d1e7c4,e2f0d9&radius=50`;
}

/** Back-compat alias: accepts a player object instead of a seed string. */
export function avatarSrcFor(p: {
  id?: string;
  name?: string;
  avatarUrl?: string | null;
}): string {
  return playerAvatarUrl(p.id ?? p.name ?? "player", p.avatarUrl);
}

/** Amber text stars, ★★★★☆ style (rounded to whole stars). */
export function Stars({
  value,
  fontSize = "0.8rem",
  color,
}: {
  value: number;
  fontSize?: string;
  color?: string;
}) {
  const k = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <Typography
      component="span"
      sx={{
        color: color ?? LEGACY_COURT.star,
        fontSize,
        letterSpacing: "2px",
        lineHeight: 1,
      }}
    >
      {"★".repeat(k)}
      {"☆".repeat(5 - k)}
    </Typography>
  );
}

export function PlayerAvatar({
  name,
  avatarUrl,
  size = 64,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        bgcolor: "#fff",
        border: `3px solid ${COURT.ring}`,
        boxShadow: `0 0 0 2px ${COURT.ringShadow}`,
        backgroundImage: `url("${playerAvatarUrl(name, avatarUrl)}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      role="img"
      aria-label={name}
    />
  );
}

/** Star rating row used everywhere a player's skill is shown. */
export function PlayerStars({
  rating,
  size = "medium",
}: {
  rating: number;
  size?: "small" | "medium";
}) {
  return (
    <Rating
      readOnly
      max={5}
      precision={0.5}
      value={rating}
      size={size === "small" ? "small" : "medium"}
      sx={{
        "& .MuiRating-iconFilled": { color: "#f5a623" },
        "& .MuiRating-iconEmpty": { color: "rgba(20,54,26,0.22)" },
      }}
    />
  );
}
