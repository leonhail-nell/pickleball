"use client";

import type { EditMemberTarget, Member } from "@/types/admin";
import EditIcon from "@mui/icons-material/Edit";
import {
  Box,
  IconButton,
  MenuItem,
  Rating,
  Select,
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
};

/** A titled table of members with skill, role selector, no-shows, and edit. */
export function MembersTable({
  title,
  members,
  mt = 3,
  onChangeRole,
  onEdit,
}: {
  title: string;
  members: Member[];
  mt?: number;
  onChangeRole: (userId: string, role: string) => void;
  onEdit: (target: EditMemberTarget) => void;
}) {
  return (
    <>
      <Typography
        variant="subtitle2"
        sx={{
          mt,
          mb: 0.75,
          color: "rgba(28,42,26,0.45)",
          letterSpacing: "0.1em",
          fontWeight: 700,
          fontSize: "0.68rem",
        }}
      >
        {title}
      </Typography>
      <Box sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 480 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={headSx}>Member</TableCell>
              <TableCell sx={headSx}>Skill</TableCell>
              <TableCell sx={headSx}>Role</TableCell>
              <TableCell sx={headSx} align="right">
                No-shows
              </TableCell>
              <TableCell sx={headSx} align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((u) => (
              <TableRow
                key={u.id}
                hover
                sx={{ "& td": { borderColor: "#eef3ea", py: 1.25 } }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={800}>
                    {u.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {u.email}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Rating readOnly size="small" precision={0.5} max={5} value={u.rating} />
                    <Typography variant="caption" fontWeight={700}>
                      {u.rating.toFixed(2)}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Select
                    size="small"
                    value={u.role}
                    sx={{ minWidth: 100 }}
                    onChange={(e) => onChangeRole(u.id, e.target.value)}
                  >
                    <MenuItem value="PLAYER">Player</MenuItem>
                    <MenuItem value="HOST">Host</MenuItem>
                    <MenuItem value="ADMIN">Admin</MenuItem>
                  </Select>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight={700}>{u.strikes}</Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => onEdit({ id: u.id, name: u.name, rating: u.rating })}
                    sx={{ color: "rgba(28,42,26,0.55)" }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </>
  );
}
