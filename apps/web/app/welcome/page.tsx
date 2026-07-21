'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setAuth } from '@/lib/api';
import { PaddleLogo } from '@/components/logo';
import { GoogleButton } from '@/components/google-button';
import {
  Alert, Box, Button, Card, CardContent, Link, Rating, Stack, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Footer } from '@/components/footer';
import { LabeledField } from '@/components/labeled-field';

type Persona = 'organizer' | 'player';

const personas: Record<Persona, {
  icon: string; iconBg: string; title: string; bullets: string[];
}> = {
  organizer: {
    icon: '🏢',
    iconBg: 'rgba(34,197,94,0.14)',
    title: 'I organize open play',
    bullets: [
      'Run sessions from any device',
      'Players follow the live queue from phones',
      'Fair rotation, leaderboards & drop-in fees',
      'Your own QR check-in code',
    ],
  },
  player: {
    icon: '🏓',
    iconBg: 'rgba(59,130,246,0.12)',
    title: 'Just here to play',
    bullets: [
      'Join open plays and check in with a QR scan',
      'See your queue spot, court, and standings live',
      'Track your rating and stats across sessions',
    ],
  },
};

/** PickleQ-style onboarding: pick how you'll use the app, then register. */
export default function WelcomePage() {
  const router = useRouter();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rating, setRating] = useState(3);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<{ token: string; user: object }>('/auth/register', {
        method: 'POST',
        json: {
          name, email, password,
          organizer: persona === 'organizer',
          rating: persona === 'player' ? rating : undefined,
        },
      });
      setAuth(res.token, res.user);
      router.push('/sessions');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', px: 2, pt: { xs: 5, md: 8 }, pb: 6, textAlign: 'center' }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
        <PaddleLogo size={64} />
      </Box>
      <Typography variant="h4" fontWeight={800} gutterBottom>PicklePlay</Typography>

      {!persona ? (
        <>
          <Typography color="text.secondary" sx={{ fontSize: '1.15rem', mb: 4 }}>
            How will you use PicklePlay?
          </Typography>
          <Stack spacing={2.5} textAlign="left">
            {(Object.keys(personas) as Persona[]).map((key) => {
              const p = personas[key];
              return (
                <Card
                  key={key}
                  onClick={() => setPersona(key)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { boxShadow: '0 8px 24px rgba(17,24,39,0.12)', transform: 'translateY(-2px)' },
                  }}
                >
                  <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack direction="row" spacing={2.5} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 56, height: 56, borderRadius: 3, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: p.iconBg, fontSize: '1.7rem',
                        }}
                      >
                        {p.icon}
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight={800} gutterBottom>
                          {p.title}
                        </Typography>
                        <Stack spacing={0.5}>
                          {p.bullets.map((b) => (
                            <Typography key={b} color="text.secondary">{b}</Typography>
                          ))}
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
          <Box mt={3}>
            <GoogleButton onError={setError} />
          </Box>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          <Typography mt={3}>
            <Link href="/login" fontWeight={700} underline="none" sx={{ color: 'secondary.main' }}>
              Already have an account? Log in
            </Link>
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={3}>
            Free for your club. Fair play guaranteed.
          </Typography>
        </>
      ) : (
        <>
          <Typography color="text.secondary" sx={{ fontSize: '1.05rem', mb: 3 }}>
            {personas[persona].icon} {personas[persona].title}
          </Typography>
          <Card sx={{ textAlign: 'left' }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <form onSubmit={submit}>
                <Stack spacing={2}>
                  <LabeledField label="Name" placeholder="e.g., Maria Santos" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                  <LabeledField
                    label="Email" hint={persona === 'organizer' ? 'For login and password reset. Players will not see this.' : undefined}
                    type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required
                  />
                  <LabeledField
                    label="Password" hint="Use at least 8 characters."
                    type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} required
                  />
                  {persona === 'player' && (
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography color="text.secondary">Skill level</Typography>
                      <Rating precision={0.5} max={5} value={rating} onChange={(_, v) => setRating(v ?? 3)} />
                      <Typography variant="body2" color="text.secondary">
                        {rating < 3 ? 'Beginner' : rating < 3.5 ? 'Intermediate' : rating < 4 ? 'Advanced' : 'Expert'}
                      </Typography>
                    </Stack>
                  )}
                  {error && <Alert severity="error">{error}</Alert>}
                  <Button type="submit" variant="contained" size="large" disabled={busy}>
                    {persona === 'organizer' ? 'Create organizer account' : 'Create account'}
                  </Button>
                  <GoogleButton onError={setError} />
                  <Button startIcon={<ArrowBackIcon />} onClick={() => setPersona(null)} sx={{ alignSelf: 'flex-start' }}>
                    Back
                  </Button>
                </Stack>
              </form>
            </CardContent>
          </Card>
        </>
      )}
      <Box mt={6}><Footer /></Box>
    </Box>
  );
}
