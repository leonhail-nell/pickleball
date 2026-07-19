"use client";

import { PaddleLogo } from "@/components/logo";
import { HERO_BULLETS } from "@/constant/landing";
import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";

/** Top nav bar + hero headline + CTAs + live stat counters. */
export function Hero({
  loggedIn,
  stats,
}: {
  loggedIn: boolean;
  stats: { sessions: number; players: number; games: number } | null;
}) {
  const stat = (value: number, label: string) => (
    <Box textAlign="center">
      <Typography variant="h4" fontWeight={800} sx={{ color: "secondary.main" }}>
        {value.toLocaleString()}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );

  return (
    <>
      <Container maxWidth="lg">
        <Stack direction="row" justifyContent="space-between" alignItems="center" py={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <PaddleLogo size={30} />
            <Typography variant="h5" fontWeight={800}>
              Pickle
              <Box component="span" sx={{ color: "secondary.main" }}>
                Play
              </Box>
            </Typography>
          </Stack>
          <Button variant="contained" size="large" href={loggedIn ? "/sessions" : "/welcome"}>
            {loggedIn ? "Open the app" : "Try It Free"}
          </Button>
        </Stack>
      </Container>

      <Container maxWidth="md" sx={{ textAlign: "center", pt: { xs: 6, md: 9 }, pb: 6 }}>
        <Chip
          label="For clubs, rec centers, and open play organizers"
          sx={{ bgcolor: "rgba(34,197,94,0.12)", color: "secondary.main", fontWeight: 600, mb: 3 }}
        />
        <Typography variant="h1" sx={{ fontSize: { xs: "2.5rem", md: "4rem" }, lineHeight: 1.08 }}>
          Run open play
          <Box component="span" sx={{ display: "block", color: "secondary.main" }}>
            fairly, every time
          </Box>
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 3, fontSize: "1.2rem", maxWidth: 620, mx: "auto" }}>
          Live queue, QR check-in, unbiased court rotation, and leaderboards — players follow
          everything from their phones.
        </Typography>
        <Stack direction="row" spacing={2} justifyContent="center" mt={4}>
          <Button
            variant="contained"
            size="large"
            href={loggedIn ? "/sessions" : "/welcome"}
            sx={{ px: 4, py: 1.5, fontSize: "1.05rem" }}
          >
            {loggedIn ? "Start a Session" : "Get Started Free"}
          </Button>
          <Button
            variant="outlined"
            size="large"
            href={loggedIn ? "/sessions" : "/login"}
            sx={{ px: 4, py: 1.5, fontSize: "1.05rem" }}
          >
            {loggedIn ? "My sessions" : "Log in"}
          </Button>
        </Stack>
        <Stack direction="row" spacing={3} justifyContent="center" mt={3} flexWrap="wrap" useFlexGap>
          {HERO_BULLETS.map((t) => (
            <Typography key={t} variant="body2" color="text.secondary">
              {t}
            </Typography>
          ))}
        </Stack>

        {stats && (stats.games > 0 || stats.sessions > 0) && (
          <Stack direction="row" spacing={6} justifyContent="center" mt={6}>
            {stat(stats.sessions, "Sessions run")}
            {stat(stats.games, "Games played")}
            {stat(stats.players, "Players")}
          </Stack>
        )}
      </Container>
    </>
  );
}
