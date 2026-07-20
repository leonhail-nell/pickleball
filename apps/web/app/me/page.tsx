'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { TopNav } from '@/components/nav';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Rating, Stack, TextField, Typography,
} from '@mui/material';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import { avatarSrcFor } from '@/components/board';
import { setAuth, getToken } from '@/lib/api';
import Grid from '@mui/material/Grid2';

interface MyStats {
  name: string;
  rating: number;
  strikes: number;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  sessions: number;
  ratingHistory: { at: string | null; rating: number }[];
}

interface MyMembership {
  endsAt: string;
  plan: { name: string; dropInFree: boolean };
}

export default function MePage() {
  const router = useRouter();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [membership, setMembership] = useState<MyMembership | null>(null);
  const [editName, setEditName] = useState('');
  const [editRating, setEditRating] = useState(3);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // downscale the chosen photo to a small square data-URL
  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const size = 160;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const min = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
      setAvatar(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = URL.createObjectURL(file);
  }

  async function saveProfile() {
    setError(''); setNotice('');
    try {
      const updated = await api<{ id: string; name: string; rating: number; avatarUrl: string | null; role: string }>('/me', {
        method: 'PATCH',
        json: { name: editName, rating: editRating, avatar: avatar ?? undefined },
      });
      // keep the nav in sync
      const token = getToken();
      if (token) setAuth(token, { id: updated.id, name: updated.name, role: updated.role, rating: updated.rating, avatarUrl: updated.avatarUrl });
      setNotice('Profile saved');
      api<MyStats>('/me/stats').then(setStats).catch(() => {});
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    if (!getUser()) {
      router.push('/login?next=/me');
      return;
    }
    api<MyStats>('/me/stats').then((st) => {
      setStats(st);
      setEditName(st.name);
      setEditRating(st.rating);
      setAvatar((st as MyStats & { avatarUrl?: string | null }).avatarUrl ?? null);
    }).catch(() => {});
    api<MyMembership | null>('/me/membership').then(setMembership).catch(() => {});
  }, [router]);

  if (!stats) return <Box p={3}><Typography>Loading…</Typography></Box>;

  const statCard = (label: string, value: string | number, sub?: string) => (
    <Grid size={{ xs: 6, sm: 3 }}>
      <Card>
        <CardContent>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1 }}>
            {label.toUpperCase()}
          </Typography>
          <Typography variant="h4" fontWeight={800}>{value}</Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </CardContent>
      </Card>
    </Grid>
  );

  return (
    <>
    <TopNav />
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="h4" fontWeight={800}>Hi {stats.name} 👋</Typography>
        {membership ? (
          <Chip
            color="success"
            label={`${membership.plan.name} member · until ${new Date(membership.endsAt).toLocaleDateString()}`}
          />
        ) : (
          <Chip variant="outlined" label="Drop-in player" />
        )}
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center" mb={3}>
        <Rating readOnly precision={0.5} value={stats.rating} max={5}
          sx={{ '& .MuiRating-iconEmpty': { color: 'rgba(255,255,255,0.25)' } }} />
        <Typography fontWeight={700}>{stats.rating.toFixed(2)}</Typography>
        <Typography variant="caption" color="text.secondary">club rating</Typography>
      </Stack>

      <Grid container spacing={2}>
        {statCard('Games', stats.games, `across ${stats.sessions} sessions`)}
        {statCard('Record', `${stats.wins}-${stats.losses}`)}
        {statCard('Win rate', `${Math.round(stats.winPct * 100)}%`)}
        {statCard('Strikes', stats.strikes, 'no-shows')}
      </Grid>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Rating history</Typography>
          {stats.ratingHistory.length ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {stats.ratingHistory.slice(-20).map((r, i, arr) => {
                const prev = i > 0 ? arr[i - 1].rating : r.rating;
                const up = r.rating >= prev;
                return (
                  <Chip
                    key={i}
                    size="small"
                    label={r.rating.toFixed(2)}
                    color={up ? 'success' : 'error'}
                    variant="outlined"
                  />
                );
              })}
            </Stack>
          ) : (
            <Typography color="text.secondary" variant="body2">
              Play confirmed games to start building rating history.
            </Typography>
          )}
        </CardContent>
      </Card>
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Profile</Typography>
          {notice && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setNotice('')}>{notice}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
          <Stack direction="row" spacing={2.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Stack alignItems="center" spacing={1}>
              <Avatar
                src={avatarSrcFor({ id: getUser()?.id, name: stats.name, avatarUrl: avatar })}
                alt={stats.name}
                sx={{
                  width: 84, height: 84, fontSize: '1.8rem', bgcolor: '#d1e7c9',
                  boxShadow: '0 0 0 3px #ffffff, 0 4px 10px rgba(46,90,40,0.18)',
                }}
              >
                {stats.name?.[0]?.toUpperCase()}
              </Avatar>
              <Button component="label" size="small" startIcon={<PhotoCameraIcon />} variant="outlined">
                Photo
                <input hidden type="file" accept="image/*" onChange={pickPhoto} />
              </Button>
            </Stack>
            <Stack spacing={1.5} sx={{ flex: 1, minWidth: 240 }}>
              <TextField size="small" label="Display name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">Skill</Typography>
                <Rating precision={0.5} max={5} value={editRating} onChange={(_, v) => setEditRating(v ?? editRating)} />
                <Typography variant="caption" color="text.secondary">{editRating.toFixed(1)}</Typography>
              </Stack>
              <Button variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={!editName.trim()} onClick={saveProfile}>
                Save profile
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
    </>
  );
}
