"use client";

import { type Plan, peso } from "@/components/admin/types";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/** List membership plans and add a new one. */
export function PlansCard({
  plans,
  planName,
  planPrice,
  onPlanName,
  onPlanPrice,
  onCreate,
}: {
  plans: Plan[];
  planName: string;
  planPrice: string;
  onPlanName: (v: string) => void;
  onPlanPrice: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Membership plans
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
          {plans.map((p) => (
            <Chip
              key={p.id}
              label={`${p.name} · ${peso(p.priceCents)}/${p.period === "ANNUAL" ? "yr" : "mo"}`}
            />
          ))}
          {!plans.length && (
            <Typography variant="body2" color="text.secondary">
              No plans yet.
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            label="Plan name"
            value={planName}
            onChange={(e) => onPlanName(e.target.value)}
          />
          <TextField
            size="small"
            label="₱/month"
            sx={{ width: 100 }}
            value={planPrice}
            onChange={(e) => onPlanPrice(e.target.value)}
          />
          <Button variant="contained" disabled={!planName || !planPrice} onClick={onCreate}>
            Add
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
