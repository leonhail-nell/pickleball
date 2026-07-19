'use client';

import { useEffect, useState } from 'react';
import { Avatar, Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import type { NamedPlayer } from '@/lib/api';

export const TEAM_BLUE = '#3b82f6';
export const TEAM_ORANGE = '#f59e0b';

// court palette (Court View design) — Venue Pro clubs can override via club theme
export const COURT = {
  frame: '#a3cd94',
  slot: '#dcefd4',
  kitchen: '#cde6c2',
  netA: '#2f5d2b',
  netB: '#40763a',
  netEdge: '#24481f',
  pillBg: '#f2f8ef',
  pillBorder: '#dcead5',
  pillText: '#2f5d2b',
  dot: '#4c9a44',
  chipBg: '#e2f2dc',
  chipText: '#2f6b2b',
  star: '#e8a531',
  ink: '#1c2a1a',
  inkFaint: 'rgba(28,42,26,0.45)',
};

/** Venue Pro custom-theme override (court colors). */
export type CourtPalette = Partial<Record<'frame' | 'slot' | 'kitchen' | 'netA' | 'netB' | 'netEdge' | 'star' | 'chipBg' | 'chipText', string>>;

/** DUPR-ish rating → friendly level label. */
export function skillLabel(rating: number): string {
  if (rating < 3.0) return 'Beginner';
  if (rating < 3.5) return 'Intermediate';
  if (rating < 4.0) return 'Advanced';
  return 'Expert';
}

/** Amber text stars, ★★★★☆ style (rounded to whole stars). */
export function Stars({ value, fontSize = '0.8rem', color }: { value: number; fontSize?: string; color?: string }) {
  const k = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <Typography component="span" sx={{ color: color ?? COURT.star, fontSize, letterSpacing: '2px', lineHeight: 1 }}>
      {'★'.repeat(k)}
      {'☆'.repeat(5 - k)}
    </Typography>
  );
}

/** Circular player photo with a white ring; falls back to the initial. */
export function PlayerAvatar({
  player, size = 56,
}: {
  player: { name: string; avatarUrl?: string | null };
  size?: number;
}) {
  return (
    <Avatar
      src={player.avatarUrl ?? undefined}
      sx={{
        width: size, height: size,
        fontSize: size * 0.4, fontWeight: 700,
        bgcolor: '#4c9a44', color: '#fff',
        boxShadow: '0 0 0 3px #ffffff, 0 4px 10px rgba(46,90,40,0.18)',
      }}
    >
      {player.name?.[0]?.toUpperCase()}
    </Avatar>
  );
}

/** Pulsing-dot elapsed-time pill (Court View style). */
export function TimerPill({ startedAt }: { startedAt: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!startedAt) return null;
  const total = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = `${total % 60}`.padStart(2, '0');
  const label = hh > 0 ? `${hh}:${`${mm}`.padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
  return (
    <Stack
      direction="row" spacing={0.9} alignItems="center" flexShrink={0}
      sx={{
        bgcolor: COURT.pillBg, border: `1px solid ${COURT.pillBorder}`,
        borderRadius: 999, px: 1.5, py: 0.5,
        '@keyframes livepulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.35 } },
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: COURT.dot, animation: 'livepulse 1.6s ease-in-out infinite' }} />
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: COURT.pillText, fontVariantNumeric: 'tabular-nums' }}>
        {label}
      </Typography>
    </Stack>
  );
}

/** One player quadrant on the court. */
function CourtSlot({
  label, player, onClick, onEmptyClick, size, C,
}: {
  label: string;
  player?: NamedPlayer;
  onClick?: (p: NamedPlayer) => void;
  onEmptyClick?: () => void;
  size: 'sm' | 'md';
  C: typeof COURT;
}) {
  const avatar = size === 'sm' ? 44 : 56;
  return (
    <Box
      sx={{
        bgcolor: C.slot, px: 1, py: size === 'sm' ? 1.25 : 1.75,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 0.75, minWidth: 0,
      }}
    >
      <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: COURT.inkFaint }}>
        {label}
      </Typography>
      {player ? (
        <>
          <PlayerAvatar player={player} size={avatar} />
          <Box
            onClick={onClick ? () => onClick(player) : undefined}
            sx={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25,
              borderRadius: '10px', px: 1, py: 0.4, maxWidth: '100%',
              ...(onClick && {
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(62,125,58,0.12)' },
              }),
            }}
          >
            <Stack direction="row" spacing={0.6} alignItems="center" sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: size === 'sm' ? '0.85rem' : '0.95rem', fontWeight: 700, color: COURT.ink }}>
                {player.name}
              </Typography>
              {onClick && <Typography sx={{ fontSize: '0.7rem', color: 'rgba(28,42,26,0.4)' }}>⇄</Typography>}
            </Stack>
            <Stars value={player.rating} fontSize={size === 'sm' ? '0.7rem' : '0.8rem'} color={C.star} />
          </Box>
        </>
      ) : (
        <Box
          onClick={onEmptyClick}
          sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75,
            borderRadius: '12px', px: 1.5, py: 0.5,
            ...(onEmptyClick && {
              cursor: 'pointer',
              '&:hover': { bgcolor: 'rgba(62,125,58,0.12)' },
            }),
          }}
        >
          <Box
            sx={{
              width: avatar, height: avatar, borderRadius: '50%',
              border: '2px dashed #6fa761', bgcolor: 'rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: avatar * 0.42, color: '#4c8a41',
            }}
          >
            +
          </Box>
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: C.chipText }}>
            Open slot
          </Typography>
          {onEmptyClick && (
            <Typography sx={{ fontSize: '0.66rem', color: 'rgba(28,42,26,0.5)', mt: -0.5 }}>
              Tap to add
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

/** Vertical KITCHEN strip beside the net. */
function Kitchen({ C }: { C: typeof COURT }) {
  return (
    <Box sx={{ bgcolor: C.kitchen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Typography
        sx={{
          fontSize: '0.5rem', fontWeight: 700, letterSpacing: '0.22em',
          color: 'rgba(28,42,26,0.3)', textTransform: 'uppercase', writingMode: 'vertical-rl',
        }}
      >
        Kitchen
      </Typography>
    </Box>
  );
}

/**
 * Court View card: white card, green court with net + kitchen strips,
 * avatar + star player slots, live timer pill. Team 1 = left, Team 2 = right.
 */
export function CourtCard({
  number, title, label, chipLabel = 'Open Play', startedAt, teamA, teamB,
  onPlayerClick, onEmptySlotClick, headerRight, footer, size = 'md', palette,
}: {
  number?: number | string;
  title?: string;
  label?: string;
  chipLabel?: string;
  startedAt?: number | null;
  teamA: NamedPlayer[];
  teamB: NamedPlayer[];
  onPlayerClick?: (p: NamedPlayer) => void;
  /** Makes empty slots tappable (host compose): slot 0–1 = Team 1, 2–3 = Team 2. */
  onEmptySlotClick?: (team: 'A' | 'B') => void;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md';
  palette?: CourtPalette;
}) {
  const C: typeof COURT = { ...COURT, ...(palette ?? {}) };
  const kitchenW = size === 'sm' ? 20 : 26;
  const netW = size === 'sm' ? 14 : 18;
  return (
    <Box
      sx={{
        bgcolor: '#ffffff', borderRadius: '16px', overflow: 'hidden',
        border: '1px solid rgba(17,24,39,0.08)',
        boxShadow: '0 6px 24px rgba(46,90,40,0.10)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 1.75, pb: 1.25 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: size === 'sm' ? '1rem' : '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', color: COURT.ink }}>
            {title ?? `Court ${number}${label ? ` — ${label}` : ''}`}
          </Typography>
          <Chip
            size="small" label={chipLabel}
            sx={{
              bgcolor: C.chipBg, color: C.chipText, fontWeight: 700,
              fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', height: 22,
            }}
          />
        </Stack>
        {startedAt ? <TimerPill startedAt={startedAt} /> : headerRight}
      </Stack>

      {/* court */}
      <Box sx={{ px: 1.75 }}>
        <Box sx={{ bgcolor: C.frame, borderRadius: '16px', p: '9px' }}>
          <Box sx={{ bgcolor: '#ffffff', borderRadius: '9px', overflow: 'hidden', display: 'flex', gap: '2px' }}>
            {/* left half — Team 1 */}
            <Box
              sx={{
                flex: 1, minWidth: 0, display: 'grid', gap: '2px', bgcolor: '#ffffff',
                gridTemplateColumns: `1fr ${kitchenW}px`, gridTemplateRows: '1fr 1fr',
              }}
            >
              <CourtSlot label="Player 1" player={teamA[0]} onClick={onPlayerClick} onEmptyClick={onEmptySlotClick && (() => onEmptySlotClick('A'))} size={size} C={C} />
              <Box sx={{ gridColumn: 2, gridRow: '1 / -1', display: 'grid' }}><Kitchen C={C} /></Box>
              <CourtSlot label="Player 2" player={teamA[1]} onClick={onPlayerClick} onEmptyClick={onEmptySlotClick && (() => onEmptySlotClick('A'))} size={size} C={C} />
            </Box>
            {/* net */}
            <Box
              sx={{
                width: netW, flexShrink: 0,
                background: `repeating-linear-gradient(135deg, ${C.netA} 0 7px, ${C.netB} 7px 14px)`,
                borderLeft: `2px solid ${C.netEdge}`, borderRight: `2px solid ${C.netEdge}`,
              }}
            />
            {/* right half — Team 2 */}
            <Box
              sx={{
                flex: 1, minWidth: 0, display: 'grid', gap: '2px', bgcolor: '#ffffff',
                gridTemplateColumns: `${kitchenW}px 1fr`, gridTemplateRows: '1fr 1fr',
              }}
            >
              <Box sx={{ gridColumn: 1, gridRow: '1 / -1', display: 'grid' }}><Kitchen C={C} /></Box>
              <Box sx={{ gridColumn: 2, gridRow: 1, display: 'grid' }}>
                <CourtSlot label="Player 3" player={teamB[0]} onClick={onPlayerClick} onEmptyClick={onEmptySlotClick && (() => onEmptySlotClick('B'))} size={size} C={C} />
              </Box>
              <Box sx={{ gridColumn: 2, gridRow: 2, display: 'grid' }}>
                <CourtSlot label="Player 4" player={teamB[1]} onClick={onPlayerClick} onEmptyClick={onEmptySlotClick && (() => onEmptySlotClick('B'))} size={size} C={C} />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: 1.75, pb: 1.75, pt: footer ? 1.25 : 1.75 }}>{footer}</Box>
    </Box>
  );
}

/** "Next up" queue pill: avatar + name + amber stars. */
export function QueueChip({
  player, prefix, highlight = false, warn = false, small = false,
}: {
  player: NamedPlayer;
  prefix?: string;
  highlight?: boolean;
  warn?: boolean;
  small?: boolean;
}) {
  return (
    <Stack
      direction="row" spacing={1} alignItems="center"
      sx={{
        bgcolor: highlight ? '#22c55e' : warn ? '#fef3c7' : COURT.pillBg,
        border: `1px solid ${highlight ? '#16a34a' : warn ? '#fcd34d' : COURT.pillBorder}`,
        borderRadius: 999, pl: 0.5, pr: 1.5, py: 0.5, minWidth: 0,
      }}
    >
      <Avatar
        src={player.avatarUrl ?? undefined}
        sx={{ width: small ? 24 : 28, height: small ? 24 : 28, fontSize: '0.7rem', fontWeight: 700, bgcolor: '#4c9a44' }}
      >
        {player.name?.[0]?.toUpperCase()}
      </Avatar>
      <Typography noWrap sx={{ fontSize: small ? '0.78rem' : '0.82rem', fontWeight: 600, color: highlight ? '#fff' : COURT.ink }}>
        {prefix}{player.name}
      </Typography>
      <Stars value={player.rating} fontSize={small ? '0.62rem' : '0.68rem'} />
    </Stack>
  );
}

/** Colored team panel (blue = Team 1 / orange = Team 2) with avatars + star ratings. */
export function TeamPanel({
  label, players, color, onRemove,
}: {
  label: string;
  players: NamedPlayer[];
  color: string;
  onRemove?: (id: string) => void;
}) {
  return (
    <Box
      sx={{
        flex: 1, minWidth: 0, borderRadius: 1, overflow: 'hidden',
        border: '1px solid rgba(17,24,39,0.10)',
        bgcolor: '#ffffff',
        boxShadow: '0 1px 4px rgba(17,24,39,0.06)',
      }}
    >
      <Box sx={{ bgcolor: color, px: 1.5, py: 0.55 }}>
        <Typography
          variant="caption"
          fontWeight={800}
          sx={{ color: '#fff', letterSpacing: 1.2, fontSize: '0.68rem' }}
        >
          {label.toUpperCase()}
        </Typography>
      </Box>
      <Box sx={{ px: 1.5, py: 1.25, minHeight: 78 }}>
        {players.map((p, i) => (
          <Stack key={p.id} direction="row" spacing={1} alignItems="center" sx={{ mb: i === players.length - 1 ? 0 : 1, minWidth: 0 }}>
            <Avatar
              src={p.avatarUrl ?? undefined}
              sx={{ width: 32, height: 32, fontSize: '0.85rem', fontWeight: 700, bgcolor: '#4c9a44' }}
            >
              {p.name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight={700} noWrap sx={{ fontSize: '0.9rem' }}>
                {p.name}
              </Typography>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <Stars value={p.rating} fontSize="0.68rem" />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {skillLabel(p.rating)}
                </Typography>
              </Stack>
            </Box>
            {onRemove && (
              <Typography
                onClick={() => onRemove(p.id)}
                sx={{ cursor: 'pointer', color: 'text.secondary', fontSize: '0.8rem', pl: 1 }}
              >
                ✕
              </Typography>
            )}
          </Stack>
        ))}
        {!players.length && (
          <Typography variant="caption" color="text.secondary">Drop players here</Typography>
        )}
      </Box>
    </Box>
  );
}

/** LIVE badge + elapsed mm:ss ticking clock for a court header. */
export function LiveClock({ startedAt }: { startedAt: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!startedAt) return null;
  const total = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = `${total % 60}`.padStart(2, '0');
  const label = hh > 0 ? `${hh}:${`${mm}`.padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
      <Chip size="small" label="● LIVE" sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 800, height: 20 }} />
      <Typography variant="caption" fontWeight={700}>{label}</Typography>
    </Stack>
  );
}

/** COURTS n · PLAYERS n · QUEUE n header strip. */
export function StatsBar({ courts, players, queue }: { courts: number; players: number; queue: number }) {
  const item = (label: string, value: number, color: string) => (
    <Stack direction="row" spacing={0.5} alignItems="baseline">
      <Typography variant="caption" sx={{ letterSpacing: 1, color: 'text.secondary', fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography fontWeight={800} sx={{ color }}>{value}</Typography>
    </Stack>
  );
  return (
    <Stack direction="row" spacing={3}>
      {item('COURTS', courts, courts > 0 ? '#16a34a' : '#ef4444')}
      {item('PLAYERS', players, '#111827')}
      {item('QUEUE', queue, '#d97706')}
    </Stack>
  );
}

/** Coverage ring with a visible track (readable even at 0%). */
export function CoverageRing({ played, total }: { played: number; total: number }) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <CircularProgress
        variant="determinate" size={34} thickness={4} value={100}
        sx={{ color: 'rgba(17,24,39,0.12)' }}
      />
      <CircularProgress
        variant="determinate" size={34} thickness={4}
        value={total ? (played / total) * 100 : 0}
        color="success"
        sx={{ position: 'absolute', left: 0 }}
      />
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="caption" fontWeight={700}>{played}</Typography>
      </Box>
    </Box>
  );
}
