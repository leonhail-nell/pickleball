"use client";

import { CourtCard, CourtStatusPill, TeamPanel, TEAM_BLUE, TEAM_ORANGE } from "@/components/board";
import type { Pending, ScoreTarget, SwapTarget } from "@/components/host/types";
import type { Board, NamedPlayer } from "@/lib/api";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";

/** The court map: live courts, empty courts with manual pairing, add-court, next-match. */
export function CourtMap({
  board,
  pending,
  dragOver,
  named,
  onSwapOut,
  onScoreFor,
  onVoid,
  onMove,
  onRemoveCourt,
  onAddCourt,
  onDrop,
  onDragOver,
  onDragLeave,
  onAddPending,
  onRemovePending,
  onStartCustom,
}: {
  board: Board;
  pending: Record<string, Pending>;
  dragOver: string | null;
  named: (pid: string) => NamedPlayer;
  onSwapOut: (t: SwapTarget) => void;
  onScoreFor: (t: ScoreTarget) => void;
  onVoid: (gameId: string) => void;
  onMove: (gameId: string, courtId: string) => void;
  onRemoveCourt: (courtId: string, number: number, live?: boolean) => void;
  onAddCourt: () => void;
  onDrop: (courtId: string, team: "A" | "B", e: React.DragEvent) => void;
  onDragOver: (key: string) => void;
  onDragLeave: () => void;
  onAddPending: (courtId: string, team: "A" | "B", pid: string) => void;
  onRemovePending: (courtId: string, pid: string) => void;
  onStartCustom: (courtId: string) => void;
}) {
  return (
    <Grid container spacing={2}>
      {board.courts.map((c) => (
        <Grid key={c.courtId} size={{ xs: 12, sm: 6 }}>
          {c.gameId ? (
            <CourtCard
              number={c.number}
              statusLabel="Open Play"
              startedAt={c.startedAt}
              teamA={c.teamA}
              teamB={c.teamB}
              live
              onSwap={(pid) =>
                onSwapOut({
                  gameId: c.gameId!,
                  outId: pid,
                  name: [...c.teamA, ...c.teamB].find((p) => p.id === pid)?.name ?? "",
                })
              }
              footer={
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1}>
                    <Button
                      fullWidth
                      variant="contained"
                      sx={{ bgcolor: TEAM_BLUE, color: "#fff", "&:hover": { bgcolor: "#2563eb" } }}
                      onClick={() => onScoreFor({ gameId: c.gameId!, winner: "A" })}
                    >
                      Team 1 Wins
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      sx={{ bgcolor: TEAM_ORANGE, color: "#fff", "&:hover": { bgcolor: "#d97706" } }}
                      onClick={() => onScoreFor({ gameId: c.gameId!, winner: "B" })}
                    >
                      Team 2 Wins
                    </Button>
                  </Stack>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {c.assignmentType === "manual" && (
                      <Chip size="small" color="error" label="manual" />
                    )}
                    <Button size="small" color="error" onClick={() => onVoid(c.gameId!)}>
                      Void
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteOutlineIcon />}
                      onClick={() => onRemoveCourt(c.courtId, c.number, true)}
                    >
                      Remove
                    </Button>
                    <Select
                      size="small"
                      displayEmpty
                      value=""
                      sx={{ ml: "auto", minWidth: 140 }}
                      onChange={(e) => e.target.value && onMove(c.gameId!, e.target.value)}
                    >
                      <MenuItem value="">Move to court…</MenuItem>
                      {board.courts
                        .filter((o) => !o.gameId && o.courtId !== c.courtId)
                        .map((o) => (
                          <MenuItem key={o.courtId} value={o.courtId}>
                            Court {o.number}
                          </MenuItem>
                        ))}
                    </Select>
                  </Stack>
                </Stack>
              }
            />
          ) : (
            <Box
              sx={{
                bgcolor: "#ffffff",
                borderRadius: "18px",
                p: 2.25,
                border: "1px solid rgba(20,54,26,0.08)",
                boxShadow: "0 2px 10px rgba(20,54,26,0.05)",
              }}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                mb={1.75}
                gap={1}
              >
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <Typography
                    fontWeight={900}
                    sx={{ color: "#14361a", fontSize: "1.4rem", letterSpacing: "-0.01em" }}
                  >
                    Court {c.number}
                  </Typography>
                  <CourtStatusPill label="Filling" />
                </Stack>
                <IconButton
                  size="small"
                  title="Remove court"
                  sx={{ color: "rgba(20,54,26,0.55)" }}
                  onClick={() => onRemoveCourt(c.courtId, c.number)}
                >
                  ✕
                </IconButton>
              </Stack>
              <Stack spacing={1}>
                <Stack direction="row" spacing={1}>
                  {(["A", "B"] as const).map((team) => {
                    const p = pending[c.courtId] ?? { A: [], B: [] };
                    return (
                      <Box
                        key={team}
                        className={`drop-zone ${dragOver === `${c.courtId}:${team}` ? "drop-target" : ""}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          onDragOver(`${c.courtId}:${team}`);
                        }}
                        onDragLeave={onDragLeave}
                        onDrop={(e) => onDrop(c.courtId, team, e)}
                        sx={{ flex: 1 }}
                      >
                        <TeamPanel
                          label={team === "A" ? "Team 1" : "Team 2"}
                          players={(p[team] ?? []).map(named)}
                          color={team === "A" ? TEAM_BLUE : TEAM_ORANGE}
                          onRemove={(pid) => onRemovePending(c.courtId, pid)}
                        />
                        {(p[team]?.length ?? 0) < 2 && (
                          <Select
                            size="small"
                            displayEmpty
                            value=""
                            fullWidth
                            sx={{ mt: 0.5 }}
                            onChange={(e) => {
                              if (e.target.value) onAddPending(c.courtId, team, e.target.value);
                            }}
                          >
                            <MenuItem value="">+ Add player…</MenuItem>
                            {board.waiting
                              .filter((w) => !p.A.includes(w.id) && !p.B.includes(w.id))
                              .map((w) => (
                                <MenuItem key={w.id} value={w.id}>
                                  {w.name} ({w.rating.toFixed(2)})
                                </MenuItem>
                              ))}
                          </Select>
                        )}
                      </Box>
                    );
                  })}
                </Stack>
                <Button
                  variant="contained"
                  disabled={
                    (pending[c.courtId]?.A.length ?? 0) !== 2 ||
                    (pending[c.courtId]?.B.length ?? 0) !== 2
                  }
                  onClick={() => onStartCustom(c.courtId)}
                >
                  Start custom game
                </Button>
              </Stack>
            </Box>
          )}
        </Grid>
      ))}

      <Grid size={{ xs: 12, sm: 6 }}>
        <Card
          sx={{
            borderStyle: "dashed",
            minHeight: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.85,
          }}
        >
          <Stack alignItems="center" spacing={1} py={2}>
            <Typography variant="body2" color="text.secondary">
              Need more space?
            </Typography>
            <Button variant="contained" color="success" onClick={onAddCourt}>
              + Add court
            </Button>
          </Stack>
        </Card>
      </Grid>

      {board.nextMatch && (
        <Grid size={12}>
          <CourtCard
            statusLabel="Next match"
            teamA={board.nextMatch.teamA}
            teamB={board.nextMatch.teamB}
            header={<Chip size="small" label="Auto" color="success" sx={{ height: 20 }} />}
            footer={
              <Typography variant="caption" color="text.secondary">
                Starts automatically when a court frees up
              </Typography>
            }
          />
        </Grid>
      )}
    </Grid>
  );
}
