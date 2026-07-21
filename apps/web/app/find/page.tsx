'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { TopNav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { Pager } from '@/components/pager';
import { usePagination } from '@/lib/usePagination';
import {
  Alert, Box, Button, Card, CardContent, Chip, InputAdornment, MenuItem, Select,
  Stack, TextField, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TvIcon from '@mui/icons-material/Tv';

interface DiscoverSession {
  id: string; title: string; organizer: string; status: string; location?: string;
  startsAt: string; endsAt: string; priceCents: number; capacity: number;
  tierMin: number | null; tierMax: number | null; courts: number; signups: number;
  clubId: string | null; clubName: string;
}

const statusSx = (st: string) =>
  st === 'LIVE' ? { bgcolor: '#4c9a44', color: '#fff' } : { bgcolor: '#e2f2dc', color: '#2f6b2b' };

/** Public discovery — browse open plays across every club. */
export default function FindGamePage() {
  const router = useRouter();
  const [rows, setRows] = useState<DiscoverSession[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [mySignups, setMySignups] = useState<Record<string, string>>({});

  useEffect(() => {
    api<DiscoverSession[]>('/discover').then(setRows).catch((e) => setError(e.message));
    const u = getUser();
    setUser(u);
    if (u) api<{ sessionId: string; status: string }[]>('/me/signups')
      .then((r) => setMySignups(Object.fromEntries(r.map((x) => [x.sessionId, x.status]))))
      .catch(() => {});
  }, []);

  /** Actually join the open play (sign up). Sends guests to login first. */
  async function joinSession(id: string) {
    if (!user) { router.push(`/login?next=/session/${id}`); return; }
    setError('');
    try {
      await api(`/sessions/${id}/signups`, { method: 'POST' });
      setMySignups((m) => ({ ...m, [id]: 'SIGNED_UP' }));
      router.push(`/play/${id}`);
    } catch (e) { setError((e as Error).message); }
  }

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => rows.filter((s) => {
    if (q && !`${s.title} ${s.clubName} ${s.organizer}`.toLowerCase().includes(q)) return false;
    if (filter === 'live') return s.status === 'LIVE';
    if (filter === 'free') return s.priceCents === 0;
    return true;
  }), [rows, q, filter]);
  const paged = usePagination(visible, 8);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopNav />
      <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 3 }, width: '100%', flex: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.25, sm: 1.25 }} alignItems={{ xs: 'flex-start', sm: 'baseline' }} mb={2}>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Find a Game</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}>open plays happening across clubs</Typography>
        </Stack>

        <Card sx={{ mb: 2.5 }}>
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <TextField
                size="small" placeholder="Search games or clubs…" sx={{ flex: 1, minWidth: 220 }}
                value={search} onChange={(e) => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'rgba(28,42,26,0.4)' }} /></InputAdornment> }}
              />
              <Select size="small" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 150 }}>
                <MenuItem value="all">All games</MenuItem>
                <MenuItem value="live">Live now</MenuItem>
                <MenuItem value="free">Free entry</MenuItem>
              </Select>
            </Stack>
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        <Stack spacing={2}>
          {paged.slice.map((s) => {
            const duration = Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 3600_000);
            return (
              <Card key={s.id}>
                <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>{s.title}</Typography>
                        <Chip size="small" label={s.status} sx={{ ...statusSx(s.status), fontWeight: 800, height: 24 }} />
                        <Chip size="small" label={s.tierMin != null ? `${s.tierMin} – ${s.tierMax ?? '∞'}` : 'All Levels'} sx={{ bgcolor: '#fdf1d7', color: '#b07f24', fontWeight: 800, height: 24 }} />
                      </Stack>
                      <Typography
                        component={Link} href={`/clubs/${s.clubId}`}
                        variant="body2" sx={{ color: '#2f6b2b', fontWeight: 700, mt: 0.5, display: 'inline-block', textDecoration: 'none' }}
                      >
                        🏓 {s.clubName}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.55)', mt: 0.25 }}>
                        {new Date(s.startsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}{new Date(s.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        {` · ${duration}h · ${s.courts} court${s.courts > 1 ? 's' : ''} · ${Math.min(s.signups, s.capacity)}/${s.capacity} in`}
                        {s.location ? ` · 📍 ${s.location}` : ''}
                      </Typography>
                    </Box>
                    <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1.5} sx={{ flexShrink: 0 }}>
                      <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                        {s.priceCents > 0 ? `₱${(s.priceCents / 100).toFixed(0)}` : 'Free'}
                        <Typography component="span" variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}> /player</Typography>
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button variant="outlined" component={Link} href={`/session/${s.id}`}>Details</Button>
                        {s.status === 'LIVE' && (
                          <Button variant="outlined" startIcon={<TvIcon />} component={Link} href={`/board/${s.id}`}>Board</Button>
                        )}
                        {mySignups[s.id] ? (
                          <Button variant="contained" component={Link} href={`/play/${s.id}`} sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' } }}>
                            {mySignups[s.id] === 'CHECKED_IN' ? 'Checked in ✓' : mySignups[s.id] === 'WAITLISTED' ? 'Waitlisted' : 'Joined ✓ · My view'}
                          </Button>
                        ) : (
                          <Button variant="contained" onClick={() => joinSession(s.id)} sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' } }}>
                            Join
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
            <Card><CardContent sx={{ py: 5, textAlign: 'center' }}>
              <Typography color="text.secondary">No open plays to show right now — check back soon.</Typography>
            </CardContent></Card>
          )}
        </Stack>
        <Pager page={paged.page} pageCount={paged.pageCount} total={paged.total} perPage={paged.perPage} onChange={paged.setPage} unit="open plays" />
      </Box>
      <Footer />
    </Box>
  );
}
