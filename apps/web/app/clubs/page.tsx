'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TopNav } from '@/components/nav';
import { Footer } from '@/components/footer';
import { Pager } from '@/components/pager';
import { usePagination } from '@/lib/usePagination';
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Grid2';

interface ClubRow { id: string; name: string; live: number; upcoming: number }

/** Public club directory. */
export default function ClubsPage() {
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  useEffect(() => { api<ClubRow[]>('/clubs').then(setClubs).catch(() => {}); }, []);
  const paged = usePagination(clubs, 12);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopNav />
      <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 3 }, width: '100%', flex: 1 }}>
        <Stack direction="row" spacing={1.25} alignItems="baseline" mb={2}>
          <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Clubs</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(28,42,26,0.5)' }}>pickleball clubs running open play on PicklePlay</Typography>
        </Stack>

        <Grid container spacing={2}>
          {paged.slice.map((c) => (
            <Grid key={c.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                component="a" href={`/clubs/${c.id}`}
                sx={{
                  display: 'block', height: '100%', textDecoration: 'none',
                  transition: 'box-shadow 160ms ease, transform 160ms ease',
                  '&:hover': { boxShadow: '0 8px 24px rgba(46,90,40,0.12)', transform: 'translateY(-2px)' },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      width: 52, height: 52, borderRadius: '16px', mb: 1.5,
                      bgcolor: '#cdeabf', color: '#2f6b2b',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
                    }}
                  >
                    🏓
                  </Box>
                  <Typography variant="h6" fontWeight={800} noWrap>{c.name}</Typography>
                  <Stack direction="row" spacing={1} mt={1.5} flexWrap="wrap" useFlexGap>
                    {c.live > 0 && (
                      <Chip size="small" label={`${c.live} live now`} sx={{ bgcolor: '#4c9a44', color: '#fff', fontWeight: 800 }} />
                    )}
                    <Chip size="small" label={`${c.upcoming} upcoming`} sx={{ bgcolor: '#eef4e9', color: '#2f5d2b', fontWeight: 700 }} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {!clubs.length && (
            <Grid size={12}>
              <Typography color="text.secondary">No clubs yet.</Typography>
            </Grid>
          )}
        </Grid>
        <Pager page={paged.page} pageCount={paged.pageCount} total={paged.total} perPage={paged.perPage} onChange={paged.setPage} unit="clubs" />
      </Box>
      <Footer />
    </Box>
  );
}
