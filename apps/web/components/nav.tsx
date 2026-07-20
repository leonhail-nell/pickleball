'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, clearAuth } from '@/lib/api';
import { Avatar, Box, Button, Container, Stack, Typography } from '@mui/material';
import { PaddleLogo } from './logo';
import { avatarSrcFor } from './board';

/** Shared top navigation — used on every page except the TV board. */
export function TopNav() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);

  useEffect(() => setUser(getUser()), []);

  return (
    <Box
      sx={{
        position: 'sticky', top: 0, zIndex: (t) => t.zIndex.appBar,
        borderBottom: '1px solid', borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(10px)',
      }}
    >
      <Container maxWidth="xl">
        <Stack direction="row" justifyContent="space-between" alignItems="center" py={1.25}>
          <Stack
            direction="row" spacing={1} alignItems="center" component="a" href="/"
            sx={{ color: 'inherit', textDecoration: 'none' }}
          >
            <PaddleLogo size={26} />
            <Typography variant="h6" fontWeight={800}>
              Pickle<Box component="span" sx={{ color: 'primary.main' }}>Play</Box>
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button color="inherit" size="small" href="/sessions">Open Plays</Button>
            {user && <Button color="inherit" size="small" href="/me">My stats</Button>}
            {user && ['HOST', 'ADMIN'].includes(user.role) && (
              <Button color="inherit" size="small" href="/admin">Dashboard</Button>
            )}
            {user ? (
              <>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ px: 1 }} component="a" href="/me" style={{ textDecoration: 'none' }}>
                  <Avatar src={avatarSrcFor(user)} alt={user.name} sx={{ width: 28, height: 28, fontSize: '0.8rem', bgcolor: '#d1e7c9' }}>
                    {user.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" color="text.secondary">{user.name}</Typography>
                </Stack>
                <Button
                  variant="outlined" size="small"
                  onClick={() => { clearAuth(); router.push('/'); }}
                >
                  Log out
                </Button>
              </>
            ) : (
              <Button variant="contained" size="small" href="/login">Sign In</Button>
            )}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
