"use client";

import type { ResolveMap } from "@/types/host";
import type { PendingGame } from "@/lib/api";
import { R, TEAM_GREEN } from "@/constant/court";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/** Games awaiting host confirmation, with quick confirm and manual resolve. */
export function PendingScoresPanel({
  pending,
  resolve,
  onResolveChange,
  onConfirm,
  onResolve,
}: {
  pending: PendingGame[];
  resolve: ResolveMap;
  onResolveChange: (next: ResolveMap) => void;
  onConfirm: (gameId: string) => void;
  onResolve: (gameId: string) => void;
}) {
  if (!pending.length) return null;

  return (
    <Card
      sx={{
        mb: 2.5,
        borderRadius: R.card,
        borderColor: "rgba(251,191,36,0.45)",
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
        <Stack direction="row" spacing={1.25} alignItems="baseline" mb={1.5}>
          <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
            Awaiting confirmation
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(28,42,26,0.45)" }}>
            {pending.length} game{pending.length === 1 ? "" : "s"}
          </Typography>
        </Stack>

        <Stack spacing={1}>
          {pending.map((p) => (
            <Stack
              key={p.gameId}
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "stretch", sm: "center" }}
              spacing={1.25}
              sx={{
                pl: 1.5,
                pr: 1.25,
                py: 1.15,
                borderRadius: R.row,
                bgcolor: "#fdf8ef",
                border: "1px solid rgba(251,191,36,0.35)",
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography
                    sx={{ fontWeight: 800, fontSize: "0.9rem", color: "#1c2a1a" }}
                  >
                    {p.teamA.map((x) => x.name).join(" + ")}{" "}
                    <Box component="span" sx={{ color: TEAM_GREEN }}>
                      {p.a}
                    </Box>
                    {" — "}
                    <Box component="span" sx={{ color: TEAM_GREEN }}>
                      {p.b}
                    </Box>{" "}
                    {p.teamB.map((x) => x.name).join(" + ")}
                  </Typography>
                  {p.disputed && (
                    <Chip
                      size="small"
                      color="error"
                      label="Disputed"
                      sx={{ height: 22, fontWeight: 800 }}
                    />
                  )}
                </Stack>
              </Box>

              <Stack
                direction="row"
                spacing={0.75}
                alignItems="center"
                justifyContent={{ xs: "flex-start", sm: "flex-end" }}
                sx={{ flexShrink: 0, flexWrap: "nowrap" }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => onConfirm(p.gameId)}
                  sx={{
                    fontWeight: 700,
                    borderColor: "#cfe3c6",
                    color: TEAM_GREEN,
                    whiteSpace: "nowrap",
                  }}
                >
                  Confirm
                </Button>
                <TextField
                  size="small"
                  sx={{ width: 52 }}
                  placeholder="A"
                  inputMode="numeric"
                  value={resolve[p.gameId]?.a ?? ""}
                  onChange={(e) =>
                    onResolveChange({
                      ...resolve,
                      [p.gameId]: { a: e.target.value, b: resolve[p.gameId]?.b ?? "" },
                    })
                  }
                />
                <TextField
                  size="small"
                  sx={{ width: 52 }}
                  placeholder="B"
                  inputMode="numeric"
                  value={resolve[p.gameId]?.b ?? ""}
                  onChange={(e) =>
                    onResolveChange({
                      ...resolve,
                      [p.gameId]: { a: resolve[p.gameId]?.a ?? "", b: e.target.value },
                    })
                  }
                />
                <Button
                  size="small"
                  onClick={() => onResolve(p.gameId)}
                  sx={{ fontWeight: 700, color: "rgba(28,42,26,0.55)", minWidth: 0 }}
                >
                  Resolve
                </Button>
              </Stack>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
