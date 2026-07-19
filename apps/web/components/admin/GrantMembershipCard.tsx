"use client";

import type { Member, Plan } from "@/components/admin/types";
import {
  Button,
  Card,
  CardContent,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";

/** Grant a membership plan to a player. */
export function GrantMembershipCard({
  users,
  plans,
  grantUser,
  grantPlan,
  onGrantUser,
  onGrantPlan,
  onGrant,
}: {
  users: Member[];
  plans: Plan[];
  grantUser: string;
  grantPlan: string;
  onGrantUser: (v: string) => void;
  onGrantPlan: (v: string) => void;
  onGrant: () => void;
}) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Grant membership
        </Typography>
        <Stack direction="row" spacing={1}>
          <Select
            size="small"
            displayEmpty
            value={grantUser}
            onChange={(e) => onGrantUser(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Player…</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}
              </MenuItem>
            ))}
          </Select>
          <Select
            size="small"
            displayEmpty
            value={grantPlan}
            onChange={(e) => onGrantPlan(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">Plan…</MenuItem>
            {plans.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
          <Button
            variant="contained"
            disabled={!grantUser || !grantPlan}
            onClick={onGrant}
          >
            Grant
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" mt={1} display="block">
          Members on drop-in-free plans skip session fees automatically.
        </Typography>
      </CardContent>
    </Card>
  );
}
