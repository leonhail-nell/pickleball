'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { TopNav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import TvIcon from '@mui/icons-material/Tv';

interface ClubSession {
  id: string; title: string; organizer: string; status: string; location?: string;
  startsAt: string; endsAt: string; priceCents: number; capacity: number;
  tierMin: number | null; tierMax: number | null; courts: number; signups: number;
}
interface ClubDetail { id: string; name: string; sessions: ClubSession[] }

const statusSx = (st: string) =>
  st === 'LIVE' ? { bgcolor: '#4c9a44', color: '#fff' } : { bgcolor: '#e2f2dc', color: '#2f6b2b' };

/** Public club page: the club's open plays. */
export default function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [club, setClub] = useState<ClubDetail | null>(null);
  const [error, setError] = useState('');
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [mySignups, setMySignups] = useState<Record<string, string>>({});

  useEffect(() => {
    api<ClubDetail>(`/clubs/${id}`).then(setClub).catch((e) => setError(e.message));
    const u = getUser();
    setUser(u);
    if (u) api<{ sessionId: string; status: string }[]>('/me/signups')
      .then((r) => setMySignups(Object.fromEntries(r.map((x) => [x.sessionId, x.status]))))
      .catch(() => {});
  }, [id]);

  /** Actually join the open play (sign up). Sends guests to login first. */
  async function joinSession(sid: string) {
    if (!user) { router.push(`/login?next=/session/${sid}`); return; }
    setError('');
    try {
      await api(`/sessions/${sid}/signups`, { method: 'POST' });
      setMySignups((m) => ({ ...m, [sid]: 'SIGNED_UP' }));
      router.push(`/play/${sid}`);
    } catch (e) { setError((e as Error).message); }
  }

  if (error && !club) return <Box p={3}><TopNav /><Typography color="error" mt={3}>{error}</Typography></Box>;
  if (!club) return <Box p={3}><TopNav /><Typography mt={3}>Loading…</Typography></Box>;

  const live = club.sessions.filter((s) => s.status === 'LIVE');
  const upcoming = club.sessions.filter((s) => s.status !== 'LIVE');

  const sessionCard = (s: ClubSession) => {
    const duration = Math.round((new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 3600_000);
    return (
      <Card key={s.id}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h6" fontWeight={800}>{s.title}</Typography>
                <Chip size="small" label={s.status} sx={{ ...statusSx(s.status), fontWeight: 800, height: 24 }} />
                <Chip size="small" label={s.tierMin != null ? `${s.tierMin} – ${s.tierMax ?? '∞'}` : 'All Levels'} sx={{ bgcolor: '#fdf1d7', color: '#b07f24', fontWeight: 800, height: 24 }} />
              </Stack>
              <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.55)', mt: 0.5 }}>
                {new Date(s.startsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}{new Date(s.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {` · ${duration}h · ${Math.min(s.signups, s.capacity)}/${s.capacity} in`}
                {s.location ? ` · 📍 ${s.location}` : ''}
              </Typography>
            </Box>
            <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1} sx={{ flexShrink: 0 }}>
              <Typography variant="h6" fontWeight={800}>
                {s.priceCents > 0 ? `₱${(s.priceCents / 100).toFixed(0)}` : 'Free'}
                <Typography component="span" variant="caption" sx={{ color: 'rgba(28,42,26,0.5)' }}> /player</Typography>
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" component={Link} href={`/session/${s.id}`}>Details</Button>
                {s.status === 'LIVE' && <Button variant="outlined" startIcon={<TvIcon />} component={Link} href={`/board/${s.id}`}>Board</Button>}
                {mySignups[s.id] ? (
                  <Button variant="contained" component={Link} href={`/play/${s.id}`} sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' } }}>
                    {mySignups[s.id] === 'CHECKED_IN' ? 'Checked in ✓' : mySignups[s.id] === 'WAITLISTED' ? 'Waitlisted' : 'Joined ✓ · My view'}
                  </Button>
                ) : (
                  <Button variant="contained" onClick={() => joinSession(s.id)} sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' } }}>Join</Button>
                )}
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopNav />
      <Box sx={{ maxWidth: 1000, mx: 'auto', p: { xs: 2, md: 3 }, width: '100%', flex: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={3}>
          <Box sx={{ width: 60, height: 60, borderRadius: '18px', bgcolor: '#cdeabf', color: '#2f6b2b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>🏓</Box>
          <Box>
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>{club.name}</Typography>
            <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}>
              {club.sessions.length} open play{club.sessions.length === 1 ? '' : 's'} · {live.length} live now
            </Typography>
          </Box>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {live.length > 0 && (
          <>
            <Typography variant="h6" fontWeight={800} mb={1.5}>Live now</Typography>
            <Stack spacing={2} mb={3}>{live.map(sessionCard)}</Stack>
          </>
        )}
        <Typography variant="h6" fontWeight={800} mb={1.5}>Upcoming open play</Typography>
        <Stack spacing={2}>
          {upcoming.map(sessionCard)}
          {!upcoming.length && <Typography color="text.secondary">No upcoming open plays scheduled.</Typography>}
        </Stack>
      </Box>
      <Footer />
    </Box>
  );
}
