"use client";

import type { ResolveMap } from "@/types/host";
import type { PendingGame } from "@/lib/api";
import {
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
    <Card sx={{ mb: 2, borderColor: "rgba(251,191,36,0.5)" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Awaiting confirmation
        </Typography>
        <Stack spacing={1}>
          {pending.map((p) => (
            <Stack
              key={p.gameId}
              direction="row"
              alignItems="center"
              spacing={1.5}
              flexWrap="wrap"
              useFlexGap
            >
              <Typography variant="body2">
                {p.teamA.map((x) => x.name).join(" + ")} <strong>{p.a}</strong> —{" "}
                <strong>{p.b}</strong> {p.teamB.map((x) => x.name).join(" + ")}
              </Typography>
              {p.disputed && <Chip size="small" color="error" label="DISPUTED" />}
              <Button size="small" variant="outlined" onClick={() => onConfirm(p.gameId)}>
                Confirm now
              </Button>
              <TextField
                size="small"
                sx={{ width: 56 }}
                placeholder="A"
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
                sx={{ width: 56 }}
                placeholder="B"
                value={resolve[p.gameId]?.b ?? ""}
                onChange={(e) =>
                  onResolveChange({
                    ...resolve,
                    [p.gameId]: { a: resolve[p.gameId]?.a ?? "", b: e.target.value },
                  })
                }
              />
              <Button size="small" onClick={() => onResolve(p.gameId)}>
                Resolve
              </Button>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
