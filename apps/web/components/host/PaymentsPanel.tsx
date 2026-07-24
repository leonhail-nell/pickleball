"use client";

import type { SessionPayment } from "@/types/host";
import { R, TEAM_GREEN } from "@/constant/court";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

const headSx = {
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase" as const,
  color: "rgba(28,42,26,0.45)",
  borderColor: "#eef3ea",
  py: 1,
};

function statusMeta(p: SessionPayment) {
  if (p.status === "PENDING") {
    return {
      label: `₱${(p.amountCents / 100).toFixed(0)} due`,
      color: "warning" as const,
      variant: "filled" as const,
    };
  }
  if (p.status === "WAIVED") {
    return { label: "waived", color: "default" as const, variant: "outlined" as const };
  }
  return {
    label: `paid${p.method ? ` · ${p.method.toLowerCase()}` : ""}`,
    color: "success" as const,
    variant: "outlined" as const,
  };
}

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
    <Card sx={{ borderRadius: R.card }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
        <Stack direction="row" spacing={1.25} alignItems="baseline" mb={1}>
          <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
            Drop-in fees
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(28,42,26,0.45)" }}>
            {unpaid} unpaid
          </Typography>
        </Stack>

        <Box sx={{ overflowX: "auto", mx: { xs: -0.5, sm: 0 } }}>
          <Table size="small" sx={{ minWidth: 320 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>Player</TableCell>
                <TableCell sx={{ ...headSx, width: 120 }}>Status</TableCell>
                <TableCell sx={{ ...headSx, width: 190 }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((p) => {
                const meta = statusMeta(p);
                return (
                  <TableRow
                    key={p.id}
                    sx={{
                      "& td": {
                        borderColor: "#eef3ea",
                        py: 1.15,
                        verticalAlign: "middle",
                      },
                    }}
                  >
                    <TableCell>
                      <Typography
                        noWrap
                        sx={{ fontWeight: 800, fontSize: "0.9rem", color: "#1c2a1a" }}
                      >
                        {p.user.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={meta.label}
                        color={meta.color}
                        variant={meta.variant}
                        sx={{ height: 22, fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      {p.status === "PENDING" ? (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                          alignItems="center"
                          sx={{ flexWrap: "nowrap" }}
                        >
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onMarkPaid(p.id, "CASH")}
                            sx={{
                              minWidth: 0,
                              px: 1,
                              fontWeight: 700,
                              borderColor: "#cfe3c6",
                              color: TEAM_GREEN,
                            }}
                          >
                            Cash
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => onMarkPaid(p.id, "GCASH")}
                            sx={{
                              minWidth: 0,
                              px: 1,
                              fontWeight: 700,
                              borderColor: "#cfe3c6",
                              color: TEAM_GREEN,
                            }}
                          >
                            GCash
                          </Button>
                          <Button
                            size="small"
                            onClick={() => onMarkPaid(p.id, undefined, true)}
                            sx={{
                              minWidth: 0,
                              px: 1,
                              fontWeight: 700,
                              color: "rgba(28,42,26,0.55)",
                            }}
                          >
                            Waive
                          </Button>
                        </Stack>
                      ) : (
                        <Typography
                          variant="caption"
                          sx={{ color: "rgba(28,42,26,0.35)", fontWeight: 600 }}
                        >
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
}
