'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser, clearAuth } from '@/lib/api';
import { TopNav } from '@/components/nav';
import { Pager } from '@/components/pager';
import { usePagination } from '@/lib/usePagination';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, InputAdornment, MenuItem, Select, Stack, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import PlaceIcon from '@mui/icons-material/Place';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import { ConfirmDialog, type ConfirmState } from '@/components/confirm-dialog';
import { LabeledField } from '@/components/labeled-field';
import { SessionCard } from '@/components/sessions/SessionCard';
import { useClub } from '@/lib/useClub';
import type { SessionRow } from '@/types/session';

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
  const [courtCount, setCourtCount] = useState(2);
  const [durationH, setDurationH] = useState(3);
  const [whenAt, setWhenAt] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [creating, setCreating] = useState(false);
  const club = useClub();
  // free plan caps sessions at the club's court limit; Pro unlocks all courts
  const freeLimit = club?.freeCourtLimit ?? 4;
  const isPro = !!club?.venuePro;
  const totalCourts = courts.length || 1;
  const maxCourts = isPro ? totalCourts : Math.min(totalCourts, freeLimit);
  // Pro-locked teaser options shown (disabled) below the free ceiling
  const proTeaser = !isPro ? [freeLimit + 1, freeLimit + 2] : [];

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
    const start = whenAt ? new Date(whenAt) : new Date();
    const end = new Date(start.getTime() + durationH * 3600_000);
    const cap = club && !club.venuePro ? club.freeCourtLimit : courtList.length;
    const n = Math.max(1, Math.min(courtCount, courtList.length, cap));
    setCreating(true);
    try {
      await api('/sessions', {
        method: 'POST',
        json: {
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          capacity: 24,
          courtIds: courtList.slice(0, n).map((c) => c.id),
          tierMin: TIERS[tier].min,
          tierMax: TIERS[tier].max,
          title: title || 'Open Play',
          location: location.trim(),
          organizer: user?.name ?? '',
          priceCents: Math.round(Number(price || 0) * 100),
          isPrivate: visibility === 'private',
        },
      });
      setSessions(await api<SessionRow[]>('/sessions'));
      setCreateOpen(false);
      setTitle(''); setPrice(''); setTier('open'); setVisibility('public'); setCourtCount(2); setDurationH(3);
      setWhenAt(''); setLocation('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
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
  const paged = usePagination(visible, 8);

  const filterOptions = isHost
    ? [['all', 'All sessions'], ['mine', 'My sessions'], ['live', 'Live now'], ['private', 'Members only'], ['open', 'Upcoming & live']]
    : [['all', 'All sessions'], ['mine', 'Joined'], ['live', 'Live now'], ['open', 'Upcoming & live']];

  return (
    <>
    <TopNav />
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Stack direction="row" spacing={1.25} alignItems="baseline" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
        <Stack direction="row" spacing={1.25} alignItems="baseline">
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Open Plays</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}>
            {isHost ? "your club's open plays" : 'your club plays & ones you’ve joined'}
          </Typography>
        </Stack>
        <Button variant="text" href="/find" startIcon={<SearchIcon />} sx={{ color: '#2f6b2b', fontWeight: 700 }}>
          Find a game at another club
        </Button>
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
        {paged.slice.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            isHost={!!canManage(s)}
            mySignupStatus={mySignups[s.id]}
            onSignUp={signUp}
            onDelete={deleteSession}
          />
        ))}
        {!visible.length && !error && (
          <Card>
            <CardContent sx={{ py: 5, textAlign: 'center' }}>
              <Typography color="text.secondary" mb={sessions.length ? 0 : 2}>
                {sessions.length
                  ? 'No open plays match your search or filter.'
                  : isHost ? 'No open plays in your club yet — create your first one.' : 'You haven’t joined any open plays yet.'}
              </Typography>
              {!sessions.length && !isHost && (
                <Button variant="contained" href="/find" startIcon={<SearchIcon />} sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' } }}>
                  Find a game to join
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        <Pager page={paged.page} pageCount={paged.pageCount} total={paged.total} perPage={paged.perPage} onChange={paged.setPage} unit="open plays" />
      </Stack>

      {/* ── create-session modal ───────────────────────────────── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>New open play</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <LabeledField
              label="Event title" autoFocus placeholder="Friday Night Open Play"
              value={title} onChange={(e) => setTitle(e.target.value)}
            />
            <LabeledField
              label="Drop-in fee (per player)" inputMode="numeric" placeholder="0"
              value={price} onChange={(e) => setPrice(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
            />
            <LabeledField
              label="Skill level" select value={tier} onChange={(e) => setTier(e.target.value)}
            >
              {Object.entries(TIERS).map(([k, t]) => (
                <MenuItem key={k} value={k}>{t.label}</MenuItem>
              ))}
            </LabeledField>
            <LabeledField
              label="When" type="datetime-local" hint="Leave blank to start now"
              value={whenAt} onChange={(e) => setWhenAt(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <LabeledField
              label="Where" placeholder="Venue or address (optional)"
              value={location} onChange={(e) => setLocation(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><PlaceIcon sx={{ fontSize: 18, color: 'rgba(28,42,26,0.4)' }} /></InputAdornment> }}
            />
            <Stack direction="row" spacing={1.5}>
              <Box sx={{ flex: 1 }}>
                <LabeledField
                  label="Courts"
                  hint={isPro ? undefined : `Free plan: up to ${freeLimit} courts`}
                  select value={Math.min(courtCount, maxCourts)}
                  onChange={(e) => setCourtCount(Number(e.target.value))}
                >
                  {Array.from({ length: maxCourts }, (_, i) => i + 1).map((n) => (
                    <MenuItem key={n} value={n}>{n} court{n > 1 ? 's' : ''}</MenuItem>
                  ))}
                  {proTeaser.map((n) => (
                    <MenuItem
                      key={n} value={n} disabled
                      sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
                    >
                      <span>{n} courts</span>
                      <Chip
                        size="small" icon={<LockIcon sx={{ fontSize: '0.8rem !important' }} />} label="Venue Pro"
                        sx={{ bgcolor: '#fdf1d7', color: '#b07f24', fontWeight: 800, height: 20, '& .MuiChip-icon': { color: '#b07f24' } }}
                      />
                    </MenuItem>
                  ))}
                </LabeledField>
              </Box>
              <Box sx={{ flex: 1 }}>
                <LabeledField
                  label="Duration" select value={durationH}
                  onChange={(e) => setDurationH(Number(e.target.value))}
                >
                  {[1, 1.5, 2, 2.5, 3, 4, 5, 6].map((h) => (
                    <MenuItem key={h} value={h}>{h} hour{h > 1 ? 's' : ''}</MenuItem>
                  ))}
                </LabeledField>
              </Box>
            </Stack>
            {!isPro && (
              <Chip
                size="small" clickable component="a" href="/admin"
                label={`⭐ Venue Pro unlocks 5+ courts (free plan: ${freeLimit})`}
                sx={{ bgcolor: '#fdf1d7', color: '#b07f24', fontWeight: 800, alignSelf: 'flex-start' }}
              />
            )}
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
              Starts {whenAt ? new Date(whenAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'now'}
              {' '}for {durationH} hour{durationH > 1 ? 's' : ''} on {Math.min(courtCount, maxCourts)} court{Math.min(courtCount, maxCourts) > 1 ? 's' : ''}
              {location.trim() ? ` at ${location.trim()}` : ''}. Add or remove courts once it&apos;s live.
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
