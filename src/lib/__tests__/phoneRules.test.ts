// Unit tests — per-country phone validation (src/lib/phoneRules.ts).
import { describe, it, expect } from 'vitest';
import {
  checkLocalDigits,
  isValidE164,
  normalizeLocalDigits,
} from '../phoneRules';

describe('isValidE164', () => {
  it('accepts 8–15 total digits with leading +', () => {
    expect(isValidE164('+44770090012')).toBe(true);
    expect(isValidE164('+447700900123')).toBe(true);
    expect(isValidE164('+12345678')).toBe(true);
  });
  it('rejects short, long, and malformed values', () => {
    expect(isValidE164('+1234567')).toBe(false);          // 7 digits
    expect(isValidE164('+1234567890123456')).toBe(false); // 16 digits
    expect(isValidE164('447700900123')).toBe(false);      // no +
    expect(isValidE164('+44 7700')).toBe(false);          // spaces
  });
});

describe('normalizeLocalDigits', () => {
  it('strips one trunk zero for trunk-zero countries (GB)', () => {
    expect(normalizeLocalDigits('GB', '07700900123')).toBe('7700900123');
  });
  it('does NOT strip for Italy (landlines keep the 0)', () => {
    expect(normalizeLocalDigits('IT', '0212345678')).toBe('0212345678');
  });
  it('does not touch numbers without a leading zero', () => {
    expect(normalizeLocalDigits('GB', '7700900123')).toBe('7700900123');
  });
});

describe('checkLocalDigits', () => {
  it('GB: exactly 10 digits', () => {
    expect(checkLocalDigits('GB', '+44', '7700900123').status).toBe('ok');
    expect(checkLocalDigits('GB', '+44', '770090012')).toMatchObject({ status: 'short', expected: '10 digits' });
    expect(checkLocalDigits('GB', '+44', '77009001234')).toMatchObject({ status: 'long', expected: '10 digits' });
  });

  it('GB: non-7 first digit soft-warns (non-blocking)', () => {
    const check = checkLocalDigits('GB', '+44', '2071234567');
    expect(check.status).toBe('warn');
  });

  it('US/CA/DO: 10 digits (NANP)', () => {
    expect(checkLocalDigits('US', '+1', '2125551234').status).toBe('ok');
    expect(checkLocalDigits('DO', '+1', '8095551234').status).toBe('ok');
    expect(checkLocalDigits('CA', '+1', '212555123').status).toBe('short');
  });

  it('DE: 9–11 range edges', () => {
    expect(checkLocalDigits('DE', '+49', '12345678').status).toBe('short');   // 8
    expect(checkLocalDigits('DE', '+49', '123456789').status).toBe('ok');     // 9
    expect(checkLocalDigits('DE', '+49', '12345678901').status).toBe('ok');   // 11
    expect(checkLocalDigits('DE', '+49', '123456789012').status).toBe('long'); // 12
  });

  it('AR: 10–11 (mobiles dialled with the extra 9)', () => {
    expect(checkLocalDigits('AR', '+54', '91123456789').status).toBe('ok'); // 11
    expect(checkLocalDigits('AR', '+54', '1123456789').status).toBe('ok');  // 10
  });

  it('unknown ISO falls back to global E.164 totals', () => {
    // +971 (not in the curated list): 8-total minimum → 5 national digits ok-ish
    expect(checkLocalDigits('AE', '+971', '501234567').status).toBe('ok');
    expect(checkLocalDigits('AE', '+971', '1234567890123').status).toBe('long'); // 16 total
  });

  it('empty input reports empty (no nagging)', () => {
    expect(checkLocalDigits('GB', '+44', '').status).toBe('empty');
  });

  it('range label renders for ranged rules', () => {
    expect(checkLocalDigits('DE', '+49', '1234567')).toMatchObject({ status: 'short', expected: '9–11 digits' });
  });
});
