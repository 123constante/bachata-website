import { useEffect, useRef, useState } from 'react';
import { isListedSeries } from '../../shared/homeModel';
import type { HomeOrganiser } from '../../shared/selfServeApi';
import { P3_PATHS } from '../shell/paths';
import { P3_TICKET_PATHS } from './paths';

/**
 * The ONE return handler for every Connect press (Get paid, Home prompt, start screen, Tickets
 * sheet): on a Stripe return refetch the status, then poll every 3 s for 30 s, then stop and let
 * the Stripe state (S2 mapping) say what is left. Nothing here tells anyone to reload.
 */
export const CONNECT_RETURN_EVERY_MS = 3000;
export const CONNECT_RETURN_FOR_MS = 30_000;

export type ReturnKind = 'return' | 'refresh' | null;
export type ReturnPhase = 'checking' | 'timeout' | null;

export const returnKindOf = (stripeParam: string | null): ReturnKind => (stripeParam === 'return' || stripeParam === 'refresh' ? stripeParam : null);

export function useConnectReturn(on: boolean, connected: boolean, refetch: () => unknown): { phase: ReturnPhase; again: () => void } {
  const [phase, setPhase] = useState<ReturnPhase>(on ? 'checking' : null);
  const [round, setRound] = useState(0);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    if (!on || connected) return;
    setPhase('checking');
    void refetchRef.current();
    const tick = setInterval(() => void refetchRef.current(), CONNECT_RETURN_EVERY_MS);
    const stop = setTimeout(() => { clearInterval(tick); setPhase('timeout'); }, CONNECT_RETURN_FOR_MS);
    return () => { clearInterval(tick); clearTimeout(stop); };
  }, [on, connected, round]);
  return { phase: on && !connected ? phase : null, again: () => setRound((n) => n + 1) };
}

export interface NextTicket {
  to: string;
  /** Why the link goes where it does; null when it opens the Tickets sheet directly. */
  why: string | null;
}

/** Where "Add a ticket" goes once payments are connected: the Tickets sheet of the one live event, else the way to one. */
export function nextTicketTarget(org: HomeOrganiser): NextTicket {
  const live = org.series.filter((s) => isListedSeries(s) && s.lifecycle_status === 'live');
  if (live.length === 1) return { to: P3_TICKET_PATHS.eventTickets(live[0].id), why: null };
  if (live.length > 1) return { to: P3_PATHS.events, why: 'You have more than one event. Pick the one you want to sell tickets for.' };
  if (org.series.length > 0) return { to: P3_PATHS.events, why: 'None of your events is live yet. Put one live, then add its tickets.' };
  return { to: P3_PATHS.createFor(org.id), why: 'You need an event first. Create one, then add its tickets.' };
}
