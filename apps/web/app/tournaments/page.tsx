'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { TopNav } from '@/components/nav';
import { Pager } from '@/components/pager';
import { usePagination } from '@/lib/usePagination';
import { useClub } from '@/lib/useClub';
import { LabeledField } from '@/components/labeled-field';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import LockIcon from '@mui/icons-material/Lock';
import {
  Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Checkbox, InputAdornment, MenuItem, Select,
  Stack, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SearchIcon from '@mui/icons-material/Search';

type Format = 'SINGLE_ELIM' | 'DOUBLE_ELIM' | 'POOLS_KO';
interface Tournament {
  id: string; name: string; status: 'SETUP' | 'LIVE' | 'DONE'; thirdPlace: boolean;
  format: Format; poolCount: number; doubles: boolean; bestOf: number;
  _count: { players: number };
}

const formatLabel = (f: Format, poolCount: number) =>
  f === 'POOLS_KO' ? `${poolCount} pools → knockout` : f === 'DOUBLE_ELIM' ? 'double elimination' : 'single elimination';

const statusSx = (st: string) =>
  st === 'LIVE' ? { bgcolor: '#4c9a44', color: '#fff' }
    : st === 'DONE' ? { bgcolor: '#e8ebe6', color: '#5a6b56' }
      : { bgcolor: '#e2f2dc', color: '#2f6b2b' };

/** Organizer's tournaments (per club). */
export default function TournamentsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Tournament[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [thirdPlace, setThirdPlace] = useState(true);
  const [format, setFormat] = useState<Format>('SINGLE_ELIM');
  const [poolCount, setPoolCount] = useState(2);
  const [advancePerPool, setAdvancePerPool] = useState(2);
  const [doubles, setDoubles] = useState(false);
  const [bestOf, setBestOf] = useState(1);

  const [role, setRole] = useState<string | null>(null);
  const club = useClub();
  const proAllowed = role === 'ADMIN' || !!club?.venuePro;
  const proBlocked = role !== null && role !== 'ADMIN' && club !== null && !club.venuePro;

  const load = useCallback(() => {
    api<Tournament[]>('/tournaments').then(setRows).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const u = getUser();
    if (!u || !['HOST', 'ADMIN'].includes(u.role)) { router.push('/login?next=/tournaments'); return; }
    setRole(u.role);
  }, [router]);
  useEffect(() => { if (proAllowed) load(); }, [proAllowed, load]);

  async function create() {
    try {
      const t = await api<{ id: string }>('/tournaments', {
        method: 'POST',
        json: { name: name || 'Tournament', thirdPlace, format, poolCount, advancePerPool, doubles, bestOf },
      });
      router.push(`/tournaments/${t.id}`);
    } catch (e) { setError((e as Error).message); }
  }

  // search by name + status filter, applied client-side
  const q = search.trim().toLowerCase();
  const visible = rows.filter((t) => {
    if (q && !t.name.toLowerCase().includes(q)) return false;
    if (filter === 'setup') return t.status === 'SETUP';
    if (filter === 'live') return t.status === 'LIVE';
    if (filter === 'done') return t.status === 'DONE';
    return true;
  });
  const paged = usePagination(visible, 10);

  return (
    <>
      <TopNav />
      <Box sx={{ maxWidth: 1000, mx: 'auto', p: { xs: 2, md: 3 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={2} flexWrap="wrap" gap={1}>
          <Stack direction="row" spacing={1.25} alignItems="baseline">
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Tournaments</Typography>
            <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}>seeded knockout brackets for your club</Typography>
          </Stack>
          {proAllowed && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} sx={{ bgcolor: '#2f6b2b', '&:hover': { bgcolor: '#24551f' } }}>
              New tournament
            </Button>
          )}
        </Stack>

        {proBlocked && (
          <Card sx={{ textAlign: 'center', py: 6, px: 3 }}>
            <CardContent>
              <Box sx={{ width: 64, height: 64, borderRadius: '20px', bgcolor: '#fdf1d7', color: '#b07f24', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
                <EmojiEventsOutlinedIcon sx={{ fontSize: 34 }} />
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" mb={1}>
                <Typography variant="h5" fontWeight={800}>Tournaments</Typography>
                <Chip size="small" icon={<LockIcon sx={{ fontSize: '0.85rem !important' }} />} label="Venue Pro" sx={{ bgcolor: '#fdf1d7', color: '#b07f24', fontWeight: 800, '& .MuiChip-icon': { color: '#b07f24' } }} />
              </Stack>
              <Typography sx={{ color: 'rgba(28,42,26,0.6)', maxWidth: 460, mx: 'auto', mb: 3 }}>
                Run seeded knockout brackets, double elimination, and pool play with live scoring — a Venue Pro feature. Start a free trial to unlock tournaments for your club.
              </Typography>
              <Button variant="contained" href="/admin" sx={{ bgcolor: '#2f6b2b', fontWeight: 800, '&:hover': { bgcolor: '#24551f' } }}>
                Upgrade to Venue Pro
              </Button>
            </CardContent>
          </Card>
        )}

        {!proBlocked && (<>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap mb={2}>
          <TextField
            size="small" placeholder="Search tournaments…" sx={{ flex: 1, minWidth: 220 }}
            value={search} onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'rgba(28,42,26,0.4)' }} />
                </InputAdornment>
              ),
            }}
          />
          <Select size="small" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ minWidth: 160 }}>
            {[['all', 'All'], ['setup', 'Setup'], ['live', 'Live now'], ['done', 'Completed']].map(([k, label]) => (
              <MenuItem key={k} value={k}>{label}</MenuItem>
            ))}
          </Select>
        </Stack>

        {error && <Typography color="error" mb={2}>{error}</Typography>}

        <Stack spacing={2}>
          {paged.slice.map((t) => (
            <Card key={t.id} component="a" href={`/tournaments/${t.id}`} sx={{ display: 'block', textDecoration: 'none', '&:hover': { boxShadow: '0 8px 24px rgba(46,90,40,0.12)' } }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <EmojiEventsIcon sx={{ color: '#e8a531', fontSize: 32 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h6" fontWeight={800} noWrap>{t.name}</Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}>
                      {t._count.players} {t.doubles ? 'team' : 'player'}{t._count.players === 1 ? '' : 's'}
                      {' · '}{formatLabel(t.format, t.poolCount)}
                      {t.doubles ? ' · doubles' : ''}
                      {t.bestOf > 1 ? ` · best of ${t.bestOf}` : ''}
                    </Typography>
                  </Box>
                  <Chip size="small" label={t.status} sx={{ ...statusSx(t.status), fontWeight: 800, height: 24 }} />
                </Stack>
              </CardContent>
            </Card>
          ))}
          {!visible.length && !error && (
            <Card><CardContent sx={{ py: 5, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {rows.length ? 'No tournaments match your search or filter.' : 'No tournaments yet — create your first bracket.'}
              </Typography>
            </CardContent></Card>
          )}
          <Pager page={paged.page} pageCount={paged.pageCount} total={paged.total} perPage={paged.perPage} onChange={paged.setPage} unit="tournaments" />
        </Stack>
        </>)}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>New tournament</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <LabeledField label="Name" autoFocus placeholder="Summer Slam" value={name} onChange={(e) => setName(e.target.value)} />
            <Box>
              <Typography variant="body2" fontWeight={700} mb={0.5}>Format</Typography>
              <TextField
                select fullWidth size="small" value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
              >
                <MenuItem value="SINGLE_ELIM">Single elimination</MenuItem>
                <MenuItem value="DOUBLE_ELIM">Double elimination (with consolation)</MenuItem>
                <MenuItem value="POOLS_KO">Pool play → knockout</MenuItem>
              </TextField>
            </Box>
            <Stack direction="row" spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700} mb={0.5}>Discipline</Typography>
                <TextField select fullWidth size="small" value={doubles ? 'd' : 's'} onChange={(e) => setDoubles(e.target.value === 'd')}>
                  <MenuItem value="s">Singles</MenuItem>
                  <MenuItem value="d">Doubles (teams of 2)</MenuItem>
                </TextField>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={700} mb={0.5}>Bracket match</Typography>
                <TextField select fullWidth size="small" value={bestOf} onChange={(e) => setBestOf(Number(e.target.value))}>
                  <MenuItem value={1}>Single game</MenuItem>
                  <MenuItem value={3}>Best of 3</MenuItem>
                  <MenuItem value={5}>Best of 5</MenuItem>
                </TextField>
              </Box>
            </Stack>
            {format === 'POOLS_KO' && (
              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={700} mb={0.5}>Pools</Typography>
                  <TextField select fullWidth size="small" value={poolCount} onChange={(e) => setPoolCount(Number(e.target.value))}>
                    {[2, 3, 4, 6, 8].map((n) => <MenuItem key={n} value={n}>{n} pools</MenuItem>)}
                  </TextField>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={700} mb={0.5}>Advance</Typography>
                  <TextField select fullWidth size="small" value={advancePerPool} onChange={(e) => setAdvancePerPool(Number(e.target.value))}>
                    {[1, 2, 3, 4].map((n) => <MenuItem key={n} value={n}>Top {n} per pool</MenuItem>)}
                  </TextField>
                </Box>
              </Stack>
            )}
            {format !== 'DOUBLE_ELIM' && (
              <FormControlLabel
                control={<Checkbox checked={thirdPlace} onChange={(e) => setThirdPlace(e.target.checked)} />}
                label="Include a 3rd-place match"
              />
            )}
            <Typography variant="caption" sx={{ color: 'rgba(28,42,26,0.5)' }}>
              {format === 'POOLS_KO'
                ? `${doubles ? 'Teams' : 'Players'} are snake-seeded into ${poolCount} round-robin pools; the top ${advancePerPool} of each advance to a seeded bracket.`
                : format === 'DOUBLE_ELIM'
                  ? `A loss drops ${doubles ? 'a team' : 'a player'} to the consolation bracket; two losses eliminates. ${bestOf > 1 ? `Bracket matches are best of ${bestOf}.` : ''}`
                  : `Add ${doubles ? 'teams' : 'players'} next, then start to generate a seeded knockout bracket.`}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: '#5a6b56', fontWeight: 700 }}>Cancel</Button>
          <Button variant="contained" onClick={create} sx={{ bgcolor: '#2f6b2b', fontWeight: 800, '&:hover': { bgcolor: '#24551f' } }}>Create</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
