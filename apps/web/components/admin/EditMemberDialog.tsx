"use client";

import type { EditMemberTarget } from "@/types/admin";
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

/** Edit a member's name and skill rating. */
export function EditMemberDialog({
  value,
  onChange,
  onSave,
  onClose,
}: {
  value: EditMemberTarget | null;
  onChange: (next: EditMemberTarget | null) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!value} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit member</DialogTitle>
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
              value={value?.rating ?? 0}
              onChange={(_, v) => onChange(value && { ...value, rating: v ?? value.rating })}
            />
            <Typography fontWeight={700}>
              {(value?.rating ?? 0).toFixed(1)}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!value?.name.trim()} onClick={onSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
