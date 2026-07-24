"use client";

import { Leaderboard } from "@/components/leaderboard";
import type { Participant } from "@/types/session";
import type { SessionMeta, Standing } from "@/lib/api";
import { Card, CardContent, Chip, Stack, Typography } from "@mui/material";

/** Details tab: description + court chips. */
export function DetailsTab({ meta }: { meta: SessionMeta }) {
  return (
    <Card sx={{ borderRadius: "16px" }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography variant="h6" fontWeight={800} gutterBottom sx={{ letterSpacing: "-0.02em" }}>
          Event Details
        </Typography>
        <Typography sx={{ whiteSpace: "pre-wrap", color: "rgba(28,42,26,0.65)" }}>
          {meta.description ||
            "Fair rotation open play: unbiased shuffle, fresh partners every game, equal court time — powered by PicklePlay."}
        </Typography>
        <Typography variant="subtitle2" mt={3} mb={1} fontWeight={800}>
          Courts
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {meta.courts.map((c) => (
            <Chip
              key={c.court.id}
              label={`#${c.court.number}`}
              sx={{
                bgcolor: "#e2f2dc",
                color: "#2f6b2b",
                fontWeight: 700,
              }}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Participants tab: signed-up players as aligned status rows. */
export function ParticipantsTab({
  participants,
  loggedIn,
}: {
  participants: Participant[];
  loggedIn: boolean;
}) {
  return (
    <Card sx={{ borderRadius: "16px" }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1.25} alignItems="baseline" mb={1.5}>
          <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
            Participants
          </Typography>
          {loggedIn && (
            <Typography variant="body2" sx={{ color: "rgba(28,42,26,0.45)" }}>
              {participants.length} signed up
            </Typography>
          )}
        </Stack>
        {!loggedIn && (
          <Typography color="text.secondary" variant="body2">
            Log in to see the participant list.
          </Typography>
        )}
        <Stack spacing={1}>
          {participants.map((p) => {
            const waitlisted = p.status === "WAITLISTED";
            return (
              <Stack
                key={p.id}
                direction="row"
                alignItems="center"
                spacing={1.25}
                sx={{
                  pl: 1.5,
                  pr: 1.5,
                  py: 1.1,
                  borderRadius: "14px",
                  bgcolor: waitlisted ? "#fdf8ef" : "#e6f2dc",
                  border: waitlisted
                    ? "1px solid rgba(176,127,36,0.28)"
                    : "1px solid rgba(47,125,50,0.1)",
                }}
              >
                <Typography
                  fontWeight={800}
                  noWrap
                  sx={{ flex: 1, minWidth: 0, color: "#1c2a1a" }}
                >
                  {p.user.name}
                </Typography>
                <Chip
                  size="small"
                  label={waitlisted ? "Waitlist" : "Joined"}
                  sx={
                    waitlisted
                      ? {
                          bgcolor: "#fdf1d7",
                          color: "#b07f24",
                          fontWeight: 800,
                          height: 22,
                        }
                      : {
                          bgcolor: "#4c9a44",
                          color: "#fff",
                          fontWeight: 800,
                          height: 22,
                        }
                  }
                />
              </Stack>
            );
          })}
          {loggedIn && !participants.length && (
            <Typography color="text.secondary" variant="body2">
              No sign-ups yet.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Leaderboard tab. */
export function LeaderboardTab({
  sessionId,
  standings,
}: {
  sessionId: string;
  standings: Standing[];
}) {
  return (
    <Card sx={{ borderRadius: "16px", overflow: "hidden" }}>
      <Leaderboard sessionId={sessionId} standings={standings} title />
    </Card>
  );
}
