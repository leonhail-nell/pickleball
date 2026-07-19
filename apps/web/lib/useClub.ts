'use client';

import { useEffect, useState } from 'react';
import { api } from './api';
import type { CourtPalette } from '@/components/board';

export interface ClubInfo {
  name: string;
  venuePro: boolean;
  venueProUntil: string | null;
  freeCourtLimit: number;
  theme: CourtPalette;
  proPriceCents: number;
  providers: { stripe: boolean; paymongo: boolean };
}

/** Club config incl. the Venue Pro court theme (public endpoint, cached per page). */
export function useClub(): ClubInfo | null {
  const [club, setClub] = useState<ClubInfo | null>(null);
  useEffect(() => {
    api<ClubInfo>('/club').then(setClub).catch(() => {});
  }, []);
  return club;
}
