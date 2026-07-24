"use client";

import type { ScoreTarget } from "@/types/host";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/** Enter the final score after a team is declared the winner. */
export function ScoreDialog({
  target,
  winScore,
  loseScore,
  onWinScore,
  onLoseScore,
  onSubmit,
  onClose,
}: {
  target: ScoreTarget | null;
  winScore: string;
  loseScore: string;
  onWinScore: (v: string) => void;
  onLoseScore: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const max = Math.min(Math.max(Number(winScore) || 11, 1), 22);

  return (
    <Dialog open={!!target} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {target?.winner === "A" ? "Team 1" : "Team 2"} wins — final score?
      </DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={1} alignItems="center" mt={1} mb={2}>
          <TextField
            size="small"
            label="Winner"
            sx={{ width: 90 }}
            inputMode="numeric"
            value={winScore}
            onChange={(e) => onWinScore(e.target.value)}
          />
          <Typography variant="h6">—</Typography>
          <TextField
            size="small"
            label="Loser"
            sx={{ width: 90 }}
            inputMode="numeric"
            autoFocus
            value={loseScore}
            onChange={(e) => onLoseScore(e.target.value)}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Loser&apos;s points:
        </Typography>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap mt={0.5}>
          {Array.from({ length: max }, (_, i) => (
            <Chip
              key={i}
              label={i}
              clickable
              color={loseScore === String(i) ? "primary" : "default"}
              onClick={() => onLoseScore(String(i))}
            />
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={loseScore === "" || Number(loseScore) >= Number(winScore || 11)}
          onClick={onSubmit}
        >
          Save {winScore || 11}–{loseScore || "?"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
