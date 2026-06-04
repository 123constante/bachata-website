/**
 * Shared promo-code discount formatter. Single home for the "20% off" /
 * fixed-amount string used by the event bento PromoBlock, the EventPromoSection,
 * and the festival hero promo ribbon (FestivalPromoBanner). Keep this the only copy.
 *
 * Currency-aware for fixed discounts (festivals are international). Falls back to
 * GBP when a code carries no/unknown currency.
 */
const CURRENCY_SYMBOLS: Record<string, string> = { GBP: '£', EUR: '€', USD: '$' };

export const formatDiscount = (
  type: 'percent' | 'fixed',
  amount: number,
  currency?: string | null,
): string => {
  if (type === 'percent') return `${amount}% off`;
  const symbol = (currency && CURRENCY_SYMBOLS[currency.toUpperCase()]) || '£';
  return `${symbol}${amount} off`;
};
