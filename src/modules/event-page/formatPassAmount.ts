/**
 * A festival pass price split into its currency symbol and the number, so the ticket grid can style the symbol
 * separately. The symbol follows the pass's own `currency`; a pass with none is GBP (the same default the
 * JSON-LD offers use). The grid used to hard-code a pound sign in CSS, so a EUR festival showed "£105".
 */
export type PassAmountParts = { symbol: string; value: string };

export function formatPassAmount(amount: number, currency: string | null): PassAmountParts {
  const code = (currency ?? '').trim().toUpperCase() || 'GBP';
  try {
    const parts = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).formatToParts(amount);
    return {
      symbol: parts
        .filter((p) => p.type === 'currency')
        .map((p) => p.value)
        .join(''),
      value: parts
        .filter((p) => p.type !== 'currency')
        .map((p) => p.value)
        .join('')
        .trim(),
    };
  } catch {
    // An unknown currency code: show the code itself rather than a wrong symbol.
    return { symbol: `${code} `, value: String(amount) };
  }
}
