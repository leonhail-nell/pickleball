'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { api, getUser, type SessionMeta, type Standing } from '@/lib/api';
import { TopNav } from '@/components/nav';
import { SessionHero } from '@/components/session/SessionHero';
import {
  DetailsTab,
  LeaderboardTab,
  ParticipantsTab,
} from '@/components/session/SessionTabs';
import type { Participant } from '@/types/session';
import { PAGE_BG } from '@/constant/court';
import { Alert, Box, Tab, Tabs, Typography } from '@mui/material';

/** Public event page — hero + Details / Participants / Leaderboard tabs. */
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

  return (
    <>
      <TopNav />
      <Box sx={{ bgcolor: PAGE_BG, minHeight: '100vh' }}>
        <Box sx={{ maxWidth: 1000, mx: 'auto', p: { xs: 2, md: 3 } }}>
          <SessionHero
            meta={meta}
            id={id}
            isHost={!!isHost}
            mySignup={mySignup}
            onJoin={join}
            onShare={shareResults}
          />

          {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              mb: 2.5,
              minHeight: 44,
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '1rem',
                color: 'rgba(28,42,26,0.4)',
                minHeight: 44,
                px: 1.5,
                mr: 1,
              },
              '& .Mui-selected': { color: '#2f6b2b !important' },
              '& .MuiTabs-indicator': {
                bgcolor: '#4c9a44',
                height: 3,
                borderRadius: 2,
              },
            }}
          >
            <Tab label="Details" />
            <Tab label={`Participants ${meta._count.signups}`} />
            <Tab label="Leaderboard" />
          </Tabs>

          {tab === 0 && <DetailsTab meta={meta} />}
          {tab === 1 && <ParticipantsTab participants={participants} loggedIn={!!user} />}
          {tab === 2 && <LeaderboardTab sessionId={id} standings={standings} />}
        </Box>
      </Box>
    </>
  );
}
