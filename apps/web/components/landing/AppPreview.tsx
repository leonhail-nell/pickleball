"use client";

import { CourtCard, TEAM_GREEN, TEAM_ORANGE } from "@/components/board";
import { Box, Button, Card, Chip, Container, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";

const DEMO_COURTS = [
  {
    court: 1,
    mins: 5,
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
    mins: 6,
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
      <Card sx={{ maxWidth: 860, mx: "auto", overflow: "hidden", borderRadius: "16px" }}>
        <Box sx={{ px: 2.5, py: 1.5, borderBottom: "1px solid #eef3ea" }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={1}
          >
            <Typography fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
              Friday Night Open Play
            </Typography>
            <Stack direction="row" spacing={0.75}>
              {[["Games", "12"], ["Courts", "2/2"], ["Queue", "4"]].map(([k, v]) => (
                <Chip
                  key={k}
                  size="small"
                  label={`${k} ${v}`}
                  sx={{ bgcolor: "#e2f2dc", color: "#2f6b2b", fontWeight: 700, height: 22 }}
                />
              ))}
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ p: 2.5, bgcolor: "#f0f7f2" }}>
          <Grid container spacing={2}>
            {DEMO_COURTS.map((m) => (
              <Grid key={m.court} size={{ xs: 12, sm: 6 }}>
                <CourtCard
                  size="sm"
                  number={m.court}
                  startedAt={Date.now() - m.mins * 60_000}
                  teamA={m.a}
                  teamB={m.b}
                  footer={
                    <Stack direction="row" spacing={1}>
                      <Button
                        fullWidth
                        size="small"
                        sx={{
                          bgcolor: TEAM_GREEN,
                          color: "#fff",
                          fontWeight: 700,
                          pointerEvents: "none",
                        }}
                      >
                        Team 1 Wins
                      </Button>
                      <Button
                        fullWidth
                        size="small"
                        sx={{
                          bgcolor: TEAM_ORANGE,
                          color: "#fff",
                          fontWeight: 700,
                          pointerEvents: "none",
                        }}
                      >
                        Team 2 Wins
                      </Button>
                    </Stack>
                  }
                />
              </Grid>
            ))}
          </Grid>
          <Box mt={2}>
            <Typography variant="subtitle2" color="text.secondary" mb={1}>
              Waiting queue
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {DEMO_QUEUE.map(([n, g], i) => (
                <Chip
                  key={n}
                  label={`${i + 1}. ${n} · ${g}g`}
                  sx={{ bgcolor: "#e6f2dc", fontWeight: 700 }}
                />
              ))}
            </Stack>
          </Box>
        </Box>
      </Card>
    </Container>
  );
}
