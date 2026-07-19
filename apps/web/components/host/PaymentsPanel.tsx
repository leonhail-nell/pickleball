"use client";

import type { SessionPayment } from "@/components/host/types";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";

/** Drop-in fee tracker: mark each player's fee paid (cash/gcash) or waived. */
export function PaymentsPanel({
  payments,
  onMarkPaid,
}: {
  payments: SessionPayment[];
  onMarkPaid: (paymentId: string, method?: string, waive?: boolean) => void;
}) {
  if (!payments.length) return null;

  const unpaid = payments.filter((p) => p.status === "PENDING").length;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Drop-in fees{" "}
          <Typography component="span" variant="caption" color="text.secondary">
            ({unpaid} unpaid)
          </Typography>
        </Typography>
        <Stack spacing={1}>
          {payments.map((p) => (
            <Stack
              key={p.id}
              direction="row"
              alignItems="center"
              spacing={1}
              flexWrap="wrap"
              useFlexGap
            >
              <Typography variant="body2" sx={{ minWidth: 90 }}>
                {p.user.name}
              </Typography>
              <Chip
                size="small"
                label={
                  p.status === "PENDING"
                    ? `₱${(p.amountCents / 100).toFixed(0)} due`
                    : p.status === "WAIVED"
                      ? "waived"
                      : `paid${p.method ? ` · ${p.method.toLowerCase()}` : ""}`
                }
                color={
                  p.status === "PENDING"
                    ? "warning"
                    : p.status === "PAID"
                      ? "success"
                      : "default"
                }
                variant={p.status === "PENDING" ? "filled" : "outlined"}
              />
              {p.status === "PENDING" && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onMarkPaid(p.id, "CASH")}
                  >
                    Cash
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onMarkPaid(p.id, "GCASH")}
                  >
                    GCash
                  </Button>
                  <Button size="small" onClick={() => onMarkPaid(p.id, undefined, true)}>
                    Waive
                  </Button>
                </>
              )}
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
