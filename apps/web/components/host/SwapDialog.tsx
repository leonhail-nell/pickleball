"use client";

import { QueueRow } from "@/components/board";
import type { SwapTarget } from "@/components/host/types";
import type { BoardPlayer } from "@/lib/api";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/** Swap a live-game player for a replacement from the waiting queue. */
export function SwapDialog({
  target,
  waiting,
  search,
  onSearch,
  onPick,
  onClose,
}: {
  target: SwapTarget | null;
  waiting: BoardPlayer[];
  search: string;
  onSearch: (q: string) => void;
  onPick: (inId: string) => void;
  onClose: () => void;
}) {
  const q = search.trim().toLowerCase();
  const matches = waiting.filter((w) => w.name.toLowerCase().includes(q));

  return (
    <Dialog open={!!target} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Swap out {target?.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={1.5}>
          Pick a replacement from the queue (logged as manual):
        </Typography>
        <TextField
          size="small"
          fullWidth
          autoFocus
          placeholder="Search the queue…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          sx={{ mb: 1.5 }}
        />
        {!waiting.length ? (
          <Typography color="text.secondary" variant="body2">
            No one is waiting — pause or void instead.
          </Typography>
        ) : !matches.length ? (
          <Typography color="text.secondary" variant="body2">
            No players match “{search}”.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ maxHeight: 420, overflowY: "auto", pr: 0.5 }}>
            {matches.map((w) => (
              <Box
                key={w.id}
                onClick={() => onPick(w.id)}
                sx={{
                  cursor: "pointer",
                  borderRadius: "14px",
                  "&:hover": { filter: "brightness(0.97)" },
                }}
              >
                <QueueRow
                  rank={waiting.findIndex((x) => x.id === w.id) + 1}
                  player={w}
                />
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
