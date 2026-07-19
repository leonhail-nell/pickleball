"use client";

import { StatsBar } from "@/components/board";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  Typography,
} from "@mui/material";

/** Host console header: title, stats, and session controls. */
export function HostHeader({
  sessionId,
  courts,
  players,
  queue,
  rotationsPaused,
  qrShown,
  onToggleRotations,
  onToggleQr,
  onEndSession,
}: {
  sessionId: string;
  courts: number;
  players: number;
  queue: number;
  rotationsPaused: boolean;
  qrShown: boolean;
  onToggleRotations: () => void;
  onToggleQr: () => void;
  onEndSession: () => void;
}) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ py: "12px !important" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1}
        >
          <Box>
            <Typography variant="h5" fontWeight={800}>
              Host console
            </Typography>
            <StatsBar courts={courts} players={players} queue={queue} />
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            {rotationsPaused && <Chip color="warning" label="⏸ rotations paused" />}
            <Button
              variant={rotationsPaused ? "contained" : "outlined"}
              color={rotationsPaused ? "success" : "warning"}
              size="small"
              startIcon={rotationsPaused ? <PlayArrowIcon /> : <PauseIcon />}
              onClick={onToggleRotations}
            >
              {rotationsPaused ? "Resume play" : "Pause play"}
            </Button>
            <Button variant="outlined" size="small" startIcon={<QrCode2Icon />} onClick={onToggleQr}>
              {qrShown ? "Hide QR" : "Check-in QR"}
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<StopCircleIcon />}
              onClick={onEndSession}
            >
              End session
            </Button>
            <Link
              href={`/board/${sessionId}`}
              target="_blank"
              sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
            >
              TV board <OpenInNewIcon fontSize="small" />
            </Link>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
