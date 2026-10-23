// Phone + Instagram parity with the server (invite journey W2 / A1). The admin
// migration self-verify runs the SAME fixture file through normalize_phone_e164_v1
// and normalize_instagram_handle_v1; byte-identical is the parity test, so the
// file's hash is pinned here and a change to it is a deliberate, two-repo change.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INVALID_PHONE, isValidE164, normalizePhoneE164 } from '../phoneRules';
import { INVALID_INSTAGRAM, normalizeInstagramHandle, stripInstagram } from '../instagramHandle';

interface Case { input: string; expected: string | null; error: string | null; legacy: boolean }
interface Fixture { version: number; phone: Case[]; instagram: Case[] }

const FILE = resolve(__dirname, '../__fixtures__/phone-instagram-cases.json');
const raw = readFileSync(FILE, 'utf8');
const fixture = JSON.parse(raw) as Fixture;

/** sha256 of the file with LF endings (the bytes git stores). Update only together with the admin copy. */
const PINNED_SHA = '3aa36343aa41ba82bb0767f47c3e35e39235434f81aeef6a0bdf786b20e8aee2';

describe('phone-instagram-cases.json', () => {
  it('is the pinned, ASCII-only file', () => {
    const lf = raw.replace(/\r\n/g, '\n');
    expect(/^[\x00-\x7f]*$/.test(lf)).toBe(true);
    expect(createHash('sha256').update(lf).digest('hex')).toBe(PINNED_SHA);
  });

  it('carries the legacy shapes found on prod (PLAN section 2) and both outcomes', () => {
    const legacyPhones = fixture.phone.filter((c) => c.legacy).map((c) => c.input);
    expect(legacyPhones).toEqual(expect.arrayContaining(['+44 7700 900123', '12345678', '2345678']));
    expect(fixture.instagram.find((c) => c.legacy && c.input.length === 34)?.error).toBe(INVALID_INSTAGRAM);
    for (const list of [fixture.phone, fixture.instagram]) {
      expect(list.some((c) => c.error === null && c.expected !== null)).toBe(true);
      expect(list.some((c) => c.error !== null)).toBe(true);
      // A case is either a stored value (or a clear) or a refusal, never both.
      for (const c of list) expect(c.error === null || c.expected === null).toBe(true);
    }
  });
});

describe.each(fixture.phone)('phone $input', (c) => {
  it(c.error ? `refuses with ${c.error}` : `stores ${c.expected}`, () => {
    const r = normalizePhoneE164(c.input);
    if (c.error) {
      expect(r).toEqual({ ok: false, code: c.error });
      expect(c.error).toBe(INVALID_PHONE);
    } else {
      expect(r).toEqual({ ok: true, value: c.expected });
      if (c.expected) expect(isValidE164(c.expected)).toBe(true);
    }
  });
});

describe.each(fixture.instagram)('instagram $input', (c) => {
  it(c.error ? `refuses with ${c.error}` : `stores ${c.expected}`, () => {
    const r = normalizeInstagramHandle(c.input);
    if (c.error) {
      expect(r).toMatchObject({ ok: false, code: c.error });
    } else {
      expect(r).toEqual({ ok: true, handle: c.expected });
      // The stored value is a fixed point: saving it again changes nothing.
      if (c.expected) expect(normalizeInstagramHandle(c.expected)).toEqual({ ok: true, handle: c.expected });
    }
  });
});

describe('stripInstagram is the server normaliser as it is', () => {
  it('keeps what the validator later refuses (no silent rewrite)', () => {
    expect(stripInstagram('papa cito')).toBe('papa cito');
    expect(stripInstagram('@@papacito')).toBe('@papacito');
  });
});
