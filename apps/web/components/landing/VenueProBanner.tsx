"use client";

import { ROADMAP, VENUE_PRO_FEATURES } from "@/constant/landing";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";

/** Venue Pro gradient banner plus the roadmap chips. */
export function VenueProBanner() {
  return (
    <>
      <Container maxWidth="lg" sx={{ pb: 10 }}>
        <Card
          sx={{
            background: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)",
            border: "none",
            color: "#ffffff",
            p: { xs: 1, md: 2 },
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Chip
              label="Venue Pro"
              sx={{ bgcolor: "rgba(255,255,255,0.22)", color: "#fff", fontWeight: 700, mb: 2 }}
            />
            <Typography variant="h4" sx={{ color: "#fff", fontSize: { xs: "1.6rem", md: "2rem" } }}>
              For clubs running bigger open play
            </Typography>
            <Typography sx={{ color: "rgba(255,255,255,0.9)", mt: 1.5, maxWidth: 720 }}>
              PicklePlay is free for up to 5 courts. Venue Pro is for clubs that need more courts,
              plus priority support as new features land.
            </Typography>
            <Grid container spacing={1} mt={2} sx={{ maxWidth: 760 }}>
              {VENUE_PRO_FEATURES.map((f) => (
                <Grid key={f} size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ color: "#fff" }}>✓ {f}</Typography>
                </Grid>
              ))}
            </Grid>
            <Typography sx={{ color: "rgba(255,255,255,0.85)", mt: 2.5 }}>
              New clubs can start a 14-day free trial from the club dashboard.
            </Typography>
            <Button
              href="/admin"
              size="large"
              sx={{
                mt: 2.5,
                bgcolor: "#ffffff",
                color: "#15803d",
                fontWeight: 800,
                px: 4,
                "&:hover": { bgcolor: "#f0fdf4" },
              }}
            >
              Get Venue Pro
            </Button>
          </CardContent>
        </Card>
      </Container>

      <Container maxWidth="md" sx={{ textAlign: "center", pb: 10 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: "1.5rem", md: "1.9rem" } }}>
          Growing with your club
        </Typography>
        <Typography color="text.secondary" mt={1} mb={3}>
          On the roadmap — coming in future phases:
        </Typography>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
          {ROADMAP.map((r) => (
            <Chip key={r} label={r} variant="outlined" sx={{ fontSize: "0.95rem", py: 2.2, px: 0.5 }} />
          ))}
        </Stack>
      </Container>
    </>
  );
}
