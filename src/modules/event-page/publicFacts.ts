// ER-C6: the plain facts an organiser enters, as the PUBLIC page says them.
// One mapping for the event page (and any calendar row that needs the same
// fact), so two screens can never word the same fact two ways. Pure, no React.

import { EVENT_RULES, parsePaymentMethods } from '@/modules/organiser/shared/eventRules';

const PAYMENT_LABELS = EVENT_RULES.payment.codes as Record<string, string>;

/** "Pay: Ticket link, Cash". NO line at all (null) when nothing known is stored. */
export function paymentLine(stored: string | null | undefined): string | null {
  const codes = parsePaymentMethods(stored);
  if (codes.length === 0) return null;
  return `Pay: ${codes.map((c) => PAYMENT_LABELS[c]).join(', ')}`;
}

export interface FactOrganiser {
  name: string | null;
  role?: string | null;
  status?: string | null;
}

/**
 * "By Owner, Co-organiser". The owner first, then ACCEPTED co-organisers only
 * (an invited page is not yet an organiser). Without role data the first
 * organiser is the owner and the rest are left out rather than guessed.
 */
export function organiserByline(organisers: readonly FactOrganiser[]): string | null {
  const named = organisers.filter((o) => (o.name ?? '').trim() !== '');
  if (named.length === 0) return null;
  const hasRoles = named.some((o) => o.role);
  const owner = hasRoles ? named.find((o) => o.role === 'owner') : named[0];
  if (!owner) return null;
  const co = hasRoles
    ? named.filter((o) => o !== owner && o.role === 'co' && (o.status ?? 'accepted') === 'accepted')
    : [];
  return `By ${[owner, ...co].map((o) => (o.name as string).trim()).join(', ')}`;
}

/** A festival with no workshop sessions says so, instead of an empty timetable. */
export function timetableSoon(format: string | null | undefined, workshopCount: number | null): string | null {
  return format === 'festival' && workshopCount === 0 ? 'Timetable coming soon' : null;
}

/** A cancelled date stays visible as Cancelled; the reason, when given, follows. */
export function cancelledLine(isCancelled: boolean, reason: string | null | undefined): string | null {
  if (!isCancelled) return null;
  const r = (reason ?? '').trim();
  return r ? `Cancelled: ${r}` : 'Cancelled';
}

export interface PublicFactsInput {
  paymentMethods: string | null;
  organisers: readonly FactOrganiser[];
  format: string | null;
  workshopCount: number | null;
}

/** The lines the About tile adds, in order; empty when there is nothing to say. */
export function publicFactLines(i: PublicFactsInput): string[] {
  return [
    organiserByline(i.organisers),
    paymentLine(i.paymentMethods),
    timetableSoon(i.format, i.workshopCount),
  ].filter((l): l is string => l !== null);
}
