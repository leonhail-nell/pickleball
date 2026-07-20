'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { TopNav } from '@/components/nav';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Rating, Select, Stack, Table,
  TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import Grid from '@mui/material/Grid2';
import { CourtCard, COURT, type CourtPalette } from '@/components/board';
import type { ClubInfo } from '@/lib/useClub';

interface AdminStats {
  totals: {
    sessions: number; players: number; games: number;
    revenueCents: number; pendingCents: number; activeMemberships: number;
  };
  sessions: {
    id: string; title: string; startsAt: string; status: string;
    checkedIn: number; games: number; revenueCents: number;
  }[];
}

interface Plan { id: string; name: string; priceCents: number; period: string }
interface Member { id: string; name: string; email: string; rating: number; role: string; strikes: number }

const peso = (c: number) => `₱${(c / 100).toLocaleString()}`;

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [users, setUsers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [grantUser, setGrantUser] = useState('');
  const [grantPlan, setGrantPlan] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRating, setNewRating] = useState(3);
  const [editMember, setEditMember] = useState<{ id: string; name: string; rating: number } | null>(null);
  const [club, setClub] = useState<ClubInfo | null>(null);
  const [clubName, setClubName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState<CourtPalette>({});
  const [savingTheme, setSavingTheme] = useState(false);

  const loadClub = () =>
    api<ClubInfo>('/club')
      .then((c) => { setClub(c); setClubName(c.name); setTheme(c.theme ?? {}); })
      .catch(() => {});

  /** Venue Pro checkout: redirects to Stripe / PayMongo (GCash, Maya). */
  async function checkout(provider: 'stripe' | 'gcash' | 'maya') {
    try {
      const { url } = await api<{ url: string }>('/club/venue-pro/checkout', {
        method: 'POST',
        json: { provider },
      });
      window.location.href = url;
    } catch (e) { setError((e as Error).message); }
  }

  async function saveTheme() {
    setSavingTheme(true);
    try {
      await api('/club', { method: 'PATCH', json: { theme } });
      setNotice('Court theme saved — every board now uses your colors.');
      void loadClub();
    } catch (e) { setError((e as Error).message); }
    finally { setSavingTheme(false); }
  }

  async function resetTheme() {
    try {
      await api('/club', { method: 'PATCH', json: { theme: null } });
      setTheme({});
      setNotice('Theme reset to the default court.');
      void loadClub();
    } catch (e) { setError((e as Error).message); }
  }

  async function saveClubName() {
    try {
      await api('/club', { method: 'PATCH', json: { name: clubName } });
      setNotice('Club name saved');
      loadClub();
    } catch (e) { setError((e as Error).message); }
  }

  async function startTrial() {
    try {
      await api('/club/venue-pro/trial', { method: 'POST' });
      setNotice('Venue Pro trial started — enjoy 14 days of unlimited courts! 🎉');
      loadClub();
    } catch (e) { setError((e as Error).message); }
  }

  async function addMember() {
    try {
      await api('/users', { method: 'POST', json: { name: newName, email: newEmail, rating: newRating } });
      setNewName(''); setNewEmail(''); setNewRating(3);
      setNotice('Member added (temporary password: welcome123)');
      load();
    } catch (e) { setError((e as Error).message); }
  }

  async function saveMember() {
    if (!editMember) return;
    try {
      await api(`/users/${editMember.id}`, {
        method: 'PATCH',
        json: { name: editMember.name, rating: editMember.rating },
      });
      setEditMember(null);
      load();
    } catch (e) { setError((e as Error).message); }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await api(`/users/${userId}`, { method: 'PATCH', json: { role } });
      load();
    } catch (e) { setError((e as Error).message); }
  }

  const load = useCallback(() => {
    const u = getUser();
    if (u?.role === 'ADMIN') {
      api<AdminStats>('/admin/stats').then(setStats).catch((e) => setError(e.message));
      api<Plan[]>('/plans').then(setPlans).catch(() => {});
      api<Member[]>('/users').then(setUsers).catch(() => {});
    }
    void loadClub();
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u || !['HOST', 'ADMIN'].includes(u.role)) {
      router.push('/login?next=/admin');
      return;
    }
    setIsAdmin(u.role === 'ADMIN');
    load();
    // returning from a payment gateway? verify the order and activate Pro
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get('pro_order');
    if (orderId) {
      window.history.replaceState(null, '', '/admin');
      api(`/club/venue-pro/verify/${orderId}`, { method: 'POST' })
        .then(() => { setNotice('Payment received — Venue Pro is now active! 🎉'); void loadClub(); })
        .catch((e) => setError((e as Error).message));
    } else if (params.get('pro_cancel')) {
      window.history.replaceState(null, '', '/admin');
      setNotice('Checkout cancelled — no charge was made.');
    }
  }, [router, load]);

  async function createPlan() {
    try {
      await api('/plans', {
        method: 'POST',
        json: { name: planName, priceCents: Math.round(Number(planPrice) * 100) },
      });
      setPlanName(''); setPlanPrice('');
      setNotice('Plan created');
      load();
    } catch (e) { setError((e as Error).message); }
  }

  async function grantMembership() {
    try {
      await api('/memberships', { method: 'POST', json: { userId: grantUser, planId: grantPlan } });
      setNotice('Membership granted (payment recorded)');
      load();
    } catch (e) { setError((e as Error).message); }
  }

  // admins wait for stats; organizers only need the club config
  if (isAdmin ? !stats : !club) return <Box p={3}><Typography>Loading…</Typography></Box>;

  const card = (label: string, value: string | number, sub?: string) => (
    <Grid size={{ xs: 6, md: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 1 }}>
            {label.toUpperCase()}
          </Typography>
          <Typography variant="h5" fontWeight={800}>{value}</Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </CardContent>
      </Card>
    </Grid>
  );

  return (
    <>
    <TopNav />
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Typography variant="h4" fontWeight={800} mb={2}>Club dashboard</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

      {isAdmin && stats && (
        <Grid container spacing={2}>
          {card('Sessions', stats.totals.sessions)}
          {card('Players', stats.totals.players)}
          {card('Games', stats.totals.games)}
          {card('Revenue', peso(stats.totals.revenueCents), 'collected')}
          {card('Pending', peso(stats.totals.pendingCents), 'uncollected fees')}
          {card('Members', stats.totals.activeMemberships, 'active')}
        </Grid>
      )}

      {club && (
        <Card
          sx={{
            mt: 2,
            background: club.venuePro
              ? 'linear-gradient(135deg, #22c55e 0%, #15803d 100%)'
              : undefined,
            border: club.venuePro ? 'none' : undefined,
            color: club.venuePro ? '#fff' : undefined,
          }}
        >
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                  <Typography variant="h6" sx={{ color: club.venuePro ? '#fff' : undefined }}>
                    Venue Pro
                  </Typography>
                  {club.venuePro ? (
                    <Chip
                      size="small" label={`Active until ${new Date(club.venueProUntil!).toLocaleDateString()}`}
                      sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700 }}
                    />
                  ) : (
                    <Chip size="small" label="Free plan" variant="outlined" />
                  )}
                </Stack>
                <Typography variant="body2" sx={{ color: club.venuePro ? 'rgba(255,255,255,0.9)' : 'text.secondary' }}>
                  {club.venuePro
                    ? 'Unlimited courts unlocked. Thanks for supporting PicklePlay!'
                    : `Free plan runs up to ${club.freeCourtLimit} courts per session. Start a 14-day trial to unlock more.`}
                </Typography>
              </Box>
              {isAdmin && (
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <TextField
                    size="small" label="Club name" value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    sx={club.venuePro ? { '& .MuiOutlinedInput-root': { bgcolor: 'rgba(255,255,255,0.9)' } } : undefined}
                  />
                  <Button
                    variant={club.venuePro ? 'contained' : 'outlined'} size="small" onClick={saveClubName}
                    sx={club.venuePro ? { bgcolor: '#fff', color: '#15803d', '&:hover': { bgcolor: '#f0fdf4' } } : undefined}
                  >
                    Save
                  </Button>
                </Stack>
              )}
            </Stack>
            {!club.venuePro && (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap mt={2}>
                <Chip label={`₱${((club.proPriceCents ?? 149900) / 100).toLocaleString()}/month`} sx={{ fontWeight: 800 }} />
                <Button variant="contained" onClick={() => checkout('gcash')}>Pay with GCash</Button>
                <Button variant="contained" color="success" onClick={() => checkout('maya')}>Pay with Maya</Button>
                <Button variant="outlined" onClick={() => checkout('stripe')}>Pay with card</Button>
                <Button onClick={startTrial}>or start a 14-day free trial</Button>
              </Stack>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Venue Pro court theme ─────────────────────────────────── */}
      {club && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
              <Typography variant="h6">Court theme</Typography>
              <Chip
                size="small" label="Venue Pro"
                color={club.venuePro ? 'success' : 'default'}
                variant={club.venuePro ? 'filled' : 'outlined'}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {club.venuePro
                ? 'Make the live boards yours — pick your club colors and every court card updates.'
                : 'Custom court colors are a Venue Pro perk. Upgrade above to unlock the editor.'}
            </Typography>
            <Grid container spacing={2.5} alignItems="flex-start">
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={1}>
                  {([
                    ['frame', 'Court frame'],
                    ['slot', 'Player boxes'],
                    ['kitchen', 'Kitchen strips'],
                    ['netA', 'Net (dark stripe)'],
                    ['netB', 'Net (light stripe)'],
                    ['star', 'Skill stars'],
                  ] as [keyof CourtPalette, string][]).map(([key, label]) => (
                    <Stack key={key} direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2">{label}</Typography>
                      <input
                        type="color"
                        disabled={!club.venuePro}
                        value={theme[key] ?? COURT[key]}
                        onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                        style={{
                          width: 46, height: 30, padding: 0, border: '1px solid rgba(17,24,39,0.15)',
                          borderRadius: 8, background: 'transparent',
                          cursor: club.venuePro ? 'pointer' : 'not-allowed',
                        }}
                      />
                    </Stack>
                  ))}
                  <Stack direction="row" spacing={1} mt={1}>
                    <Button variant="contained" size="small" disabled={!club.venuePro || savingTheme} onClick={saveTheme}>
                      Save theme
                    </Button>
                    <Button size="small" disabled={!club.venuePro} onClick={resetTheme}>
                      Reset to default
                    </Button>
                  </Stack>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 8 }}>
                <CourtCard
                  number={1}
                  palette={theme}
                  startedAt={Date.now() - 12 * 60_000}
                  teamA={[{ id: 'p1', name: 'Maria', rating: 4 }, { id: 'p2', name: 'Jake', rating: 3 }]}
                  teamB={[{ id: 'p3', name: 'Lisa', rating: 3.5 }, { id: 'p4', name: 'Ben', rating: 4 }]}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
      <Grid container spacing={2} mt={0.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Membership plans</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={2}>
                {plans.map((p) => (
                  <Chip key={p.id} label={`${p.name} · ${peso(p.priceCents)}/${p.period === 'ANNUAL' ? 'yr' : 'mo'}`} />
                ))}
                {!plans.length && <Typography variant="body2" color="text.secondary">No plans yet.</Typography>}
              </Stack>
              <Stack direction="row" spacing={1}>
                <TextField size="small" label="Plan name" value={planName} onChange={(e) => setPlanName(e.target.value)} />
                <TextField size="small" label="₱/month" sx={{ width: 100 }} value={planPrice} onChange={(e) => setPlanPrice(e.target.value)} />
                <Button variant="contained" disabled={!planName || !planPrice} onClick={createPlan}>Add</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Grant membership</Typography>
              <Stack direction="row" spacing={1}>
                <Select size="small" displayEmpty value={grantUser} onChange={(e) => setGrantUser(e.target.value)} sx={{ minWidth: 180 }}>
                  <MenuItem value="">Player…</MenuItem>
                  {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                </Select>
                <Select size="small" displayEmpty value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)} sx={{ minWidth: 140 }}>
                  <MenuItem value="">Plan…</MenuItem>
                  {plans.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
                </Select>
                <Button variant="contained" disabled={!grantUser || !grantPlan} onClick={grantMembership}>
                  Grant
                </Button>
              </Stack>
              <Typography variant="caption" color="text.secondary" mt={1} display="block">
                Members on drop-in-free plans skip session fees automatically.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      )}

      {isAdmin && (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Members</Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap mb={2}>
            <TextField size="small" label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <TextField size="small" label="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="body2" color="text.secondary">Skill</Typography>
              <Rating precision={0.5} max={5} value={newRating} onChange={(_, v) => setNewRating(v ?? 3)} />
            </Stack>
            <Button variant="contained" disabled={!newName.trim() || !newEmail.trim()} onClick={addMember}>
              Add member
            </Button>
          </Stack>
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5, color: 'text.secondary', letterSpacing: 0.5 }}>
            ORGANIZERS & STAFF
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Member</TableCell>
                <TableCell>Skill</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="right">No-shows</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {users.filter((u) => u.role !== 'PLAYER').map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{u.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Rating readOnly size="small" precision={0.5} max={5} value={u.rating} />
                      <Typography variant="caption">{u.rating.toFixed(2)}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small" value={u.role} sx={{ minWidth: 100 }}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                    >
                      <MenuItem value="PLAYER">Player</MenuItem>
                      <MenuItem value="HOST">Host</MenuItem>
                      <MenuItem value="ADMIN">Admin</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell align="right">{u.strikes}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditMember({ id: u.id, name: u.name, rating: u.rating })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="subtitle2" sx={{ mt: 3, mb: 0.5, color: 'text.secondary', letterSpacing: 0.5 }}>
            PLAYERS
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Member</TableCell>
                <TableCell>Skill</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="right">No-shows</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {users.filter((u) => u.role === 'PLAYER').map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>{u.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Rating readOnly size="small" precision={0.5} max={5} value={u.rating} />
                      <Typography variant="caption">{u.rating.toFixed(2)}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small" value={u.role} sx={{ minWidth: 100 }}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                    >
                      <MenuItem value="PLAYER">Player</MenuItem>
                      <MenuItem value="HOST">Host</MenuItem>
                      <MenuItem value="ADMIN">Admin</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell align="right">{u.strikes}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => setEditMember({ id: u.id, name: u.name, rating: u.rating })}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      <Dialog open={!!editMember} onClose={() => setEditMember(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit member</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Name" fullWidth autoFocus
              value={editMember?.name ?? ''}
              onChange={(e) => setEditMember(editMember && { ...editMember, name: e.target.value })}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">Skill</Typography>
              <Rating
                precision={0.5} max={5} value={editMember?.rating ?? 0}
                onChange={(_, v) => setEditMember(editMember && { ...editMember, rating: v ?? editMember.rating })}
              />
              <Typography fontWeight={700}>{(editMember?.rating ?? 0).toFixed(1)}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditMember(null)}>Cancel</Button>
          <Button variant="contained" disabled={!editMember?.name.trim()} onClick={saveMember}>Save</Button>
        </DialogActions>
      </Dialog>

      {isAdmin && stats && (
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Recent sessions</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Session</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Checked in</TableCell>
                <TableCell align="right">Games</TableCell>
                <TableCell align="right">Revenue</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats.sessions.map((s) => (
                <TableRow key={s.id} hover onClick={() => router.push(`/session/${s.id}`)} sx={{ cursor: 'pointer' }}>
                  <TableCell>{s.title}</TableCell>
                  <TableCell>{new Date(s.startsAt).toLocaleDateString()}</TableCell>
                  <TableCell><Chip size="small" label={s.status} /></TableCell>
                  <TableCell align="right">{s.checkedIn}</TableCell>
                  <TableCell align="right">{s.games}</TableCell>
                  <TableCell align="right">{peso(s.revenueCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}
    </Box>
    </>
  );
}
