"use client";

import { QueueRow } from "@/components/board";
import type { EditTarget } from "@/types/host";
import type { BoardPlayer } from "@/lib/api";
import EditIcon from "@mui/icons-material/Edit";
import PauseIcon from "@mui/icons-material/Pause";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/** Waiting queue (searchable, drag-to-court) plus the paused-players list. */
export function QueueRail({
  waiting,
  paused,
  search,
  onSearch,
  onPause,
  onResume,
  onEdit,
  onRemove,
}: {
  waiting: BoardPlayer[];
  paused: BoardPlayer[];
  search: string;
  onSearch: (v: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onEdit: (target: EditTarget) => void;
  onRemove: (id: string, name: string) => void;
}) {
  const q = search.trim().toLowerCase();

  return (
    <Card sx={{ borderRadius: "16px" }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="baseline"
          flexWrap="wrap"
          useFlexGap
          mb={0.5}
        >
          <Typography variant="h6" fontWeight={800} sx={{ letterSpacing: "-0.02em" }}>
            Waiting queue
          </Typography>
          <Chip
            size="small"
            label={`${waiting.length} waiting`}
            sx={{
              bgcolor: "#e2f2dc",
              color: "#2f6b2b",
              fontWeight: 800,
              height: 22,
            }}
          />
          <Typography variant="caption" sx={{ color: "rgba(28,42,26,0.45)" }}>
            drag onto a court
          </Typography>
        </Stack>
        <TextField
          size="small"
          fullWidth
          placeholder="Search the queue…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          sx={{ mb: 1.5, mt: 1 }}
        />
        <Stack spacing={1}>
          {waiting
            .map((p, i) => ({ p, rank: i + 1 }))
            .filter(({ p }) => p.name.toLowerCase().includes(q))
            .map(({ p, rank }) => (
              <Box
                key={p.id}
                className="draggable"
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
              >
                <QueueRow
                  rank={rank}
                  player={p}
                  highlight={p.deficit > 0}
                  actions={
                    <>
                      {p.deficit > 0 && (
                        <Chip
                          size="small"
                          label={`+${p.deficit}`}
                          color="warning"
                          sx={{ mr: 0.5 }}
                        />
                      )}
                      <IconButton
                        size="small"
                        title="Pause player"
                        onClick={() => onPause(p.id)}
                        sx={{ color: "rgba(28,42,26,0.55)" }}
                      >
                        <PauseIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Edit name/rating"
                        onClick={() =>
                          onEdit({
                            id: p.id,
                            name: p.name,
                            rating: p.rating.toFixed(2),
                          })
                        }
                        sx={{ color: "rgba(28,42,26,0.55)" }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="Remove from session"
                        onClick={() => onRemove(p.id, p.name)}
                        sx={{ color: "#a04a35" }}
                      >
                        <PersonRemoveIcon fontSize="small" />
                      </IconButton>
                    </>
                  }
                />
              </Box>
            ))}
          {paused.map((p) => (
            <Box key={p.id} sx={{ opacity: 0.7 }}>
              <QueueRow
                rank={0}
                player={p}
                actions={
                  <>
                    <Chip
                      size="small"
                      label="paused"
                      variant="outlined"
                      sx={{ mr: 0.5 }}
                    />
                    <IconButton
                      size="small"
                      title="Resume player"
                      onClick={() => onResume(p.id)}
                    >
                      <PlayArrowIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Remove from session"
                      onClick={() => onRemove(p.id, p.name)}
                      sx={{ color: "#a04a35" }}
                    >
                      <PersonRemoveIcon fontSize="small" />
                    </IconButton>
                  </>
                }
              />
            </Box>
          ))}
          {!waiting.length && !paused.length && (
            <Typography variant="body2" color="text.secondary">
              Nobody waiting — check players in below.
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
