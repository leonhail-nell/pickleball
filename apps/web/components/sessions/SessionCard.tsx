"use client";

import type { SessionRow } from "@/components/sessions/types";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SportsTennisIcon from "@mui/icons-material/SportsTennis";
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

const statusColor = (s: string) =>
  s === "LIVE" ? "success" : s === "CLOSED" ? "default" : "secondary";

function signupLabel(status: string) {
  if (status === "CHECKED_IN") return "Checked in ✓";
  if (status === "WAITLISTED") return "Waitlisted";
  return "Joined ✓";
}

/** One session in the list: details, capacity, courts, and contextual actions. */
export function SessionCard({
  session: s,
  isHost,
  mySignupStatus,
  onSignUp,
  onDelete,
}: {
  session: SessionRow;
  isHost: boolean;
  mySignupStatus?: string;
  onSignUp: (id: string) => void;
  onDelete: (id: string, title: string) => void;
}) {
  const duration = Math.round(
    (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 3600_000,
  );

  return (
    <Card>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={2}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography variant="h6" fontWeight={800} noWrap>
                {s.title || "Open Play"}
              </Typography>
              <Chip size="small" label={s.status} color={statusColor(s.status)} />
              <Chip
                size="small"
                color="warning"
                label={s.tierMin != null ? `${s.tierMin}–${s.tierMax ?? "∞"}` : "All Levels"}
              />
            </Stack>
            <Typography color="text.secondary" variant="body2" mt={0.5}>
              {new Date(s.startsAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
              {" · "}
              {new Date(s.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              {" – "}
              {new Date(s.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              {` · ${duration}h`}
              {s.organizer ? ` · hosted by ${s.organizer}` : ""}
            </Typography>
            <Box mt={1} sx={{ maxWidth: 320 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (s._count.signups / s.capacity) * 100)}
                color={s._count.signups >= s.capacity ? "error" : "success"}
                sx={{ height: 6, borderRadius: 3 }}
              />
              <Typography variant="caption" color="text.secondary" noWrap display="block">
                {Math.min(s._count.signups, s.capacity)}/{s.capacity} registered
                {s._count.signups > s.capacity
                  ? ` · +${s._count.signups - s.capacity} walk-ins`
                  : ""}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap" useFlexGap>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ letterSpacing: 1, mr: 0.5 }}
              >
                COURTS
              </Typography>
              {s.courts.map((c) => (
                <Chip
                  key={c.court.id}
                  size="small"
                  variant="outlined"
                  label={`#${c.court.number}`}
                  sx={{ height: 20 }}
                />
              ))}
            </Stack>
          </Box>

          <Stack alignItems="flex-end" spacing={1} justifyContent="space-between">
            <Typography variant="h6" fontWeight={800}>
              {s.priceCents > 0 ? `₱${(s.priceCents / 100).toFixed(0)}` : "Free"}
              <Typography component="span" variant="caption" color="text.secondary">
                {" "}
                /player
              </Typography>
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
              justifyContent="flex-end"
            >
              <Button variant="outlined" size="small" href={`/session/${s.id}`}>
                Details
              </Button>
              {s.status !== "CLOSED" &&
                (mySignupStatus ? (
                  <Button variant="contained" size="small" disabled>
                    {signupLabel(mySignupStatus)}
                  </Button>
                ) : (
                  <Button variant="contained" size="small" onClick={() => onSignUp(s.id)}>
                    Join Now
                  </Button>
                ))}
              {s.status === "LIVE" && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<TvIcon />}
                  href={`/board/${s.id}`}
                >
                  Board
                </Button>
              )}
              {s.status !== "CLOSED" && mySignupStatus && (
                <Button variant="outlined" size="small" href={`/play/${s.id}`}>
                  My view
                </Button>
              )}
              {isHost && s.status !== "CLOSED" && (
                <Button
                  variant="contained"
                  size="small"
                  color="secondary"
                  startIcon={<SportsTennisIcon />}
                  href={`/host/${s.id}`}
                >
                  {s.status === "LIVE" ? "Host" : "Start"}
                </Button>
              )}
              {isHost && s.status !== "LIVE" && (
                <Button
                  variant="outlined"
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => onDelete(s.id, s.title || "Open Play")}
                >
                  Delete
                </Button>
              )}
            </Stack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
