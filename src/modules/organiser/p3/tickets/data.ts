import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isListedSeries, type HomeSeriesFull } from '../../shared/homeModel';
import type { HomeOrganiser, OrganiserHome } from '../../shared/selfServeApi';
import { fetchOrders, fetchSalesSummary, fetchSeriesTypes, fetchStripeAccount, startOnboarding, ticketKeys } from '../../tickets/ticketsApi';
import { reasonMessage, stripeStateOf, type StripeState } from '../../tickets/ticketModel';
import { useP3Home } from '../data/useP3Data';
import { P3_TICKET_PATHS } from './paths';

/**
 * The P3 ticketing reads. Same query keys as the shipped area (ticketsApi.ticketKeys),
 * so the two never hold two answers to one question.
 */

/** The organiser page an event belongs to, from the home read P3 already holds. */
export function organiserOfSeries(home: OrganiserHome | undefined, seriesId: string): { org: HomeOrganiser; series: HomeSeriesFull } | null {
  for (const org of home?.organisers ?? []) {
    const series = org.series.find((s) => s.id === seriesId);
    if (series) return { org, series };
  }
  return null;
}

/**
 * The page Get paid is about: the one asked for (?o=), else the first with a live event,
 * else the first. P3 has no page switcher yet; almost every account runs one page.
 */
export function payingOrganiser(home: OrganiserHome | undefined, wanted: string | null): HomeOrganiser | null {
  const orgs = home?.organisers ?? [];
  return (
    (wanted ? orgs.find((o) => o.id === wanted) : undefined) ??
    orgs.find((o) => o.series.some((s) => isListedSeries(s) && s.lifecycle_status === 'live')) ??
    orgs[0] ??
    null
  );
}

export const hasLiveEvent = (org: HomeOrganiser | null): boolean => !!org?.series.some((s) => isListedSeries(s) && s.lifecycle_status === 'live');

export function useStripe(organiserId: string | undefined) {
  const q = useQuery({
    queryKey: ticketKeys.stripe(organiserId),
    queryFn: () => fetchStripeAccount(organiserId as string),
    enabled: !!organiserId,
    staleTime: 30_000,
  });
  const state: StripeState | null = q.isSuccess ? stripeStateOf(q.data) : null;
  return { query: q, state };
}

export function useSummary(organiserId: string | undefined) {
  return useQuery({
    queryKey: ticketKeys.summary(organiserId),
    queryFn: () => fetchSalesSummary(organiserId as string),
    enabled: !!organiserId,
    staleTime: 30_000,
  });
}

export function useSeriesTypes(organiserId: string | undefined, seriesId: string, enabled = true) {
  return useQuery({
    queryKey: ticketKeys.types(organiserId, seriesId),
    queryFn: () => fetchSeriesTypes(organiserId as string, seriesId),
    enabled: enabled && !!organiserId,
  });
}

export function useSeriesOrders(organiserId: string | undefined, seriesId: string, typeIds: readonly string[], enabled: boolean) {
  return useQuery({
    queryKey: [...ticketKeys.orders(organiserId, seriesId), typeIds.join(',')],
    queryFn: () => fetchOrders(typeIds),
    enabled: enabled && typeIds.length > 0,
  });
}

/** Connect / Finish connecting: ask for a Stripe link and go there; Stripe sends the person back to You > Get paid. */
export function useStartOnboarding(organiserId: string) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [switchedOff, setSwitchedOff] = useState(false);
  const go = async () => {
    setBusy(true);
    setNote(null);
    const origin = window.location.origin;
    const out = await startOnboarding(
      organiserId,
      P3_TICKET_PATHS.stripeBack(origin, organiserId, 'return'),
      P3_TICKET_PATHS.stripeBack(origin, organiserId, 'refresh'),
    );
    if (out.kind === 'ok') {
      window.location.assign(out.value);
      return;
    }
    setBusy(false);
    if (out.kind === 'not_configured') setSwitchedOff(true);
    else setNote(reasonMessage(out.reason));
  };
  return { go, busy, note, switchedOff };
}

export { useP3Home };
