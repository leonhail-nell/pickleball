"use client";

import type { Participant } from "@/types/session";
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
  const fillPct = Math.min(100, (meta._count.signups / Math.max(1, meta.capacity)) * 100);
  const isFull = spotsLeft === 0;

  return (
    <Card
      sx={{
        mb: 2.5,
        borderRadius: "20px",
        border: "1px solid rgba(20,54,26,0.08)",
        boxShadow: "0 4px 20px rgba(46,90,40,0.06)",
      }}
    >
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          gap={2.5}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="overline"
              sx={{
                color: "rgba(28,42,26,0.45)",
                letterSpacing: "0.12em",
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              OPEN PLAY
            </Typography>
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ lineHeight: 1.15, letterSpacing: "-0.02em", mt: 0.5 }}
            >
              {meta.title}
            </Typography>
            {meta.organizer && (
              <Typography sx={{ color: "rgba(28,42,26,0.55)", mt: 0.5 }}>
                by {meta.organizer}
              </Typography>
            )}
            <Stack direction="row" spacing={1} mt={1.75} flexWrap="wrap" useFlexGap alignItems="center">
              <Chip
                size="small"
                label={level}
                sx={{
                  bgcolor: "#d1913c",
                  color: "#fff",
                  fontWeight: 800,
                  height: 26,
                }}
              />
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "rgba(28,42,26,0.55)" }}>
                <CalendarMonthIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2" fontWeight={600}>
                  {new Date(meta.startsAt).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: "rgba(28,42,26,0.55)" }}>
                <AccessTimeIcon sx={{ fontSize: 16 }} />
                <Typography variant="body2" fontWeight={600}>
                  {new Date(meta.startsAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  –{" "}
                  {new Date(meta.endsAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  · {duration}h
                </Typography>
              </Stack>
              <Chip
                size="small"
                icon={<GroupsIcon sx={{ fontSize: "16px !important", color: "#fff !important" }} />}
                label={isFull ? "Full" : `${spotsLeft} spots left`}
                sx={{
                  bgcolor: isFull ? "#e53935" : "#e2f2dc",
                  color: isFull ? "#fff" : "#2f6b2b",
                  fontWeight: 800,
                  height: 26,
                }}
              />
            </Stack>
            <Box mt={2.25} sx={{ maxWidth: 420 }}>
              <LinearProgress
                variant="determinate"
                value={fillPct}
                sx={{
                  height: 10,
                  borderRadius: 999,
                  bgcolor: "rgba(28,42,26,0.08)",
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 999,
                    bgcolor: isFull ? "#e53935" : "#4c9a44",
                  },
                }}
              />
              <Typography
                variant="caption"
                sx={{ color: "rgba(28,42,26,0.5)", display: "block", mt: 0.75 }}
              >
                {Math.min(meta._count.signups, meta.capacity)}/{meta.capacity} registered
                {meta._count.signups > meta.capacity
                  ? ` · +${meta._count.signups - meta.capacity} walk-ins`
                  : ""}
              </Typography>
            </Box>
          </Box>

          <Stack
            alignItems={{ xs: "stretch", md: "flex-end" }}
            spacing={1.5}
            sx={{ minWidth: { md: 180 } }}
          >
            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ letterSpacing: "-0.02em", textAlign: { md: "right" } }}
            >
              {price}
              <Typography
                component="span"
                sx={{ color: "rgba(28,42,26,0.45)", fontSize: "0.95rem", fontWeight: 600 }}
              >
                {" "}
                / player
              </Typography>
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent={{ xs: "flex-start", md: "flex-end" }}
              flexWrap="wrap"
              useFlexGap
            >
              {meta.status === "CLOSED" ? (
                <Chip
                  label="Thanks for playing! 🏓"
                  sx={{
                    bgcolor: "#eef1ec",
                    color: "rgba(28,42,26,0.65)",
                    fontWeight: 700,
                    height: 36,
                    borderRadius: 999,
                  }}
                />
              ) : mySignup ? (
                <Chip
                  label={signupLabel(mySignup.status)}
                  sx={{
                    bgcolor: "#e2f2dc",
                    color: "#2f6b2b",
                    fontWeight: 800,
                    height: 36,
                    borderRadius: 999,
                  }}
                />
              ) : (
                <Button
                  variant="contained"
                  size="large"
                  onClick={onJoin}
                  sx={{
                    bgcolor: "#2f6b2b",
                    fontWeight: 800,
                    borderRadius: 999,
                    px: 3,
                    "&:hover": { bgcolor: "#24551f" },
                  }}
                >
                  {isFull ? "Join Waitlist" : "Join Now"}
                </Button>
              )}
              <Button
                size="medium"
                variant="outlined"
                startIcon={<ShareIcon />}
                onClick={onShare}
                sx={{
                  borderRadius: 999,
                  fontWeight: 700,
                  borderColor: "rgba(28,42,26,0.18)",
                  color: "#1c2a1a",
                  bgcolor: "#fff",
                  px: 2,
                }}
              >
                Share
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ md: "flex-end" }}>
              {meta.status === "LIVE" && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<TvIcon />}
                  href={`/board/${id}`}
                  sx={{ fontWeight: 700, borderColor: "#cfe3c6", color: "#2f6b2b" }}
                >
                  Live board
                </Button>
              )}
              {meta.status !== "CLOSED" && mySignup && (
                <Button
                  size="small"
                  variant="outlined"
                  href={`/play/${id}`}
                  sx={{ fontWeight: 700, borderColor: "#cfe3c6", color: "#2f6b2b" }}
                >
                  My view
                </Button>
              )}
              {isHost && meta.status !== "CLOSED" && (
                <Button
                  size="small"
                  variant="contained"
                  href={`/host/${id}`}
                  sx={{
                    bgcolor: "#2f6b2b",
                    fontWeight: 800,
                    "&:hover": { bgcolor: "#24551f" },
                  }}
                >
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
