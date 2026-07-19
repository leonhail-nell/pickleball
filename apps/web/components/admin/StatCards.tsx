"use client";

import { type AdminStats, peso } from "@/components/admin/types";
import { Card, CardContent, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";

/** Six headline metric cards across the top of the dashboard. */
export function StatCards({ totals }: { totals: AdminStats["totals"] }) {
  const card = (label: string, value: string | number, sub?: string) => (
    <Grid size={{ xs: 6, md: 2 }}>
      <Card>
        <CardContent>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ letterSpacing: 1 }}
          >
            {label.toUpperCase()}
          </Typography>
          <Typography variant="h5" fontWeight={800}>
            {value}
          </Typography>
          {sub && (
            <Typography variant="caption" color="text.secondary">
              {sub}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Grid>
  );

  return (
    <Grid container spacing={2}>
      {card("Sessions", totals.sessions)}
      {card("Players", totals.players)}
      {card("Games", totals.games)}
      {card("Revenue", peso(totals.revenueCents), "collected")}
      {card("Pending", peso(totals.pendingCents), "uncollected fees")}
      {card("Members", totals.activeMemberships, "active")}
    </Grid>
  );
}
