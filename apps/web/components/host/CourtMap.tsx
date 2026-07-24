"use client";

import {
  CourtCard,
  TEAM_GREEN,
  TEAM_ORANGE,
} from "@/components/board";
import type { Pending, ScoreTarget, SwapTarget } from "@/types/host";
import type { Board, NamedPlayer } from "@/lib/api";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import {
  Box,
  Button,
  Card,
  Chip,
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
  addCourtDisabled,
  addCourtHint,
  onDrop,
  onDragOver,
  onDragLeave,
  onAssignSlot,
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
  addCourtDisabled?: boolean;
  addCourtHint?: string;
  onDrop: (courtId: string, team: "A" | "B", e: React.DragEvent) => void;
  onDragOver: (key: string) => void;
  onDragLeave: () => void;
  onAssignSlot: (courtId: string, team: "A" | "B") => void;
  onRemovePending: (courtId: string, pid: string) => void;
  onStartCustom: (courtId: string) => void;
}) {
  return (
    <Grid container spacing={2}>
      {board.courts.map((c) => {
        const p = pending[c.courtId] ?? { A: [], B: [] };
        const teamA = c.gameId ? c.teamA : p.A.map(named);
        const teamB = c.gameId ? c.teamB : p.B.map(named);
        const filling = !c.gameId;
        const canStart =
          filling && (p.A?.length ?? 0) === 2 && (p.B?.length ?? 0) === 2;

        return (
          <Grid key={c.courtId} size={{ xs: 12, sm: 6 }}>
            <Box
              className={
                filling && dragOver?.startsWith(c.courtId) ? "drop-target" : undefined
              }
              onDragOver={
                filling
                  ? (e) => {
                      e.preventDefault();
                      const team: "A" | "B" =
                        (p.A?.length ?? 0) < 2 ? "A" : "B";
                      onDragOver(`${c.courtId}:${team}`);
                    }
                  : undefined
              }
              onDragLeave={filling ? onDragLeave : undefined}
              onDrop={
                filling
                  ? (e) => {
                      e.preventDefault();
                      const team: "A" | "B" =
                        (p.A?.length ?? 0) < 2 ? "A" : "B";
                      onDrop(c.courtId, team, e);
                    }
                  : undefined
              }
            >
              <CourtCard
                number={c.number}
                chipLabel={c.gameId ? "Open Play" : "Filling"}
                startedAt={c.gameId ? c.startedAt : null}
                teamA={teamA}
                teamB={teamB}
                onPlayerClick={
                  c.gameId
                    ? (player) =>
                        onSwapOut({
                          gameId: c.gameId!,
                          outId: player.id,
                          name: player.name,
                        })
                    : (player) => onRemovePending(c.courtId, player.id)
                }
                onEmptySlotClick={
                  filling
                    ? (team) => onAssignSlot(c.courtId, team)
                    : undefined
                }
                footer={
                  c.gameId ? (
                    <Stack spacing={1}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                          fullWidth
                          variant="contained"
                          sx={{
                            bgcolor: TEAM_GREEN,
                            color: "#fff",
                            fontWeight: 800,
                            py: 1.1,
                            borderRadius: "12px",
                            "&:hover": { bgcolor: "#24551f" },
                          }}
                          onClick={() =>
                            onScoreFor({ gameId: c.gameId!, winner: "A" })
                          }
                        >
                          Team 1 Wins
                        </Button>
                        <Button
                          fullWidth
                          variant="contained"
                          sx={{
                            bgcolor: TEAM_ORANGE,
                            color: "#fff",
                            fontWeight: 800,
                            py: 1.1,
                            borderRadius: "12px",
                            "&:hover": { bgcolor: "#d97706" },
                          }}
                          onClick={() =>
                            onScoreFor({ gameId: c.gameId!, winner: "B" })
                          }
                        >
                          Team 2 Wins
                        </Button>
                      </Stack>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                      >
                        {c.assignmentType === "manual" && (
                          <Chip size="small" color="error" label="manual" />
                        )}
                        <Button
                          size="small"
                          onClick={() => onVoid(c.gameId!)}
                          sx={{
                            color: "#a04a35",
                            fontWeight: 700,
                            textTransform: "none",
                          }}
                        >
                          Void
                        </Button>
                        <Button
                          size="small"
                          startIcon={<DeleteOutlineIcon />}
                          onClick={() =>
                            onRemoveCourt(c.courtId, c.number, true)
                          }
                          sx={{
                            color: "rgba(28,42,26,0.55)",
                            fontWeight: 700,
                            textTransform: "none",
                          }}
                        >
                          Remove court
                        </Button>
                        <Select
                          size="small"
                          displayEmpty
                          value=""
                          sx={{ ml: { sm: "auto" }, minWidth: 140 }}
                          onChange={(e) =>
                            e.target.value && onMove(c.gameId!, e.target.value)
                          }
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
                  ) : (
                    <Stack spacing={1}>
                      <Button
                        variant="contained"
                        disabled={!canStart}
                        onClick={() => onStartCustom(c.courtId)}
                        sx={{
                          bgcolor: TEAM_GREEN,
                          fontWeight: 800,
                          "&:hover": { bgcolor: "#24551f" },
                        }}
                      >
                        Start custom game
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => onRemoveCourt(c.courtId, c.number)}
                        sx={{
                          color: "rgba(28,42,26,0.55)",
                          fontWeight: 700,
                          alignSelf: "flex-start",
                          textTransform: "none",
                        }}
                      >
                        Remove court
                      </Button>
                    </Stack>
                  )
                }
              />
            </Box>
          </Grid>
        );
      })}

      <Grid size={{ xs: 12, sm: 6 }}>
        <Card
          sx={{
            borderStyle: "dashed",
            borderColor: "#cfe3c6",
            bgcolor: "rgba(255,255,255,0.6)",
            minHeight: 120,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "none",
          }}
        >
          <Stack alignItems="center" spacing={1} py={2}>
            <Typography variant="body2" color="text.secondary">
              {addCourtHint ?? "Need more space?"}
            </Typography>
            <Button
              variant="contained"
              disabled={addCourtDisabled}
              onClick={onAddCourt}
              sx={{
                bgcolor: TEAM_GREEN,
                fontWeight: 800,
                "&:hover": { bgcolor: "#24551f" },
              }}
            >
              + Add court
            </Button>
          </Stack>
        </Card>
      </Grid>

      {board.nextMatch && (
        <Grid size={12}>
          <CourtCard
            title="Next match"
            chipLabel="Auto"
            teamA={board.nextMatch.teamA}
            teamB={board.nextMatch.teamB}
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
