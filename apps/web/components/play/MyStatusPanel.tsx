"use client";

import type { BoardCourt, BoardPlayer, PendingGame } from "@/lib/api";
import NotificationsIcon from "@mui/icons-material/Notifications";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/** The player's own status card, quick actions, and score confirmations. */
export function MyStatusPanel({
  me,
  my,
  myCourt,
  queuePos,
  queueLength,
  score,
  onScore,
  onReport,
  onPauseResume,
  notifOk,
  onEnableNotifications,
  myPending,
  onConfirmOrDispute,
}: {
  me: { id: string; name: string };
  my: BoardPlayer;
  myCourt?: BoardCourt;
  queuePos: number;
  queueLength: number;
  score: { a: string; b: string };
  onScore: (next: { a: string; b: string }) => void;
  onReport: () => void;
  onPauseResume: (action: "pause" | "resume") => void;
  notifOk: boolean;
  onEnableNotifications: () => void;
  myPending: PendingGame[];
  onConfirmOrDispute: (gameId: string, action: "confirm" | "dispute") => void;
}) {
  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      <Card>
        <CardContent>
          {my.status === "playing" && myCourt ? (
            <>
              <Typography variant="h6">
                You&apos;re playing on <strong>Court {myCourt.number}</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Game over? Report the score (Team 1 ={" "}
                {myCourt.teamA.map((x) => x.name).join(" + ")})
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  sx={{ width: 72 }}
                  label="Team 1"
                  inputMode="numeric"
                  value={score.a}
                  onChange={(e) => onScore({ ...score, a: e.target.value })}
                />
                <TextField
                  size="small"
                  sx={{ width: 72 }}
                  label="Team 2"
                  inputMode="numeric"
                  value={score.b}
                  onChange={(e) => onScore({ ...score, b: e.target.value })}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={!score.a || !score.b}
                  onClick={onReport}
                >
                  Report
                </Button>
              </Stack>
            </>
          ) : my.status === "paused" ? (
            <Typography variant="h6">You&apos;re paused ⏸</Typography>
          ) : queuePos >= 0 ? (
            <>
              <Typography variant="h6">
                You&apos;re <strong>#{queuePos + 1}</strong> in the queue
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.max(5, 100 - (queuePos / Math.max(1, queueLength)) * 100)}
                sx={{ mt: 1 }}
              />
            </>
          ) : (
            <Typography variant="h6">Waiting for the next draw…</Typography>
          )}
          <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
            <Chip label={`${my.gamesPlayed} games`} />
            <Chip label={`paired ${my.coverage.played}/${my.coverage.total}`} variant="outlined" />
            {my.deficit > 0 && <Chip label={`catching up +${my.deficit}`} color="warning" />}
          </Stack>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1}>
        {my.status === "paused" ? (
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={() => onPauseResume("resume")}
          >
            I&apos;m back
          </Button>
        ) : my.status === "active" ? (
          <Button
            variant="outlined"
            startIcon={<PauseIcon />}
            onClick={() => onPauseResume("pause")}
          >
            Step out (pause)
          </Button>
        ) : null}
        {!notifOk && typeof Notification !== "undefined" && (
          <Button
            variant="outlined"
            startIcon={<NotificationsIcon />}
            onClick={onEnableNotifications}
          >
            Alert me when I&apos;m up
          </Button>
        )}
      </Stack>

      {myPending.length > 0 && (
        <Card sx={{ borderColor: "rgba(251,191,36,0.6)" }}>
          <CardContent>
            <Typography variant="subtitle2" gutterBottom>
              Confirm score
            </Typography>
            {myPending.map((p) => {
              const iReported = p.reportedById === me.id;
              return (
                <Stack key={p.gameId} spacing={1} mb={1}>
                  <Typography variant="body2">
                    {p.teamA.map((x) => x.name).join(" + ")} <strong>{p.a}</strong> —{" "}
                    <strong>{p.b}</strong> {p.teamB.map((x) => x.name).join(" + ")}
                    {p.disputed && " · ⚠️ disputed (host will resolve)"}
                  </Typography>
                  {!iReported && !p.disputed && (
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => onConfirmOrDispute(p.gameId, "confirm")}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => onConfirmOrDispute(p.gameId, "dispute")}
                      >
                        Dispute
                      </Button>
                    </Stack>
                  )}
                  {iReported && !p.disputed && (
                    <Typography variant="caption" color="text.secondary">
                      Waiting for the other team (auto-confirms in 10 min)
                    </Typography>
                  )}
                </Stack>
              );
            })}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
