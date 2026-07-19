"use client";

import { Leaderboard } from "@/components/leaderboard";
import type { Participant } from "@/components/session/types";
import type { SessionMeta, Standing } from "@/lib/api";
import { Card, CardContent, Chip, Stack, Typography } from "@mui/material";

/** Details tab: description + court chips. */
export function DetailsTab({ meta }: { meta: SessionMeta }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Event Details
        </Typography>
        <Typography sx={{ whiteSpace: "pre-wrap" }} color="text.secondary">
          {meta.description ||
            "Fair rotation open play: unbiased shuffle, fresh partners every game, equal court time — powered by PicklePlay."}
        </Typography>
        <Typography variant="subtitle2" mt={3} mb={1}>
          Courts
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {meta.courts.map((c) => (
            <Chip key={c.court.id} label={`#${c.court.number}`} variant="outlined" />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Participants tab: signed-up players (login-gated). */
export function ParticipantsTab({
  participants,
  loggedIn,
}: {
  participants: Participant[];
  loggedIn: boolean;
}) {
  return (
    <Card>
      <CardContent>
        {!loggedIn && (
          <Typography color="text.secondary" variant="body2" mb={1}>
            Log in to see the participant list.
          </Typography>
        )}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {participants.map((p) => (
            <Chip
              key={p.id}
              label={`${p.user.name}${p.status === "CHECKED_IN" ? " ✓" : p.status === "WAITLISTED" ? " (waitlist)" : ""}`}
              variant={p.status === "CHECKED_IN" ? "filled" : "outlined"}
              color={p.status === "CHECKED_IN" ? "success" : "default"}
            />
          ))}
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
    <Card>
      <CardContent>
        <Typography variant="h6">🏆 Leaderboard</Typography>
        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
          Tap a player to view match history · ranked by wins, win %, then point differential
        </Typography>
        <Leaderboard sessionId={sessionId} standings={standings} />
      </CardContent>
    </Card>
  );
}
