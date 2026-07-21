'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { api, getUser, type SessionMeta, type Standing } from '@/lib/api';
import { Leaderboard } from '@/components/leaderboard';
import { TopNav } from '@/components/nav';
import {
  Alert, Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GroupsIcon from '@mui/icons-material/Groups';
import TvIcon from '@mui/icons-material/Tv';
import ShareIcon from '@mui/icons-material/Share';
import { Stars, avatarSrcFor } from '@/components/board';
import { Avatar } from '@mui/material';
import Grid from '@mui/material/Grid2';

interface Participant {
  id: string;
  status: string;
  user: { id: string; name: string; rating: number; avatarUrl?: string | null };
}

/** Public event page — hero card + Details / Participants / Leaderboard tabs
 *  (structure modeled on picklehub.ph open play pages). */
export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

  const load = useCallback(async () => {
    try {
      const [m, s] = await Promise.all([
        api<SessionMeta>(`/sessions/${id}`),
        api<Standing[]>(`/sessions/${id}/standings`),
      ]);
      setMeta(m);
      setStandings(s);
      if (getUser()) {
        api<Participant[]>(`/sessions/${id}/signups`).then(setParticipants).catch(() => {});
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    setUser(getUser());
    void load();
  }, [load]);

  async function join() {
    setError('');
    setNotice('');
    if (!getUser()) {
      window.location.href = `/login?next=/session/${id}`;
      return;
    }
    try {
      await api(`/sessions/${id}/signups`, { method: 'POST' });
      setNotice('You are signed up! Check in at the venue with the QR code.');
      void load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function shareResults() {
    if (!meta) return;
    const url = window.location.href;
    const top = standings.slice(0, 3)
      .map((r) => `${r.rank}. ${r.name} (${r.wins}-${r.losses})`)
      .join('  ');
    const text = standings.length
      ? `🏓 ${meta.title} — results!\n🏆 ${top}\nFull standings: ${url}`
      : `🏓 Join me at ${meta.title}! ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: meta.title, text, url });
      } else {
        await navigator.clipboard.writeText(text);
        setNotice('Results copied to clipboard — paste anywhere to share!');
      }
    } catch { /* user cancelled */ }
  }

  if (error && !meta) return <Box p={3}><Alert severity="error">{error}</Alert></Box>;
  if (!meta) return <Box p={3}><Typography>Loading…</Typography></Box>;

  const isHost = user && (
    user.role === 'ADMIN' ||
    (user.role === 'HOST' && (meta as SessionMeta & { createdById?: string | null }).createdById === user.id)
  );
  const mySignup = participants.find((p) => p.user.id === user?.id);
  const spotsLeft = Math.max(0, meta.capacity - meta._count.signups);
  const price = meta.priceCents > 0 ? `₱${(meta.priceCents / 100).toFixed(0)}` : 'Free';
  const level =
    meta.tierMin != null ? `${meta.tierMin}–${meta.tierMax ?? '∞'}` : 'All Levels';
  const duration = Math.round(
    (new Date(meta.endsAt).getTime() - new Date(meta.startsAt).getTime()) / 3600_000,
  );

  return (
    <>
    <TopNav />
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* ── hero ────────────────────────────────────────────────── */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                  {meta.title}
                </Typography>
                <Chip
                  size="small" label={meta.status}
                  sx={{
                    fontWeight: 800, letterSpacing: '0.04em', height: 24,
                    ...(meta.status === 'LIVE'
                      ? { bgcolor: '#4c9a44', color: '#ffffff' }
                      : meta.status === 'CLOSED'
                        ? { bgcolor: '#e8ebe6', color: '#5a6b56' }
                        : { bgcolor: '#e2f2dc', color: '#2f6b2b' }),
                  }}
                />
                <Chip
                  size="small" label={level}
                  sx={{ bgcolor: '#fdf1d7', color: '#b07f24', fontWeight: 800, height: 24 }}
                />
                {(meta as SessionMeta & { isPrivate?: boolean }).isPrivate && (
                  <Chip
                    size="small" label="🔒 Members only"
                    sx={{ bgcolor: '#eef4e9', color: '#2f5d2b', fontWeight: 700, height: 24 }}
                  />
                )}
              </Stack>
              <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.55)', mt: 0.75 }}>
                {new Date(meta.startsAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                {' · '}
                {new Date(meta.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {' – '}
                {new Date(meta.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                {` · ${duration}h`}
                {meta.location ? ` · 📍 ${meta.location}` : ''}
                {meta.organizer ? ` · hosted by ${meta.organizer}` : ''}
              </Typography>
              <Box sx={{ mt: 1.75, maxWidth: 520 }}>
                <Box sx={{ height: 7, borderRadius: 999, bgcolor: 'rgba(28,42,26,0.10)', overflow: 'hidden' }}>
                  <Box
                    sx={{
                      width: `${Math.min(100, (meta._count.signups / meta.capacity) * 100)}%`,
                      height: '100%', borderRadius: 999,
                      bgcolor: spotsLeft === 0 ? '#e2634a' : '#4c9a44',
                    }}
                  />
                </Box>
                <Typography variant="body2" fontWeight={700} sx={{ mt: 0.75, color: '#1c2a1a' }}>
                  {Math.min(meta._count.signups, meta.capacity)}/{meta.capacity} registered
                  {meta._count.signups > meta.capacity ? ` · +${meta._count.signups - meta.capacity} walk-ins` : ''}
                  {spotsLeft > 0 && meta.status !== 'CLOSED' ? ` · ${spotsLeft} spots left` : ''}
                </Typography>
              </Box>
            </Box>
            <Stack alignItems={{ xs: 'flex-start', md: 'flex-end' }} spacing={1.5} sx={{ flexShrink: 0 }}>
              <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                {price}
                <Typography component="span" variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}> /player</Typography>
              </Typography>
              {meta.status === 'CLOSED' ? (
                <Chip label="Thanks for playing! 🏓" sx={{ bgcolor: '#e2f2dc', color: '#2f6b2b', fontWeight: 700 }} />
              ) : mySignup ? (
                <Button variant="contained" size="large" disabled>
                  {mySignup.status === 'CHECKED_IN' ? 'Checked in ✓'
                    : mySignup.status === 'WAITLISTED' ? 'Waitlisted'
                    : 'Joined ✓'}
                </Button>
              ) : (
                <Button
                  variant="contained" size="large" onClick={join} disabled={spotsLeft === 0 && meta.status === 'LIVE'}
                  sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' } }}
                >
                  {spotsLeft === 0 ? 'Join Waitlist' : 'Join Now'}
                </Button>
              )}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                <Button variant="outlined" startIcon={<ShareIcon />} onClick={shareResults}>
                  Share
                </Button>
                {meta.status === 'LIVE' && (
                  <Button variant="outlined" startIcon={<TvIcon />} href={`/board/${id}`}>
                    Board
                  </Button>
                )}
                {meta.status !== 'CLOSED' && mySignup && (
                  <Button variant="outlined" href={`/play/${id}`}>My view</Button>
                )}
                {isHost && meta.status !== 'CLOSED' && (
                  <Button
                    variant="contained" href={`/host/${id}`}
                    sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' } }}
                  >
                    {meta.status === 'LIVE' ? 'Host' : 'Start'}
                  </Button>
                )}
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* ── tabs ────────────────────────────────────────────────── */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Details" />
        <Tab label={`Participants ${meta._count.signups}`} />
        <Tab label="Leaderboard" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Event Details</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.secondary">
              {meta.description || 'Fair rotation open play: unbiased shuffle, fresh partners every game, equal court time — powered by PicklePlay.'}
            </Typography>
            <Typography variant="caption" sx={{ letterSpacing: '0.1em', fontWeight: 700, color: 'rgba(28,42,26,0.45)', display: 'block', mt: 3, mb: 1 }}>
              COURTS
            </Typography>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {meta.courts.map((c) => (
                <Chip
                  key={c.court.id} size="small" label={`#${c.court.number}`}
                  sx={{ height: 26, fontWeight: 800, bgcolor: '#eef4e9', border: '1px solid #dbe8d3', color: '#2f5d2b' }}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {tab === 1 && (
        <Card>
          <CardContent>
            {!user && (
              <Typography color="text.secondary" variant="body2" mb={1}>
                Log in to see the participant list.
              </Typography>
            )}
            <Grid container spacing={1.25}>
              {participants.map((p) => (
                <Grid key={p.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Stack
                    direction="row" alignItems="center" spacing={1.25}
                    sx={{
                      bgcolor: '#f4f7f2', border: '1px solid #e7efe2', borderRadius: '12px',
                      px: 1.25, py: 1, minWidth: 0, height: '100%', boxSizing: 'border-box',
                    }}
                  >
                    <Avatar
                      src={avatarSrcFor(p.user)} alt={p.user.name}
                      sx={{ width: 34, height: 34, bgcolor: '#d1e7c9', flexShrink: 0 }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '0.88rem', fontWeight: 700 }}>
                        {p.user.name}
                      </Typography>
                      <Stars value={p.user.rating} fontSize="0.62rem" />
                    </Box>
                    {p.status === 'CHECKED_IN' ? (
                      <Chip
                        size="small" label="✓ In"
                        sx={{ bgcolor: '#e2f2dc', color: '#2f6b2b', fontWeight: 800, height: 22 }}
                      />
                    ) : p.status === 'WAITLISTED' ? (
                      <Chip
                        size="small" label="Waitlist"
                        sx={{ bgcolor: '#fdf1d7', color: '#b07f24', fontWeight: 800, height: 22 }}
                      />
                    ) : null}
                  </Stack>
                </Grid>
              ))}
              {user && !participants.length && (
                <Grid size={12}>
                  <Typography color="text.secondary" variant="body2">No sign-ups yet.</Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {tab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6">🏆 Leaderboard</Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              Tap a player to view match history · ranked by wins, win %, then point differential
            </Typography>
            <Leaderboard sessionId={id} standings={standings} />
          </CardContent>
        </Card>
      )}
    </Box>
    </>
  );
}
