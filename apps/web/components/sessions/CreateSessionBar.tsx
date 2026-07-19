"use client";

import { TIERS } from "@/constant/tiers";
import AddIcon from "@mui/icons-material/Add";
import {
  Button,
  Card,
  CardContent,
  MenuItem,
  Select,
  Stack,
  TextField,
} from "@mui/material";

/** Host-only quick session creator (starts now, uses all courts). */
export function CreateSessionBar({
  title,
  price,
  tier,
  onTitle,
  onPrice,
  onTier,
  onCreate,
}: {
  title: string;
  price: string;
  tier: string;
  onTitle: (v: string) => void;
  onPrice: (v: string) => void;
  onTier: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            label="Event title"
            sx={{ minWidth: 220 }}
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="Friday Night Open Play"
          />
          <TextField
            size="small"
            label="₱ / player"
            sx={{ width: 110 }}
            inputMode="numeric"
            value={price}
            onChange={(e) => onPrice(e.target.value)}
            placeholder="0"
          />
          <Select size="small" value={tier} onChange={(e) => onTier(e.target.value)}>
            {Object.entries(TIERS).map(([k, t]) => (
              <MenuItem key={k} value={k}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
            Create session (now, all courts)
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
