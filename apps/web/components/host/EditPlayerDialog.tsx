"use client";

import type { EditTarget } from "@/types/host";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/** Edit a player's name and skill rating. */
export function EditPlayerDialog({
  value,
  onChange,
  onSave,
  onClose,
}: {
  value: EditTarget | null;
  onChange: (next: EditTarget | null) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit player</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          <TextField
            label="Name"
            fullWidth
            autoFocus
            value={value?.name ?? ""}
            onChange={(e) => onChange(value && { ...value, name: e.target.value })}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Skill
            </Typography>
            <Rating
              precision={0.5}
              max={5}
              value={Number(value?.rating) || 0}
              onChange={(_, v) =>
                onChange(value && { ...value, rating: String(v ?? value.rating) })
              }
            />
            <Typography fontWeight={700}>
              {Number(value?.rating || 0).toFixed(1)}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!value?.name.trim()}
          onClick={onSave}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
