/**
 * One shared mapping: which symbol tile a ticket type gets (mockups-7, round seven).
 * Picked from the ticket NAME by whole-word match; price 0 is always "free".
 * Order matters: free, then "class + party" (both), then the single words.
 */
export type TicketSymbol = 'free' | 'both' | 'early' | 'vip' | 'class' | 'party' | 'generic';

const words = (name: string): string[] => name.toLowerCase().match(/[a-z]+/g) ?? [];

export function ticketSymbol(name: string, pricePence: number): TicketSymbol {
  if (pricePence === 0) return 'free';
  const w = new Set(words(name));
  const hasClass = w.has('class') || w.has('workshop') || w.has('lesson');
  const hasParty = w.has('party') || w.has('social');
  if (hasClass && hasParty) return 'both';
  if (w.has('vip')) return 'vip';
  if (w.has('early') || w.has('earlybird')) return 'early';
  if (hasClass) return 'class';
  if (hasParty) return 'party';
  return 'generic';
}

/** Gradient per symbol, copied from the round-seven mockup (.tile.*). */
export const SYMBOL_GRADIENT: Readonly<Record<TicketSymbol, string>> = {
  party: 'linear-gradient(150deg,#3C2A57,#1E1730)',
  class: 'linear-gradient(150deg,#244B40,#142A24)',
  both: 'linear-gradient(150deg,#3C2A57 0 50%,#244B40 50%)',
  vip: 'linear-gradient(150deg,#5A431C,#2B2010)',
  free: 'linear-gradient(150deg,#245A38,#12301F)',
  early: 'linear-gradient(150deg,#6A4A14,#33240A)',
  generic: 'linear-gradient(150deg,#2D3F3A,#1A2A26)',
};
