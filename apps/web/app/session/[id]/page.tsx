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

interface Participant {
  id: string;
  status: string;
  user: { id: string; name: string; rating: number };
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
        <CardContent sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary">Open Play</Typography>
              <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.15 }}>
                {meta.title}
              </Typography>
              {meta.organizer && (
                <Typography color="text.secondary" mt={0.5}>by {meta.organizer}</Typography>
              )}
              <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={level} color="warning" />
                <Chip
                  size="small" icon={<CalendarMonthIcon />}
                  label={new Date(meta.startsAt).toLocaleDateString(undefined, {
                    weekday: 'short', month: 'short', day: 'numeric',
                  })}
                />
                <Chip
                  size="small" icon={<AccessTimeIcon />}
                  label={`${new Date(meta.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} – ${new Date(meta.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ${duration}h`}
                />
                <Chip
                  size="small" icon={<GroupsIcon />}
                  label={spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}
                  color={spotsLeft > 0 ? 'default' : 'error'}
                />
              </Stack>
              <Box mt={2} sx={{ maxWidth: 380 }}>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, (meta._count.signups / meta.capacity) * 100)}
                  color={spotsLeft === 0 ? 'error' : 'success'}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {Math.min(meta._count.signups, meta.capacity)}/{meta.capacity} registered
                  {meta._count.signups > meta.capacity ? ` · +${meta._count.signups - meta.capacity} walk-ins` : ''}
                </Typography>
              </Box>
            </Box>
            <Stack alignItems="flex-end" spacing={1.5}>
              <Typography variant="h4" fontWeight={800}>
                {price}
                <Typography component="span" color="text.secondary" variant="body2"> / player</Typography>
              </Typography>
              {meta.status === 'CLOSED' ? (
                <Chip label="Thanks for playing! 🏓" />
              ) : mySignup ? (
                <Button variant="contained" size="large" disabled>
                  {mySignup.status === 'CHECKED_IN' ? 'Checked in ✓'
                    : mySignup.status === 'WAITLISTED' ? 'Waitlisted'
                    : 'Joined ✓'}
                </Button>
              ) : (
                <Button variant="contained" size="large" onClick={join} disabled={spotsLeft === 0}>
                  {spotsLeft === 0 ? 'Join Waitlist' : 'Join Now'}
                </Button>
              )}
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" startIcon={<ShareIcon />} onClick={shareResults}>
                  Share
                </Button>
                {meta.status === 'LIVE' && (
                  <Button size="small" variant="outlined" startIcon={<TvIcon />} href={`/board/${id}`}>
                    Live board
                  </Button>
                )}
                {meta.status !== 'CLOSED' && mySignup && (
                  <Button size="small" variant="outlined" href={`/play/${id}`}>My view</Button>
                )}
                {isHost && meta.status !== 'CLOSED' && (
                  <Button size="small" variant="contained" href={`/host/${id}`}>
                    {meta.status === 'LIVE' ? 'Host console' : 'Start session'}
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
        <Tab label={`Participants ${meta._count.signups}/${meta.capacity}`} />
        <Tab label="Leaderboard" />
      </Tabs>

      {tab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Event Details</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap' }} color="text.secondary">
              {meta.description || 'Fair rotation open play: unbiased shuffle, fresh partners every game, equal court time — powered by PicklePlay.'}
            </Typography>
            <Typography variant="subtitle2" mt={3} mb={1}>Courts</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {meta.courts.map((c) => (
                <Chip key={c.court.id} label={`#${c.court.number}`} variant="outlined" />
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
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {participants.map((p) => (
                <Chip
                  key={p.id}
                  label={`${p.user.name}${p.status === 'CHECKED_IN' ? ' ✓' : p.status === 'WAITLISTED' ? ' (waitlist)' : ''}`}
                  variant={p.status === 'CHECKED_IN' ? 'filled' : 'outlined'}
                  color={p.status === 'CHECKED_IN' ? 'success' : 'default'}
                />
              ))}
              {user && !participants.length && (
                <Typography color="text.secondary" variant="body2">No sign-ups yet.</Typography>
              )}
            </Stack>
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
