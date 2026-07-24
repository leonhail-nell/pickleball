"use client";

import type { AdminStats } from "@/types/admin";
import { peso } from "@/constant/format";
import {
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

/** Recent sessions table; a row click opens that session. */
export function RecentSessionsCard({
  sessions,
  onOpen,
}: {
  sessions: AdminStats["sessions"];
  onOpen: (id: string) => void;
}) {
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Recent sessions
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Session</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Checked in</TableCell>
              <TableCell align="right">Games</TableCell>
              <TableCell align="right">Revenue</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.map((s) => (
              <TableRow
                key={s.id}
                hover
                onClick={() => onOpen(s.id)}
                sx={{ cursor: "pointer" }}
              >
                <TableCell>{s.title}</TableCell>
                <TableCell>{new Date(s.startsAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Chip size="small" label={s.status} />
                </TableCell>
                <TableCell align="right">{s.checkedIn}</TableCell>
                <TableCell align="right">{s.games}</TableCell>
                <TableCell align="right">{peso(s.revenueCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
