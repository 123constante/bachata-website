import { describe, expect, it } from 'vitest';
import { formatPassAmount } from '../formatPassAmount';

describe('formatPassAmount', () => {
  it('uses the pass currency, not a fixed pound sign', () => {
    expect(formatPassAmount(105, 'EUR')).toEqual({ symbol: '€', value: '105' });
    expect(formatPassAmount(129, 'GBP')).toEqual({ symbol: '£', value: '129' });
  });

  it('defaults a missing or blank currency to GBP', () => {
    expect(formatPassAmount(40, null).symbol).toBe('£');
    expect(formatPassAmount(40, '  ').symbol).toBe('£');
  });

  it('keeps pence only when the amount has them', () => {
    expect(formatPassAmount(12.5, 'GBP').value).toBe('12.50');
    expect(formatPassAmount(12, 'GBP').value).toBe('12');
  });

  it('shows an unknown currency code instead of a wrong symbol', () => {
    expect(formatPassAmount(10, 'not-a-code')).toEqual({ symbol: 'NOT-A-CODE ', value: '10' });
  });
});
