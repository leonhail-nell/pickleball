'use client';

import { useEffect, useState } from 'react';
import { api, getUser } from '@/lib/api';
import { PaddleLogo } from '@/components/logo';
import { CourtCard, UpNextCard } from '@/components/board';
import {
  Box, Button, Card, CardContent, Chip, Container, Divider, Stack, Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid2';
import PauseIcon from '@mui/icons-material/Pause';
import { Footer } from '@/components/footer';

const steps = [
  {
    n: '1',
    title: 'Create a session',
    body: 'Set your courts, level, and price — then open the doors. Players see it live.',
  },
  {
    n: '2',
    title: 'Players check in',
    body: 'A quick QR scan drops each player into the waiting queue, no clipboard needed.',
  },
  {
    n: '3',
    title: 'Auto-rotation & boards',
    body: 'Fair court assignments, live standings, and leaderboards update on every phone.',
  },
];

const roadmap = [
  'Community', 'Courts & booking', 'Tournaments', 'Programs & clinics', 'Find a Game', 'Club pages',
];

export default function Landing() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [stats, setStats] = useState<{ sessions: number; players: number; games: number } | null>(null);

  useEffect(() => {
    setLoggedIn(!!getUser());
    api<{ sessions: number; players: number; games: number }>('/stats').then(setStats).catch(() => {});
  }, []);

  const stat = (value: number, label: string) => (
    <Box textAlign="center">
      <Typography variant="h4" fontWeight={800} sx={{ color: 'secondary.main' }}>
        {value.toLocaleString()}
      </Typography>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Box>
  );

  return (
    <Box>
      {/* ── nav (sticky) ────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'sticky', top: 0, zIndex: (t) => t.zIndex.appBar,
          bgcolor: 'rgba(240,253,244,0.85)', backdropFilter: 'blur(10px)',
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" py={1.5}>
            <Stack direction="row" spacing={1} alignItems="center" component="a" href="/" sx={{ textDecoration: 'none', color: 'inherit' }}>
              <PaddleLogo size={28} />
              <Typography variant="h5" fontWeight={800}>
                Pickle<Box component="span" sx={{ color: 'secondary.main' }}>Play</Box>
              </Typography>
            </Stack>
            <Button variant="contained" href={loggedIn ? '/sessions' : '/welcome'}>
              {loggedIn ? 'Open the app' : 'Try It Free'}
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ── hero ────────────────────────────────────────────────── */}
      <Container maxWidth="md" sx={{ textAlign: 'center', pt: { xs: 6, md: 9 }, pb: 6 }}>
        <Chip
          label="For clubs, rec centers, and open play organizers"
          sx={{ bgcolor: 'rgba(34,197,94,0.12)', color: 'secondary.main', fontWeight: 600, mb: 3 }}
        />
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: '2.5rem', md: '4rem' }, lineHeight: 1.08 }}
        >
          Run open play
          <Box component="span" sx={{ display: 'block', color: 'secondary.main' }}>
            fairly, every time
          </Box>
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ mt: 3, fontSize: '1.2rem', maxWidth: 620, mx: 'auto' }}
        >
          Live queue, QR check-in, unbiased court rotation, and leaderboards —
          players follow everything from their phones.
        </Typography>
        <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} justifyContent="center" mt={4} flexWrap="wrap" useFlexGap>
          <Button variant="contained" size="large" href={loggedIn ? '/sessions' : '/welcome'} sx={{ px: { xs: 3, sm: 4 }, py: 1.5, fontSize: '1.05rem' }}>
            {loggedIn ? 'Start a Session' : 'Get Started Free'}
          </Button>
          <Button variant="outlined" size="large" href={loggedIn ? '/sessions' : '/login'} sx={{ px: { xs: 3, sm: 4 }, py: 1.5, fontSize: '1.05rem' }}>
            {loggedIn ? 'My sessions' : 'Log in'}
          </Button>
        </Stack>
        <Stack direction="row" spacing={3} justifyContent="center" mt={3} flexWrap="wrap" useFlexGap>
          {['No repeat partners', 'QR check-in', 'Live boards & standings'].map((t) => (
            <Typography key={t} variant="body2" color="text.secondary">{t}</Typography>
          ))}
        </Stack>

        {stats && (stats.games > 0 || stats.sessions > 0) && (
          <Stack direction="row" spacing={{ xs: 3, sm: 6 }} justifyContent="center" mt={6} flexWrap="wrap" useFlexGap>
            {stat(stats.sessions, 'Sessions run')}
            {stat(stats.games, 'Games played')}
            {stat(stats.players, 'Players')}
          </Stack>
        )}
      </Container>

      {/* ── how it works (white band, light-green step cards) ───── */}
      <Box sx={{ bgcolor: '#ffffff', py: { xs: 6, md: 9 } }}>
        <Container maxWidth="lg">
          <Typography variant="h3" align="center" sx={{ fontSize: { xs: '1.8rem', md: '2.3rem' } }}>
            How it works
          </Typography>
          <Typography align="center" color="text.secondary" mb={5} mt={1}>
            Get on the court in three simple steps
          </Typography>
          <Grid container spacing={3}>
            {steps.map((s) => (
              <Grid key={s.n} size={{ xs: 12, md: 4 }}>
                <Box
                  sx={{
                    height: '100%', boxSizing: 'border-box',
                    bgcolor: '#f4f9f1', border: '1px solid #e2efdb', borderRadius: '18px',
                    p: { xs: 2.5, md: 3.5 },
                    transition: 'box-shadow 160ms ease, transform 160ms ease',
                    '&:hover': { boxShadow: '0 8px 24px rgba(46,90,40,0.10)', transform: 'translateY(-2px)' },
                  }}
                >
                  <Box
                    sx={{
                      width: 48, height: 48, borderRadius: '14px', mb: 2,
                      bgcolor: '#cdeabf', color: '#2f6b2b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.35rem', fontWeight: 900,
                    }}
                  >
                    {s.n}
                  </Box>
                  <Typography variant="h6" fontWeight={800} gutterBottom>{s.title}</Typography>
                  <Typography color="text.secondary">{s.body}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── built for ───────────────────────────────────────────── */}
      <Container maxWidth="md" sx={{ textAlign: 'center', pb: 8 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', md: '1.9rem' }, mb: 3 }}>
          Built for
        </Typography>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
          {['🏟️ Clubs', '🏫 Rec centers', '🏘️ Barangay courts', '👯 Friend groups', '🏢 Corporate leagues'].map((t) => (
            <Chip key={t} label={t} sx={{ fontSize: '0.95rem', py: 2.2, px: 0.5, bgcolor: '#ffffff', border: '1px solid rgba(17,24,39,0.10)' }} />
          ))}
        </Stack>
      </Container>

      {/* ── what organizers see (app preview) ───────────────────── */}
      <Container maxWidth="lg" sx={{ pb: 10 }}>
        <Typography variant="h3" align="center" sx={{ fontSize: { xs: '1.8rem', md: '2.3rem' } }}>
          What organizers see
        </Typography>
        <Typography align="center" color="text.secondary" mb={4} mt={1}>
          One screen to run the session — one public board for players who want live updates.
        </Typography>
        <Card sx={{ maxWidth: 860, mx: 'auto', overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.5, borderBottom: '1px solid #eef3ea' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
              <Typography fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Friday Night Open Play</Typography>
              <Stack direction="row" spacing={0.75}>
                {[['Games', '12'], ['Courts', '2/2'], ['Queue', '4']].map(([k, v]) => (
                  <Chip
                    key={k} size="small" label={`${k} ${v}`}
                    sx={{ bgcolor: '#e2f2dc', color: '#2f6b2b', fontWeight: 700, height: 22 }}
                  />
                ))}
              </Stack>
            </Stack>
          </Box>
          <Box sx={{ p: 2.5 }}>
            <Grid container spacing={2}>
              {[
                { court: 1, mins: 5, a: [{ id: 'm1', name: 'Greg', rating: 3.9 }, { id: 'm2', name: 'Ivan', rating: 2.8 }], b: [{ id: 'm3', name: 'Jeff', rating: 3.3 }, { id: 'm4', name: 'Geoff', rating: 2.6 }] },
                { court: 2, mins: 6, a: [{ id: 'm5', name: 'Ena', rating: 4.1 }, { id: 'm6', name: 'Chelle', rating: 2.9 }], b: [{ id: 'm7', name: 'Steve', rating: 3.4 }, { id: 'm8', name: 'Kurt', rating: 3.2 }] },
              ].map((m) => (
                <Grid key={m.court} size={{ xs: 12, sm: 6 }}>
                  <CourtCard
                    size="sm"
                    number={m.court}
                    startedAt={Date.now() - m.mins * 60_000}
                    teamA={m.a}
                    teamB={m.b}
                    footer={(
                      <Stack direction="row" spacing={1}>
                        <Button fullWidth size="small" sx={{ bgcolor: '#2f6b2b', color: '#fff', fontWeight: 700, pointerEvents: 'none' }}>Team 1 Wins</Button>
                        <Button fullWidth size="small" sx={{ bgcolor: '#d1913c', color: '#fff', fontWeight: 700, pointerEvents: 'none' }}>Team 2 Wins</Button>
                      </Stack>
                    )}
                  />
                </Grid>
              ))}
            </Grid>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="flex-end" mt={2}>
              <Box sx={{ width: { xs: '100%', md: 400 } }}>
                <UpNextCard
                  title="Up next · Court 1" chipLabel="Waiting" rightLabel="Auto-matched"
                  players={[
                    { id: 'q1', name: 'Ava', rating: 3.5 },
                    { id: 'q2', name: 'Dinah', rating: 3 },
                    { id: 'q3', name: 'Joseph', rating: 4 },
                    { id: 'q4', name: 'Andreo', rating: 3 },
                  ]}
                  footer="Starts when a court frees up"
                />
              </Box>
              <Box sx={{ width: { xs: '100%', md: 400 } }}>
                <UpNextCard
                  title="Up next · Court 2" chipLabel="Waiting" rightLabel="Auto-matched"
                  players={[
                    { id: 'q5', name: 'Mia', rating: 3.8 },
                    { id: 'q6', name: 'Leo', rating: 3.1 },
                    { id: 'q7', name: 'Priya', rating: 4.2 },
                    { id: 'q8', name: 'Sam', rating: 2.9 },
                  ]}
                  footer="Starts when a court frees up"
                />
              </Box>
            </Stack>
          </Box>
        </Card>
      </Container>

      {/* ── what players see (phone) ────────────────────────────── */}
      <Container maxWidth="lg" sx={{ pb: 10 }}>
        <Typography variant="h3" align="center" sx={{ fontSize: { xs: '1.8rem', md: '2.3rem' } }}>
          What players see
        </Typography>
        <Typography align="center" color="text.secondary" mb={5} mt={1} sx={{ maxWidth: 560, mx: 'auto' }}>
          Players follow the whole session from their phone — a live queue, a heads-up when they&apos;re on next, and their record for the night. No app to install.
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: 330, maxWidth: '100%', bgcolor: '#1c2a1a', borderRadius: '44px', p: 1.3, boxShadow: '0 26px 60px rgba(28,42,26,0.28)' }}>
            <Box sx={{ position: 'relative', bgcolor: '#f0fdf4', borderRadius: '36px', overflow: 'hidden', minHeight: 560 }}>
              <Box sx={{ position: 'absolute', top: 9, left: '50%', transform: 'translateX(-50%)', width: 118, height: 22, bgcolor: '#1c2a1a', borderRadius: '999px', zIndex: 1 }} />
              <Box sx={{ p: 2, pt: 4.5 }}>
                <Typography variant="h6" fontWeight={900} sx={{ mb: 1.5 }}>Hi Ava 👋</Typography>

                <Box sx={{ bgcolor: '#fff', border: '1px solid #e7efe2', borderRadius: '16px', p: 1.75, mb: 1.5 }}>
                  <Typography fontWeight={800}>You&apos;re <Box component="span" sx={{ color: '#2f6b2b' }}>#2</Box> in the queue</Typography>
                  <Box sx={{ height: 8, borderRadius: 999, bgcolor: 'rgba(28,42,26,0.10)', overflow: 'hidden', my: 1.25 }}>
                    <Box sx={{ width: '80%', height: '100%', bgcolor: '#4c9a44', borderRadius: 999 }} />
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Chip size="small" label="3 games" sx={{ bgcolor: '#eef4e9', color: '#2f5d2b', fontWeight: 700 }} />
                    <Chip size="small" label="paired 8/21" sx={{ bgcolor: '#eef4e9', color: '#2f5d2b', fontWeight: 700 }} />
                  </Stack>
                </Box>

                <Button
                  fullWidth variant="outlined" startIcon={<PauseIcon />}
                  sx={{ mb: 2.5, fontWeight: 800, color: '#1c2a1a', borderColor: '#dbe4d6', justifyContent: 'flex-start', pointerEvents: 'none' }}
                >
                  Step out (pause)
                </Button>

                <Stack direction="row" spacing={1} alignItems="baseline" mb={1}>
                  <Typography fontWeight={900}>Courts</Typography>
                  <Typography variant="caption" color="text.secondary">live from the venue</Typography>
                </Stack>
                <CourtCard
                  size="sm" number={1} startedAt={Date.now() - 128_000}
                  teamA={[{ id: 'm1', name: 'Greg', rating: 3.9 }, { id: 'm2', name: 'Ivan', rating: 2.8 }]}
                  teamB={[{ id: 'm3', name: 'Jeff', rating: 3.3 }, { id: 'm4', name: 'Geoff', rating: 2.6 }]}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* ── venue pro ───────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ pb: 10 }}>
        <Card
          sx={{
            background: 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)',
            border: 'none', color: '#ffffff', p: { xs: 1, md: 2 },
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Chip label="Venue Pro" sx={{ bgcolor: 'rgba(255,255,255,0.22)', color: '#fff', fontWeight: 700, mb: 2 }} />
            <Typography variant="h4" sx={{ color: '#fff', fontSize: { xs: '1.6rem', md: '2rem' } }}>
              For clubs running bigger open play
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.9)', mt: 1.5, maxWidth: 720 }}>
              PicklePlay is free for up to 4 courts. Venue Pro is for clubs that need more courts,
              plus priority support as new features land.
            </Typography>
            <Grid container spacing={1} mt={2} sx={{ maxWidth: 760 }}>
              {['Run 6+ active courts', 'QR check-in & kiosk board', 'Score tracking & leaderboards', 'Ratings & fair-play audit log'].map((f) => (
                <Grid key={f} size={{ xs: 12, sm: 6 }}>
                  <Typography sx={{ color: '#fff' }}>✓ {f}</Typography>
                </Grid>
              ))}
            </Grid>
            <Typography sx={{ color: 'rgba(255,255,255,0.85)', mt: 2.5 }}>
              New clubs can start a 14-day free trial from the club dashboard.
            </Typography>
            <Button
              href="/admin" size="large"
              sx={{ mt: 2.5, bgcolor: '#ffffff', color: '#15803d', fontWeight: 800, px: 4, '&:hover': { bgcolor: '#f0fdf4' } }}
            >
              Get Venue Pro
            </Button>
          </CardContent>
        </Card>
      </Container>

      {/* ── coming soon ─────────────────────────────────────────── */}
      <Container maxWidth="md" sx={{ textAlign: 'center', pb: 10 }}>
        <Typography variant="h4" sx={{ fontSize: { xs: '1.5rem', md: '1.9rem' } }}>
          Growing with your club
        </Typography>
        <Typography color="text.secondary" mt={1} mb={3}>
          On the roadmap — coming in future phases:
        </Typography>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
          {roadmap.map((r) => (
            <Chip key={r} label={r} variant="outlined" sx={{ fontSize: '0.95rem', py: 2.2, px: 0.5 }} />
          ))}
        </Stack>
      </Container>

      <Footer />
    </Box>
  );
}
