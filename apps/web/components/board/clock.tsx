"use client";

import { COURT } from "@/constant/court";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";

/** Format elapsed seconds as mm:ss (or h:mm:ss past an hour). */
function elapsedLabel(startedAt: number): string {
  const total = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = `${total % 60}`.padStart(2, "0");
  return hh > 0 ? `${hh}:${`${mm}`.padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
}

/** Re-render every second while mounted. */
function useTick() {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

/** Green live dot + elapsed clock (mockup court-header style). */
export function DotClock({ startedAt }: { startedAt: number | null }) {
  useTick();
  if (startedAt == null) return null;
  return (
    <Stack
      direction="row"
      spacing={0.75}
      alignItems="center"
      flexShrink={0}
    >
      <Box
        sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: COURT.liveDot }}
      />
      <Typography
        fontWeight={800}
        sx={{
          color: COURT.text,
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.95rem",
        }}
      >
        {elapsedLabel(startedAt)}
      </Typography>
    </Stack>
  );
}

/** LIVE badge + elapsed clock (legacy dark-header variant). */
export function LiveClock({ startedAt }: { startedAt: number | null }) {
  useTick();
  if (!startedAt) return null;
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
      <Chip
        size="small"
        label="● LIVE"
        sx={{ bgcolor: "#ef4444", color: "#fff", fontWeight: 800, height: 20 }}
      />
      <Typography variant="caption" fontWeight={700}>
        {elapsedLabel(startedAt)}
      </Typography>
    </Stack>
  );
}
