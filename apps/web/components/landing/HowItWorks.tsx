"use client";

import { BUILT_FOR, STEPS } from "@/constant/landing";
import { Card, CardContent, Chip, Container, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";

/** "How it works" three-step grid plus the "Built for" chips. */
export function HowItWorks() {
  return (
    <>
      <Container maxWidth="lg" sx={{ pb: 10, pt: 4 }}>
        <Typography variant="h3" align="center" sx={{ fontSize: { xs: "1.8rem", md: "2.3rem" } }}>
          How it works
        </Typography>
        <Typography align="center" color="text.secondary" mb={5} mt={1}>
          Get on the court in three simple steps
        </Typography>
        <Grid container spacing={3}>
          {STEPS.map((s) => (
            <Grid key={s.n} size={{ xs: 12, md: 4 }}>
              <Card
                sx={{
                  height: "100%",
                  "&:hover": {
                    boxShadow: "0 8px 24px rgba(17,24,39,0.10)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                <CardContent sx={{ p: 3.5 }}>
                  <Typography sx={{ fontSize: "2rem", mb: 1.5 }}>{s.icon}</Typography>
                  <Typography variant="h6" gutterBottom>
                    {s.title}
                  </Typography>
                  <Typography color="text.secondary">{s.body}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Container maxWidth="md" sx={{ textAlign: "center", pb: 8 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: "1.5rem", md: "1.9rem" }, mb: 3 }}>
          Built for
        </Typography>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
          {BUILT_FOR.map((t) => (
            <Chip
              key={t}
              label={t}
              sx={{
                fontSize: "0.95rem",
                py: 2.2,
                px: 0.5,
                bgcolor: "#ffffff",
                border: "1px solid rgba(17,24,39,0.10)",
              }}
            />
          ))}
        </Stack>
      </Container>
    </>
  );
}
