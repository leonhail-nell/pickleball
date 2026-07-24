"use client";

import { CheckInRow, TEAM_GREEN } from "@/components/board";
import { LabeledField } from "@/components/labeled-field";
import type { EditTarget, Member } from "@/types/host";
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
    <Card sx={{ borderRadius: "16px" }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Typography
          variant="h6"
          fontWeight={800}
          gutterBottom
          sx={{ letterSpacing: "-0.02em" }}
        >
          Check in a player
        </Typography>
        <Stack spacing={1.5} mb={2}>
          <LabeledField
            label="Walk-in guest name"
            size="small"
            fullWidth
            placeholder="Walk-in guest name"
            value={guestName}
            onChange={(e) => onGuestName(e.target.value)}
          />
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="flex-end"
            flexWrap="wrap"
            useFlexGap
          >
            <Stack spacing={0.75} sx={{ flex: 1, minWidth: 140 }}>
              <Typography variant="body2" fontWeight={700}>
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
              sx={{
                mb: "1px",
                bgcolor: TEAM_GREEN,
                fontWeight: 800,
                "&:hover": { bgcolor: "#24551f" },
              }}
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
          sx={{ mb: 1.5 }}
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
                    onClick={() =>
                      onEdit({
                        id: m.id,
                        name: m.name,
                        rating: m.rating.toFixed(2),
                      })
                    }
                    sx={{ color: "rgba(28,42,26,0.55)" }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onCheckIn(m.id)}
                    sx={{
                      fontWeight: 700,
                      borderColor: "#cfe3c6",
                      color: TEAM_GREEN,
                    }}
                  >
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
