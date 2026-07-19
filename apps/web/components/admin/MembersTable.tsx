"use client";

import type { EditMemberTarget, Member } from "@/components/admin/types";
import EditIcon from "@mui/icons-material/Edit";
import {
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
        sx={{ mt, mb: 0.5, color: "text.secondary", letterSpacing: 0.5 }}
      >
        {title}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Member</TableCell>
            <TableCell>Skill</TableCell>
            <TableCell>Role</TableCell>
            <TableCell align="right">No-shows</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {members.map((u) => (
            <TableRow key={u.id} hover>
              <TableCell>
                <Typography variant="body2" fontWeight={700}>
                  {u.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {u.email}
                </Typography>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Rating readOnly size="small" precision={0.5} max={5} value={u.rating} />
                  <Typography variant="caption">{u.rating.toFixed(2)}</Typography>
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
              <TableCell align="right">{u.strikes}</TableCell>
              <TableCell align="right">
                <IconButton
                  size="small"
                  onClick={() => onEdit({ id: u.id, name: u.name, rating: u.rating })}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
