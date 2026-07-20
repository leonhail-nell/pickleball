'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser, clearAuth } from '@/lib/api';
import { TopNav } from '@/components/nav';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, InputAdornment, MenuItem, Select, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TvIcon from '@mui/icons-material/Tv';
import SearchIcon from '@mui/icons-material/Search';
import LockIcon from '@mui/icons-material/Lock';
import PublicIcon from '@mui/icons-material/Public';
import SportsTennisIcon from '@mui/icons-material/SportsTennis';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { ConfirmDialog, type ConfirmState } from '@/components/confirm-dialog';

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
  isPrivate?: boolean;
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
  const [mySignups, setMySignups] = useState<Record<string, string>>({});
  // toolbar: search text + filter dropdown
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  // create-session modal form
  const [createOpen, setCreateOpen] = useState(false);
  const [tier, setTier] = useState('open');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);

  const loadMySignups = () =>
    api<{ sessionId: string; status: string }[]>('/me/signups')
      .then((rows) => setMySignups(Object.fromEntries(rows.map((r) => [r.sessionId, r.status]))))
      .catch(() => {});

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
    setCreating(true);
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
          isPrivate: visibility === 'private',
        },
      });
      setSessions(await api<SessionRow[]>('/sessions'));
      setCreateOpen(false);
      setTitle(''); setPrice(''); setTier('open'); setVisibility('public');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  function deleteSession(id: string, title: string) {
    setConfirm({
      title: `Delete “${title}”?`,
      message: 'All of its games, sign-ups, and fees are permanently deleted. This cannot be undone.',
      confirmLabel: 'Delete session',
      onConfirm: async () => {
        try {
          await api(`/sessions/${id}`, { method: 'DELETE' });
          setSessions(await api<SessionRow[]>('/sessions'));
        } catch (e) {
          setError((e as Error).message);
        }
      },
    });
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

  /** Design-system status chip colors. */
  const statusSx = (st: string) =>
    st === 'LIVE'
      ? { bgcolor: '#4c9a44', color: '#ffffff' }
      : st === 'CLOSED'
        ? { bgcolor: '#e8ebe6', color: '#5a6b56' }
        : { bgcolor: '#e2f2dc', color: '#2f6b2b' };

  // search + filter, applied client-side
  const q = search.trim().toLowerCase();
  const visible = sessions.filter((s) => {
    if (q && !`${s.title} ${s.organizer}`.toLowerCase().includes(q)) return false;
    if (filter === 'mine') return isHost ? canManage(s) : !!mySignups[s.id];
    if (filter === 'live') return s.status === 'LIVE';
    if (filter === 'private') return !!s.isPrivate;
    if (filter === 'open') return s.status !== 'CLOSED';
    return true;
  });

  const filterOptions = isHost
    ? [['all', 'All sessions'], ['mine', 'My sessions'], ['live', 'Live now'], ['private', 'Members only'], ['open', 'Upcoming & live']]
    : [['all', 'All sessions'], ['mine', 'Joined'], ['live', 'Live now'], ['open', 'Upcoming & live']];

  return (
    <>
    <TopNav />
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Stack direction="row" spacing={1.25} alignItems="baseline" mb={2}>
        <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Sessions</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}>
          {isHost ? 'create & manage play sessions' : 'join an open play near you'}
        </Typography>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              size="small" placeholder="Search sessions…" sx={{ flex: 1, minWidth: 220 }}
              value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'rgba(28,42,26,0.4)' }} />
                  </InputAdornment>
                ),
              }}
            />
            <Select size="small" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 170 }}>
              {filterOptions.map(([k, label]) => (
                <MenuItem key={k} value={k}>{label}</MenuItem>
              ))}
            </Select>
            {isHost && (
              <Button
                variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}
                sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' }, whiteSpace: 'nowrap' }}
              >
                Create session
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Stack spacing={2.5}>
        {visible.map((s) => {
          const duration = Math.round(
            (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 3600_000,
          );
          const full = s._count.signups >= s.capacity;
          const fillPct = Math.min(100, (s._count.signups / s.capacity) * 100);
          return (
            <Card key={s.id}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={2.5}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="h5" fontWeight={800} noWrap sx={{ letterSpacing: '-0.02em' }}>
                        {s.title || 'Open Play'}
                      </Typography>
                      <Chip
                        size="small" label={s.status}
                        sx={{ ...statusSx(s.status), fontWeight: 800, letterSpacing: '0.04em', height: 24 }}
                      />
                      <Chip
                        size="small"
                        label={s.tierMin != null ? `${s.tierMin} – ${s.tierMax ?? '∞'}` : 'All Levels'}
                        sx={{ bgcolor: '#fdf1d7', color: '#b07f24', fontWeight: 800, height: 24 }}
                      />
                      {s.isPrivate && (
                        <Chip
                          size="small" icon={<LockIcon sx={{ fontSize: '0.85rem !important' }} />} label="Members only"
                          sx={{ bgcolor: '#eef4e9', color: '#2f5d2b', fontWeight: 700, height: 24, '& .MuiChip-icon': { color: '#2f5d2b' } }}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.55)', mt: 0.75 }}>
                      {new Date(s.startsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      {' · '}
                      {new Date(s.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {' – '}
                      {new Date(s.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      {` · ${duration}h`}
                      {s.organizer ? ` · hosted by ${s.organizer}` : ''}
                    </Typography>
                    <Box sx={{ mt: 1.75, maxWidth: 640 }}>
                      <Box sx={{ height: 7, borderRadius: 999, bgcolor: 'rgba(28,42,26,0.10)', overflow: 'hidden' }}>
                        <Box
                          sx={{
                            width: `${fillPct}%`, height: '100%', borderRadius: 999,
                            bgcolor: full ? '#e2634a' : '#4c9a44',
                          }}
                        />
                      </Box>
                      <Typography variant="body2" fontWeight={700} sx={{ mt: 0.75, color: '#1c2a1a' }}>
                        {Math.min(s._count.signups, s.capacity)}/{s.capacity} registered
                        {s._count.signups > s.capacity ? ` · +${s._count.signups - s.capacity} walk-ins` : ''}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75} mt={1.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="caption" sx={{ letterSpacing: '0.1em', fontWeight: 700, color: 'rgba(28,42,26,0.45)', mr: 0.5 }}>
                        COURTS
                      </Typography>
                      {s.courts.map((c) => (
                        <Chip
                          key={c.court.id} size="small" label={`#${c.court.number}`}
                          sx={{
                            height: 26, fontWeight: 800, bgcolor: '#eef4e9',
                            border: '1px solid #dbe8d3', color: '#2f5d2b',
                          }}
                        />
                      ))}
                    </Stack>
                  </Box>

                  <Stack alignItems="flex-end" spacing={2} sx={{ ml: 'auto' }}>
                    <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                      {s.priceCents > 0 ? `₱${(s.priceCents / 100).toFixed(0)}` : 'Free'}
                      <Typography component="span" variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}> /player</Typography>
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                      <Button variant="outlined" href={`/session/${s.id}`}>
                        Details
                      </Button>
                      {s.status !== 'CLOSED' && (
                        mySignups[s.id] ? (
                          <Button variant="contained" disabled>
                            {mySignups[s.id] === 'CHECKED_IN' ? 'Checked in ✓'
                              : mySignups[s.id] === 'WAITLISTED' ? 'Waitlisted'
                              : 'Joined ✓'}
                          </Button>
                        ) : (
                          <Button
                            variant="contained" onClick={() => signUp(s.id)}
                            sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' } }}
                          >
                            Join Now
                          </Button>
                        )
                      )}
                      {s.status === 'LIVE' && (
                        <Button variant="outlined" startIcon={<TvIcon />} href={`/board/${s.id}`}>
                          Board
                        </Button>
                      )}
                      {s.status !== 'CLOSED' && mySignups[s.id] && (
                        <Button variant="outlined" href={`/play/${s.id}`}>My view</Button>
                      )}
                      {canManage(s) && s.status !== 'CLOSED' && (
                        <Button
                          variant="contained" startIcon={<SportsTennisIcon />} href={`/host/${s.id}`}
                          sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' } }}
                        >
                          {s.status === 'LIVE' ? 'Host' : 'Start'}
                        </Button>
                      )}
                      {canManage(s) && s.status !== 'LIVE' && (
                        <Button
                          variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}
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
        {!visible.length && !error && (
          <Card>
            <CardContent sx={{ py: 5, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {sessions.length
                  ? 'No sessions match your search or filter.'
                  : isHost ? 'No sessions yet — create your first one.' : 'No sessions yet.'}
              </Typography>
            </CardContent>
          </Card>
        )}
      </Stack>

      {/* ── create-session modal ───────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>New open play</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <TextField
              label="Event title" fullWidth autoFocus placeholder="Friday Night Open Play"
              value={title} onChange={(e) => setTitle(e.target.value)}
            />
            <TextField
              label="Drop-in fee (₱ / player)" fullWidth inputMode="numeric" placeholder="0"
              value={price} onChange={(e) => setPrice(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
            />
            <TextField
              select label="Skill level" fullWidth value={tier} onChange={(e) => setTier(e.target.value)}
            >
              {Object.entries(TIERS).map(([k, t]) => (
                <MenuItem key={k} value={k}>{t.label}</MenuItem>
              ))}
            </TextField>
            <Box>
              <Typography variant="body2" fontWeight={700} mb={0.75}>Who can see this?</Typography>
              <ToggleButtonGroup
                exclusive fullWidth value={visibility} size="small"
                onChange={(_, v) => v && setVisibility(v)}
              >
                <ToggleButton value="public" sx={{ textTransform: 'none', gap: 0.75 }}>
                  <PublicIcon fontSize="small" /> Public
                </ToggleButton>
                <ToggleButton value="private" sx={{ textTransform: 'none', gap: 0.75 }}>
                  <LockIcon fontSize="small" /> Members only
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.5)', display: 'block', mt: 0.75 }}>
                {visibility === 'private'
                  ? 'Only club members (and staff) will see this session.'
                  : 'Anyone can find and join this open play.'}
              </Typography>
            </Box>
            <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.5)' }}>
              Starts now for 3 hours, using all available courts. You can add or remove courts once it&apos;s live.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: '#5a6b56', fontWeight: 700 }}>Cancel</Button>
          <Button
            variant="contained" disabled={creating} onClick={createSession}
            sx={{ bgcolor: '#2f6b2b', fontWeight: 700, '&:hover': { bgcolor: '#24551f' } }}
          >
            Create session
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </Box>
    </>
  );
}
