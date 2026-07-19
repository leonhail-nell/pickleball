'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser, clearAuth } from '@/lib/api';
import { TopNav } from '@/components/nav';
import {
  Alert, Box, Button, Card, CardContent, Chip, LinearProgress, MenuItem, Select,
  Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TvIcon from '@mui/icons-material/Tv';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

interface SessionRow {
  id: string;
  title: string;
  organizer: string;
  createdById?: string | null;
  priceCents: number;
  startsAt: string;
  endsAt: string;
  capacity: number;
  status: string;
  tierMin: number | null;
  tierMax: number | null;
  courts: { court: { id: string; number: number } }[];
  _count: { signups: number };
}

const TIERS: Record<string, { min: number | null; max: number | null; label: string }> = {
  open: { min: null, max: null, label: 'Open (all levels)' },
  beginner: { min: 2.0, max: 3.0, label: '2.0–3.0' },
  intermediate: { min: 3.0, max: 3.5, label: '3.0–3.5' },
  advanced: { min: 3.5, max: 4.0, label: '3.5–4.0' },
  expert: { min: 4.0, max: 5.5, label: '4.0+' },
};

export default function Sessions() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [courts, setCourts] = useState<{ id: string; number: number }[]>([]);
  const [error, setError] = useState('');
  // read localStorage only after mount — avoids SSR/client hydration mismatch
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [tier, setTier] = useState('open');
  const [mySignups, setMySignups] = useState<Record<string, string>>({});

  const loadMySignups = () =>
    api<{ sessionId: string; status: string }[]>('/me/signups')
      .then((rows) => setMySignups(Object.fromEntries(rows.map((r) => [r.sessionId, r.status]))))
      .catch(() => {});
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.push('/login?next=/sessions');
      return;
    }
    setUser(u);
    Promise.all([api<SessionRow[]>('/sessions'), api<{ id: string; number: number }[]>('/courts')])
      .then(([s, c]) => { setSessions(s); setCourts(c); })
      .catch((e) => setError(e.message));
    void loadMySignups();
  }, [router]);

  const isHost = user && ['HOST', 'ADMIN'].includes(user.role);
  /** Ownership: admins manage every session; organizers only the ones they created. */
  const canManage = (s: SessionRow) =>
    !!user && (user.role === 'ADMIN' || (!!s.createdById && s.createdById === user.id));

  async function createSession() {
    // guard: never create a session with zero courts
    const courtList = courts.length ? courts : await api<{ id: string; number: number }[]>('/courts');
    if (!courts.length) setCourts(courtList);
    if (!courtList.length) {
      setError('No courts configured — run the seed or add courts first.');
      return;
    }
    const now = new Date();
    const end = new Date(now.getTime() + 3 * 3600_000);
    try {
      await api('/sessions', {
        method: 'POST',
        json: {
          startsAt: now.toISOString(),
          endsAt: end.toISOString(),
          capacity: 24,
          courtIds: courtList.map((c) => c.id),
          tierMin: TIERS[tier].min,
          tierMax: TIERS[tier].max,
          title: title || 'Open Play',
          organizer: user?.name ?? '',
          priceCents: Math.round(Number(price || 0) * 100),
        },
      });
      setSessions(await api<SessionRow[]>('/sessions'));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteSession(id: string, title: string) {
    if (!window.confirm(`Delete "${title}" and all its games, sign-ups, and fees? This cannot be undone.`)) return;
    try {
      await api(`/sessions/${id}`, { method: 'DELETE' });
      setSessions(await api<SessionRow[]>('/sessions'));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function signUp(id: string) {
    setError('');
    try {
      await api(`/sessions/${id}/signups`, { method: 'POST' });
      setSessions(await api<SessionRow[]>('/sessions'));
      void loadMySignups();
    } catch (e) {
      setError((e as Error).message); // e.g. tier gate: "this session is rated 3–3.5…"
    }
  }

  const statusColor = (s: string) =>
    s === 'LIVE' ? 'success' : s === 'CLOSED' ? 'default' : 'secondary';

  return (
    <>
    <TopNav />
    <Box sx={{ maxWidth: 1100, mx: 'auto', p: 3 }}>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {isHost && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <TextField
                size="small" label="Event title" sx={{ minWidth: 220 }}
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Friday Night Open Play"
              />
              <TextField
                size="small" label="₱ / player" sx={{ width: 110 }} inputMode="numeric"
                value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0"
              />
              <Select size="small" value={tier} onChange={(e) => setTier(e.target.value)}>
                {Object.entries(TIERS).map(([k, t]) => (
                  <MenuItem key={k} value={k}>{t.label}</MenuItem>
                ))}
              </Select>
              <Button variant="contained" startIcon={<AddIcon />} onClick={createSession}>
                Create session (now, all courts)
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack spacing={2}>
        {sessions.map((s) => {
          const duration = Math.round(
            (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 3600_000,
          );
          return (
            <Card key={s.id}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={2}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="h6" fontWeight={800} noWrap>
                        {s.title || 'Open Play'}
                      </Typography>
                      <Chip size="small" label={s.status} color={statusColor(s.status)} />
                      <Chip
                        size="small" color="warning"
                        label={s.tierMin != null ? `${s.tierMin}–${s.tierMax ?? '∞'}` : 'All Levels'}
                      />
                    </Stack>
                    <Typography color="text.secondary" variant="body2" mt={0.5}>
                      {new Date(s.startsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(s.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {' – '}
                      {new Date(s.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {` · ${duration}h`}
                      {s.organizer ? ` · hosted by ${s.organizer}` : ''}
                    </Typography>
                    <Box mt={1} sx={{ maxWidth: 320 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, (s._count.signups / s.capacity) * 100)}
                        color={s._count.signups >= s.capacity ? 'error' : 'success'}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                      <Typography variant="caption" color="text.secondary" noWrap display="block">
                        {Math.min(s._count.signups, s.capacity)}/{s.capacity} registered
                        {s._count.signups > s.capacity ? ` · +${s._count.signups - s.capacity} walk-ins` : ''}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} mt={1} flexWrap="wrap" useFlexGap>
                      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1, mr: 0.5 }}>
                        COURTS
                      </Typography>
                      {s.courts.map((c) => (
                        <Chip key={c.court.id} size="small" variant="outlined" label={`#${c.court.number}`} sx={{ height: 20 }} />
                      ))}
                    </Stack>
                  </Box>

                  <Stack alignItems="flex-end" spacing={1} justifyContent="space-between">
                    <Typography variant="h6" fontWeight={800}>
                      {s.priceCents > 0 ? `₱${(s.priceCents / 100).toFixed(0)}` : 'Free'}
                      <Typography component="span" variant="caption" color="text.secondary"> /player</Typography>
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                      <Button variant="outlined" size="small" href={`/session/${s.id}`}>
                        Details
                      </Button>
                      {s.status !== 'CLOSED' && (
                        mySignups[s.id] ? (
                          <Button variant="contained" size="small" disabled>
                            {mySignups[s.id] === 'CHECKED_IN' ? 'Checked in ✓'
                              : mySignups[s.id] === 'WAITLISTED' ? 'Waitlisted'
                              : 'Joined ✓'}
                          </Button>
                        ) : (
                          <Button variant="contained" size="small" onClick={() => signUp(s.id)}>
                            Join Now
                          </Button>
                        )
                      )}
                      {s.status === 'LIVE' && (
                        <Button variant="outlined" size="small" startIcon={<TvIcon />} href={`/board/${s.id}`}>
                          Board
                        </Button>
                      )}
                      {s.status !== 'CLOSED' && mySignups[s.id] && (
                        <Button variant="outlined" size="small" href={`/play/${s.id}`}>My view</Button>
                      )}
                      {canManage(s) && s.status !== 'CLOSED' && (
                        <Button variant="contained" size="small" color="secondary" startIcon={<SportsTennisIcon />} href={`/host/${s.id}`}>
                          {s.status === 'LIVE' ? 'Host' : 'Start'}
                        </Button>
                      )}
                      {canManage(s) && s.status !== 'LIVE' && (
                        <Button
                          variant="outlined" size="small" color="error" startIcon={<DeleteOutlineIcon />}
                          onClick={() => deleteSession(s.id, s.title || 'Open Play')}
                        >
                          Delete
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}
        {!sessions.length && !error && (
          <Typography color="text.secondary">No sessions yet.</Typography>
        )}
      </Stack>
    </Box>
    </>
  );
}
