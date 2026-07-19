'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';

/** Landing page for the venue QR code: resolves the token, checks the player
 *  in, and forwards them to their live player view. */
export default function CheckinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getUser()) {
      router.push(`/login?next=/checkin/${token}`);
      return;
    }
    (async () => {
      try {
        const s = await api<{ id: string; status: string }>(`/checkin-token/${token}`);
        await api(`/sessions/${s.id}/checkin/self`, { method: 'POST', json: { token } });
        router.push(`/play/${s.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [token, router]);

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', p: 4, textAlign: 'center' }}>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>Checking you in…</Typography>
        </>
      )}
    </Box>
  );
}
