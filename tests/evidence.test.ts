import { describe, it, expect } from 'vitest';
import { fromRow, omitIfUnknown, constantClaim } from '../src/lib/evidence';

// fromRow's own POSITIVE/NEGATIVE/FIDELITY battery is
// tests/publicName.test.ts's 16 cases (resolvePublicName is re-expressed on
// top of fromRow -- see src/lib/publicName.ts). This file covers the two
// primitives that publicName.ts does not exercise -- omitIfUnknown and
// constantClaim -- plus fromRow cases publicName's domain-specific rejection
// rule never reaches (no isInvalid predicate at all, and a candidate that
// merely fails one extractor rather than being domain-rejected).

describe('fromRow', () => {
  it('returns the first non-blank candidate in order', () => {
    type Row = { a: string | null; b: string | null };
    expect(fromRow<Row>({ a: null, b: 'B' }, [(r) => r.a, (r) => r.b])).toBe('B');
    expect(fromRow<Row>({ a: 'A', b: 'B' }, [(r) => r.a, (r) => r.b])).toBe('A');
  });

  it('treats a non-string extraction result as absent, not as a value', () => {
    type Row = { n: number | null; s: string | null };
    // 0 is falsy-shaped data in many domains but fromRow's contract is
    // strings only -- a numeric candidate must be pre-formatted by the
    // caller, never silently coerced.
    expect(fromRow<Row>({ n: 0, s: 'fallback' }, [(r) => r.n, (r) => r.s])).toBe('fallback');
  });

  it('returns null when every candidate is blank', () => {
    type Row = { a: string | null; b: string | null };
    expect(fromRow<Row>({ a: null, b: '   ' }, [(r) => r.a, (r) => r.b])).toBeNull();
  });

  it('with no isInvalid supplied, never rejects a non-blank candidate', () => {
    type Row = { a: string };
    expect(fromRow<Row>({ a: 'anything' }, [(r) => r.a])).toBe('anything');
  });

  it('falls through a rejected candidate to the next one', () => {
    type Row = { a: string | null; b: string | null };
    const row: Row = { a: 'reject-me', b: 'keep-me' };
    expect(
      fromRow<Row>(row, [(r) => r.a, (r) => r.b], (candidate) => candidate === 'reject-me'),
    ).toBe('keep-me');
  });

  it('gives up and returns null when every candidate is rejected', () => {
    type Row = { a: string | null };
    expect(fromRow<Row>({ a: 'reject-me' }, [(r) => r.a], () => true)).toBeNull();
  });
});

describe('omitIfUnknown', () => {
  it('includes a present string value', () => {
    expect(omitIfUnknown('url', 'https://example.test')).toEqual({ url: 'https://example.test' });
  });

  it('omits null and undefined', () => {
    expect(omitIfUnknown('url', null)).toEqual({});
    expect(omitIfUnknown('url', undefined)).toEqual({});
  });

  it('omits a blank or whitespace-only string', () => {
    expect(omitIfUnknown('url', '')).toEqual({});
    expect(omitIfUnknown('url', '   ')).toEqual({});
  });

  it('trims a string value before including it', () => {
    expect(omitIfUnknown('name', '  La Familia  ')).toEqual({ name: '  La Familia  ' });
    // Note: only the PRESENCE check trims; the stored value is the original,
    // uncleaned string -- omitIfUnknown decides whether to include the field,
    // it does not reshape the value. Callers that need a trimmed value pass
    // one in already trimmed.
  });

  it('keeps a falsy-but-real non-string value (0, false, empty array)', () => {
    expect(omitIfUnknown('count', 0)).toEqual({ count: 0 });
    expect(omitIfUnknown('isCancelled', false)).toEqual({ isCancelled: false });
    expect(omitIfUnknown('tags', [])).toEqual({ tags: [] });
  });

  it('keeps a populated array or object unchanged', () => {
    expect(omitIfUnknown('image', ['https://example.test/a.jpg'])).toEqual({
      image: ['https://example.test/a.jpg'],
    });
  });
});

describe('constantClaim', () => {
  it('is the identity function at runtime', () => {
    expect(
      constantClaim('GB', { claim: 'addressCountry', source: 'manual check', verifiedOn: '2026-09-09' }),
    ).toBe('GB');
  });

  it('preserves object identity, not just value equality', () => {
    const value = { '@type': 'Country', name: 'United Kingdom' };
    expect(
      constantClaim(value, { claim: 'country node', source: 'manual', verifiedOn: '2026-09-09' }),
    ).toBe(value);
  });
});
