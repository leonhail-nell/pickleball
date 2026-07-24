'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, clearAuth } from '@/lib/api';
import { useClub } from '@/lib/useClub';
import {
  Avatar, Box, Button, Container, Divider, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Menu, MenuItem, Stack, Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import BarChartIcon from '@mui/icons-material/BarChart';
import LogoutIcon from '@mui/icons-material/Logout';
import { PaddleLogo } from './logo';
import { avatarSrcFor } from '@/components/board';

function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** A top-nav link (desktop) that highlights when its route is active. */
function NavLink({ href, label }: { href: string; label: string }) {
  const active = useActive()(href);
  return (
    <Button
      component={Link} href={href} size="small" disableRipple
      sx={{
        color: active ? '#2f6b2b' : 'text.primary',
        fontWeight: active ? 800 : 600,
        bgcolor: active ? 'rgba(47,107,43,0.10)' : 'transparent',
        borderRadius: '999px', px: 1.5,
        '&:hover': { bgcolor: active ? 'rgba(47,107,43,0.14)' : 'rgba(47,107,43,0.06)' },
      }}
    >
      {label}
    </Button>
  );
}

/** Shared top navigation — inline links on desktop, a hamburger drawer on mobile. */
export function TopNav() {
  const router = useRouter();
  const isActive = useActive();
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const club = useClub();

  useEffect(() => setUser(getUser()), []);

  const isHost = !!user && ['HOST', 'ADMIN'].includes(user.role);
  const canTournaments = isHost && (user?.role === 'ADMIN' || !!club?.venuePro); // Venue Pro feature
  const links: { href: string; label: string }[] = [
    { href: '/find', label: 'Find a Game' },
    { href: '/clubs', label: 'Clubs' },
    { href: '/sessions', label: 'Open Plays' },
    ...(canTournaments ? [{ href: '/tournaments', label: 'Tournaments' }] : []),
    ...(isHost ? [{ href: '/admin', label: 'Dashboard' }] : []),
  ];
  const roleLabel = user?.role === 'PLAYER' ? 'Player' : user?.role === 'ADMIN' ? 'Admin' : 'Organizer';
  const logout = () => { clearAuth(); router.push('/'); };

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
          <Stack direction="row" spacing={1} alignItems="center" component={Link} href="/" sx={{ color: 'inherit', textDecoration: 'none' }}>
            <PaddleLogo size={26} />
            <Typography variant="h6" fontWeight={800}>
              Pickle<Box component="span" sx={{ color: 'primary.main' }}>Play</Box>
            </Typography>
          </Stack>

          {/* desktop nav */}
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
            {links.map((l) => <NavLink key={l.href} {...l} />)}
            {user ? (
              <>
                <Stack
                  direction="row" spacing={0.75} alignItems="center" onClick={(e) => setMenuAnchor(e.currentTarget)}
                  sx={{ pl: 1, pr: 0.75, py: 0.5, ml: 0.5, borderRadius: '999px', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(47,107,43,0.06)' } }}
                >
                  <Avatar src={avatarSrcFor(user)} alt={user.name} sx={{ width: 28, height: 28, fontSize: '0.8rem', bgcolor: '#d1e7c9' }}>
                    {user.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Typography variant="body2" color="text.secondary">{user.name}</Typography>
                  <KeyboardArrowDownIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </Stack>
                <Menu
                  anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  slotProps={{ paper: { sx: { mt: 1, minWidth: 200, borderRadius: '14px' } } }}
                >
                  <Box sx={{ px: 2, py: 1 }}>
                    <Typography fontWeight={800} noWrap>{user.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{roleLabel}</Typography>
                  </Box>
                  <Divider />
                  <MenuItem component={Link} href="/me" onClick={() => setMenuAnchor(null)}>
                    <ListItemIcon><BarChartIcon fontSize="small" /></ListItemIcon>
                    Profile &amp; stats
                  </MenuItem>
                  <Divider />
                  <MenuItem onClick={() => { setMenuAnchor(null); logout(); }} sx={{ color: '#a04a35' }}>
                    <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: '#a04a35' }} /></ListItemIcon>
                    Log out
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button variant="contained" size="small" component={Link} href="/login">Sign In</Button>
            )}
          </Stack>

          {/* mobile hamburger */}
          <IconButton sx={{ display: { xs: 'inline-flex', md: 'none' } }} onClick={() => setDrawerOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </IconButton>
        </Stack>
      </Container>

      <Drawer
        anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        slotProps={{ paper: { sx: { width: 280, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 } } }}
      >
        {user && (
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 2 }} component={Link} href="/me" onClick={() => setDrawerOpen(false)} style={{ textDecoration: 'none' }}>
            <Avatar src={avatarSrcFor(user)} alt={user.name} sx={{ width: 40, height: 40, bgcolor: '#d1e7c9' }}>
              {user.name?.[0]?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography fontWeight={800} color="text.primary" noWrap>{user.name}</Typography>
              <Typography variant="caption" color="text.secondary">{roleLabel}</Typography>
            </Box>
          </Stack>
        )}
        <Divider />
        <List sx={{ px: 1, py: 1 }}>
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <ListItemButton
                key={l.href} component={Link} href={l.href} onClick={() => setDrawerOpen(false)}
                sx={{ borderRadius: '10px', mb: 0.5, bgcolor: active ? 'rgba(47,107,43,0.10)' : 'transparent' }}
              >
                <ListItemText primaryTypographyProps={{ fontWeight: active ? 800 : 600, color: active ? '#2f6b2b' : 'text.primary' }}>
                  {l.label}
                </ListItemText>
              </ListItemButton>
            );
          })}
          {user && (
            <ListItemButton component={Link} href="/me" onClick={() => setDrawerOpen(false)} sx={{ borderRadius: '10px', mb: 0.5 }}>
              <ListItemIcon sx={{ minWidth: 36 }}><BarChartIcon fontSize="small" /></ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontWeight: 600 }}>Profile &amp; stats</ListItemText>
            </ListItemButton>
          )}
        </List>
        <Divider />
        <Box sx={{ p: 2 }}>
          {user ? (
            <Button fullWidth variant="outlined" startIcon={<LogoutIcon />} onClick={() => { setDrawerOpen(false); logout(); }} sx={{ color: '#a04a35', borderColor: '#e2c7bf' }}>
              Log out
            </Button>
          ) : (
            <Button fullWidth variant="contained" component={Link} href="/login" onClick={() => setDrawerOpen(false)}>Sign In</Button>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}
