"use client";

import { MembersTable } from "@/components/admin/MembersTable";
import type { EditMemberTarget, Member } from "@/components/admin/types";
import {
  Button,
  Card,
  CardContent,
  Rating,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

/** Add-member form plus the organizers/staff and players tables. */
export function MembersManager({
  users,
  newName,
  newEmail,
  newRating,
  onNewName,
  onNewEmail,
  onNewRating,
  onAdd,
  onChangeRole,
  onEdit,
}: {
  users: Member[];
  newName: string;
  newEmail: string;
  newRating: number;
  onNewName: (v: string) => void;
  onNewEmail: (v: string) => void;
  onNewRating: (v: number) => void;
  onAdd: () => void;
  onChangeRole: (userId: string, role: string) => void;
  onEdit: (target: EditMemberTarget) => void;
}) {
  const staff = users.filter((u) => u.role !== "PLAYER");
  const players = users.filter((u) => u.role === "PLAYER");

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Members
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          mb={2}
        >
          <TextField
            size="small"
            label="Name"
            value={newName}
            onChange={(e) => onNewName(e.target.value)}
          />
          <TextField
            size="small"
            label="Email"
            value={newEmail}
            onChange={(e) => onNewEmail(e.target.value)}
          />
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Skill
            </Typography>
            <Rating
              precision={0.5}
              max={5}
              value={newRating}
              onChange={(_, v) => onNewRating(v ?? 3)}
            />
          </Stack>
          <Button
            variant="contained"
            disabled={!newName.trim() || !newEmail.trim()}
            onClick={onAdd}
          >
            Add member
          </Button>
        </Stack>

        <MembersTable
          title="ORGANIZERS & STAFF"
          members={staff}
          mt={1}
          onChangeRole={onChangeRole}
          onEdit={onEdit}
        />
        <MembersTable
          title="PLAYERS"
          members={players}
          onChangeRole={onChangeRole}
          onEdit={onEdit}
        />
      </CardContent>
    </Card>
  );
}
