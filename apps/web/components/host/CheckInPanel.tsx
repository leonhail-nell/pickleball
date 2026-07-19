"use client";

import { CheckInRow } from "@/components/board";
import type { EditTarget, Member } from "@/components/host/types";
import EditIcon from "@mui/icons-material/Edit";
import {
  Button,
  Card,
  CardContent,
  IconButton,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/** Walk-in guest add + member search + check-in list. */
export function CheckInPanel({
  members,
  search,
  guestName,
  guestRating,
  onSearch,
  onGuestName,
  onGuestRating,
  onAddGuest,
  onCheckIn,
  onEdit,
}: {
  members: Member[];
  search: string;
  guestName: string;
  guestRating: number;
  onSearch: (v: string) => void;
  onGuestName: (v: string) => void;
  onGuestRating: (v: number) => void;
  onAddGuest: () => void;
  onCheckIn: (userId: string) => void;
  onEdit: (target: EditTarget) => void;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Check in a player
        </Typography>
        <Stack spacing={1} mb={1.5}>
          <TextField
            size="small"
            label="Walk-in guest name"
            fullWidth
            value={guestName}
            onChange={(e) => onGuestName(e.target.value)}
          />
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Skill
              </Typography>
              <Rating
                precision={0.5}
                max={5}
                value={guestRating}
                onChange={(_, v) => onGuestRating(v ?? 3)}
              />
            </Stack>
            <Button
              variant="contained"
              size="small"
              disabled={!guestName.trim()}
              onClick={onAddGuest}
            >
              Add & check in
            </Button>
          </Stack>
        </Stack>
        <TextField
          size="small"
          fullWidth
          placeholder="Search members…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          sx={{ mb: 1 }}
        />
        <Stack spacing={1}>
          {members.slice(0, 8).map((m) => (
            <CheckInRow
              key={m.id}
              player={m}
              actions={
                <>
                  <IconButton
                    size="small"
                    title="Edit name/rating"
                    onClick={() => onEdit({ id: m.id, name: m.name, rating: m.rating.toFixed(2) })}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <Button size="small" variant="outlined" onClick={() => onCheckIn(m.id)}>
                    Check in
                  </Button>
                </>
              }
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
