"use client";

import { avatarSrcFor, Stars } from "@/components/board";
import type { Pending } from "@/types/host";
import type { BoardPlayer } from "@/lib/api";
import {
  Avatar,
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

/** Pick a waiting player to fill an open court slot (Team 1 or Team 2). */
export function AssignDialog({
  assignFor,
  waiting,
  pending,
  search,
  onSearch,
  onPick,
  onClose,
  matches,
}: {
  assignFor: { courtId: string; team: "A" | "B" } | null;
  waiting: BoardPlayer[];
  pending: Record<string, Pending>;
  search: string;
  onSearch: (q: string) => void;
  onPick: (playerId: string) => void;
  onClose: () => void;
  matches: (name: string, q: string) => boolean;
}) {
  const filtered = waiting.filter((w) => {
    const p = assignFor ? pending[assignFor.courtId] : undefined;
    return (
      (!p || (!p.A.includes(w.id) && !p.B.includes(w.id))) && matches(w.name, search)
    );
  });

  return (
    <Dialog open={!!assignFor} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Fill {assignFor?.team === "A" ? "Team 1" : "Team 2"} slot
      </DialogTitle>
      <DialogContent>
        <TextField
          size="small"
          fullWidth
          autoFocus
          placeholder="Search the queue…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { bgcolor: "#f7faf5", borderRadius: "10px" } }}
        />
        <Typography
          sx={{
            fontSize: "0.68rem",
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#2f5d2b",
            mb: 1,
          }}
        >
          Assign from queue
        </Typography>
        <Stack spacing={0.75}>
          {filtered.map((w) => (
            <Box
              key={w.id}
              component="button"
              onClick={() => onPick(w.id)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                width: "100%",
                bgcolor: "#f2f8ef",
                border: "1px solid #dcead5",
                borderRadius: "12px",
                px: 1.5,
                py: 1.1,
                cursor: "pointer",
                font: "inherit",
                textAlign: "left",
                "&:hover": { bgcolor: "#e4f1dd", borderColor: "#bfdcb2" },
              }}
            >
              <Avatar
                src={avatarSrcFor(w)}
                alt={w.name}
                sx={{ width: 32, height: 32, bgcolor: "#d1e7c9", flexShrink: 0 }}
              />
              <Typography
                noWrap
                sx={{ flex: 1, fontWeight: 700, fontSize: "0.9rem", color: "#1c2a1a" }}
              >
                {w.name}
              </Typography>
              <Stars value={w.rating} fontSize="0.7rem" />
              <Typography variant="caption" sx={{ color: "rgba(28,42,26,0.5)" }}>
                {w.gamesPlayed}g
              </Typography>
            </Box>
          ))}
          {!waiting.length && (
            <Typography
              sx={{ py: 2, textAlign: "center", color: "rgba(28,42,26,0.4)", fontSize: "0.82rem" }}
            >
              No one is waiting — check players in first.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
