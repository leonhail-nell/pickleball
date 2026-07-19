"use client";

import { TeamPanel, TEAM_BLUE, TEAM_ORANGE } from "@/components/board";
import { Box, Button, Card, Chip, Container, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";

const DEMO_COURTS = [
  {
    court: 1,
    t: "5:08",
    a: [
      { id: "m1", name: "Greg", rating: 3.9 },
      { id: "m2", name: "Ivan", rating: 2.8 },
    ],
    b: [
      { id: "m3", name: "Jeff", rating: 3.3 },
      { id: "m4", name: "Geoff", rating: 2.6 },
    ],
  },
  {
    court: 2,
    t: "6:22",
    a: [
      { id: "m5", name: "Ena", rating: 4.1 },
      { id: "m6", name: "Chelle", rating: 2.9 },
    ],
    b: [
      { id: "m7", name: "Steve", rating: 3.4 },
      { id: "m8", name: "Kurt", rating: 3.2 },
    ],
  },
];

const DEMO_QUEUE: [string, number][] = [
  ["Ava", 3],
  ["Dinah", 2],
  ["Joseph", 3],
  ["Andreo", 2],
];

/** Static "What organizers see" host-console preview. */
export function AppPreview() {
  return (
    <Container maxWidth="lg" sx={{ pb: 10 }}>
      <Typography variant="h3" align="center" sx={{ fontSize: { xs: "1.8rem", md: "2.3rem" } }}>
        What organizers see
      </Typography>
      <Typography align="center" color="text.secondary" mb={4} mt={1}>
        One screen to run the session — one public board for players who want live updates.
      </Typography>
      <Card sx={{ maxWidth: 860, mx: "auto", overflow: "hidden" }}>
        <Box sx={{ bgcolor: "#111827", color: "#f9fafb", px: 2.5, py: 1.25 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography fontWeight={800}>Friday Night Open Play</Typography>
            <Stack direction="row" spacing={2}>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                GAMES <b>12</b>
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                COURTS <b>2/2</b>
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                QUEUE <b>4</b>
              </Typography>
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Grid container spacing={2}>
            {DEMO_COURTS.map((m) => (
              <Grid key={m.court} size={{ xs: 12, sm: 6 }}>
                <Card sx={{ overflow: "hidden" }}>
                  <Box sx={{ bgcolor: "#111827", color: "#f9fafb", px: 1.5, py: 0.75 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={800}>
                        Court {m.court}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          label="● LIVE"
                          sx={{ bgcolor: "#ef4444", color: "#fff", fontWeight: 800, height: 18 }}
                        />
                        <Typography variant="caption" fontWeight={700}>
                          {m.t}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                  <Box sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1}>
                      <TeamPanel label="Team 1" players={m.a} color={TEAM_BLUE} />
                      <TeamPanel label="Team 2" players={m.b} color={TEAM_ORANGE} />
                    </Stack>
                    <Stack direction="row" spacing={1} mt={1.5}>
                      <Button
                        fullWidth
                        size="small"
                        sx={{ bgcolor: TEAM_BLUE, color: "#fff", pointerEvents: "none" }}
                      >
                        Team 1 Wins
                      </Button>
                      <Button
                        fullWidth
                        size="small"
                        sx={{ bgcolor: TEAM_ORANGE, color: "#fff", pointerEvents: "none" }}
                      >
                        Team 2 Wins
                      </Button>
                    </Stack>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Box mt={2}>
            <Typography variant="h6" color="text.secondary" mb={1}>
              Next up
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {DEMO_QUEUE.map(([n, g], i) => (
                <Chip key={n} label={`${i + 1}. ${n} · ${g}g`} variant="outlined" />
              ))}
              <Chip color="success" label="Auto-matched" sx={{ ml: "auto" }} />
            </Stack>
          </Box>
        </Box>
      </Card>
    </Container>
  );
}
