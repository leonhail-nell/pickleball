"use client";

import type { Club } from "@/types/admin";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/** Venue Pro status + club-name editor + trial CTA. */
export function VenueProCard({
  club,
  clubName,
  onClubName,
  onSaveName,
  onStartTrial,
}: {
  club: Club;
  clubName: string;
  onClubName: (v: string) => void;
  onSaveName: () => void;
  onStartTrial: () => void;
}) {
  return (
    <Card
      sx={{
        mt: 2,
        background: club.venuePro
          ? "linear-gradient(135deg, #22c55e 0%, #15803d 100%)"
          : undefined,
        border: club.venuePro ? "none" : undefined,
        color: club.venuePro ? "#fff" : undefined,
      }}
    >
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={2}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
              <Typography
                variant="h6"
                sx={{ color: club.venuePro ? "#fff" : undefined }}
              >
                Venue Pro
              </Typography>
              {club.venuePro ? (
                <Chip
                  size="small"
                  label={`Active until ${new Date(club.venueProUntil!).toLocaleDateString()}`}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.25)",
                    color: "#fff",
                    fontWeight: 700,
                  }}
                />
              ) : (
                <Chip size="small" label="Free plan" variant="outlined" />
              )}
            </Stack>
            <Typography
              variant="body2"
              sx={{
                color: club.venuePro
                  ? "rgba(255,255,255,0.9)"
                  : "text.secondary",
              }}
            >
              {club.venuePro
                ? "Unlimited courts unlocked. Thanks for supporting PicklePlay!"
                : `Free plan runs up to ${club.freeCourtLimit} courts per session. Start a 14-day trial to unlock more.`}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              size="small"
              label="Club name"
              value={clubName}
              onChange={(e) => onClubName(e.target.value)}
              sx={
                club.venuePro
                  ? {
                      "& .MuiOutlinedInput-root": {
                        bgcolor: "rgba(255,255,255,0.9)",
                      },
                    }
                  : undefined
              }
            />
            <Button
              variant={club.venuePro ? "contained" : "outlined"}
              size="small"
              onClick={onSaveName}
              sx={
                club.venuePro
                  ? {
                      bgcolor: "#fff",
                      color: "#15803d",
                      "&:hover": { bgcolor: "#f0fdf4" },
                    }
                  : undefined
              }
            >
              Save
            </Button>
            {!club.venuePro && (
              <Button variant="contained" onClick={onStartTrial}>
                Start 14-day trial
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
