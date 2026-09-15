import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  normalizePhoneDigits,
  buildMailtoHref,
  buildWhatsAppHref,
  buildTelHref,
} from '../contactValidation';

describe('isValidEmail', () => {
  it('accepts a normal email', () => {
    expect(isValidEmail('hello@example.com')).toBe(true);
  });
  it('rejects garbage text', () => {
    expect(isValidEmail('TBA')).toBe(false);
    expect(isValidEmail('N/A')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
  it('rejects mailto-injection-shaped values', () => {
    expect(isValidEmail('foo@bar.com?bcc=victim@evil.com')).toBe(false);
    expect(isValidEmail('foo@bar.com%0abcc:victim@evil.com')).toBe(false);
    expect(isValidEmail('foo bar@example.com')).toBe(false);
  });
  it('trims surrounding whitespace before validating', () => {
    expect(isValidEmail('  hello@example.com  ')).toBe(true);
  });
});

describe('normalizePhoneDigits', () => {
  it('accepts legacy dot/slash/space formatted numbers', () => {
    expect(normalizePhoneDigits('07700.900.123')).toBe('07700900123');
    expect(normalizePhoneDigits('+44 7700 900123')).toBe('447700900123');
    expect(normalizePhoneDigits('07700/900/123')).toBe('07700900123');
  });
  it('rejects too-short or too-long values', () => {
    expect(normalizePhoneDigits('12345')).toBeNull();
    expect(normalizePhoneDigits('1234567890123456')).toBeNull();
  });
  it('rejects garbage text with no digits', () => {
    expect(normalizePhoneDigits('TBA')).toBeNull();
    expect(normalizePhoneDigits(null)).toBeNull();
  });
});

describe('buildMailtoHref / buildWhatsAppHref / buildTelHref', () => {
  it('returns null instead of a dead link for invalid input', () => {
    expect(buildMailtoHref('TBA')).toBeNull();
    expect(buildWhatsAppHref('TBA')).toBeNull();
    expect(buildTelHref('TBA')).toBeNull();
  });
  it('builds valid hrefs', () => {
    expect(buildMailtoHref('hello@example.com')).toBe('mailto:hello@example.com');
    expect(buildWhatsAppHref('+44 7700 900123')).toBe('https://wa.me/447700900123');
    expect(buildTelHref('+44 7700 900123')).toBe('tel:+44 7700 900123');
  });
});
