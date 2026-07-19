"use client";

import type { Participant } from "@/components/session/types";
import type { SessionMeta } from "@/lib/api";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import GroupsIcon from "@mui/icons-material/Groups";
import ShareIcon from "@mui/icons-material/Share";
import TvIcon from "@mui/icons-material/Tv";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";

function signupLabel(status: string) {
  if (status === "CHECKED_IN") return "Checked in ✓";
  if (status === "WAITLISTED") return "Waitlisted";
  return "Joined ✓";
}

/** Event hero: title, meta chips, capacity bar, price, and primary actions. */
export function SessionHero({
  meta,
  id,
  isHost,
  mySignup,
  onJoin,
  onShare,
}: {
  meta: SessionMeta;
  id: string;
  isHost: boolean;
  mySignup?: Participant;
  onJoin: () => void;
  onShare: () => void;
}) {
  const spotsLeft = Math.max(0, meta.capacity - meta._count.signups);
  const price = meta.priceCents > 0 ? `₱${(meta.priceCents / 100).toFixed(0)}` : "Free";
  const level = meta.tierMin != null ? `${meta.tierMin}–${meta.tierMax ?? "∞"}` : "All Levels";
  const duration = Math.round(
    (new Date(meta.endsAt).getTime() - new Date(meta.startsAt).getTime()) / 3600_000,
  );

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">
              Open Play
            </Typography>
            <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.15 }}>
              {meta.title}
            </Typography>
            {meta.organizer && (
              <Typography color="text.secondary" mt={0.5}>
                by {meta.organizer}
              </Typography>
            )}
            <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={level} color="warning" />
              <Chip
                size="small"
                icon={<CalendarMonthIcon />}
                label={new Date(meta.startsAt).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              />
              <Chip
                size="small"
                icon={<AccessTimeIcon />}
                label={`${new Date(meta.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${new Date(meta.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${duration}h`}
              />
              <Chip
                size="small"
                icon={<GroupsIcon />}
                label={spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
                color={spotsLeft > 0 ? "default" : "error"}
              />
            </Stack>
            <Box mt={2} sx={{ maxWidth: 380 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (meta._count.signups / meta.capacity) * 100)}
                color={spotsLeft === 0 ? "error" : "success"}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {Math.min(meta._count.signups, meta.capacity)}/{meta.capacity} registered
                {meta._count.signups > meta.capacity
                  ? ` · +${meta._count.signups - meta.capacity} walk-ins`
                  : ""}
              </Typography>
            </Box>
          </Box>
          <Stack alignItems="flex-end" spacing={1.5}>
            <Typography variant="h4" fontWeight={800}>
              {price}
              <Typography component="span" color="text.secondary" variant="body2">
                {" "}
                / player
              </Typography>
            </Typography>
            {meta.status === "CLOSED" ? (
              <Chip label="Thanks for playing! 🏓" />
            ) : mySignup ? (
              <Button variant="contained" size="large" disabled>
                {signupLabel(mySignup.status)}
              </Button>
            ) : (
              <Button
                variant="contained"
                size="large"
                onClick={onJoin}
                disabled={spotsLeft === 0}
              >
                {spotsLeft === 0 ? "Join Waitlist" : "Join Now"}
              </Button>
            )}
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ShareIcon />}
                onClick={onShare}
              >
                Share
              </Button>
              {meta.status === "LIVE" && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<TvIcon />}
                  href={`/board/${id}`}
                >
                  Live board
                </Button>
              )}
              {meta.status !== "CLOSED" && mySignup && (
                <Button size="small" variant="outlined" href={`/play/${id}`}>
                  My view
                </Button>
              )}
              {isHost && meta.status !== "CLOSED" && (
                <Button size="small" variant="contained" href={`/host/${id}`}>
                  {meta.status === "LIVE" ? "Host console" : "Start session"}
                </Button>
              )}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
