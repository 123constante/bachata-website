// Phone + Instagram parity with the server (invite journey W2 / A1). The admin
// migration self-verify runs the SAME fixture file through normalize_phone_e164_v1
// and normalize_instagram_handle_strict_v1; byte-identical is the parity test, so the
// file's hash is pinned here and a change to it is a deliberate, two-repo change.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INVALID_PHONE, isValidE164, normalizePhoneE164 } from '../phoneRules';
import { INVALID_INSTAGRAM, normalizeInstagramHandle, stripInstagram } from '../instagramHandle';

// A case is {input, expect} (the stored value; null = cleared) or {input, error} (the refusal code).
interface Case { input: string | null; expect?: string | null; error?: string; note: string }
interface Fixture { phone: Case[]; instagram: Case[] }

// The canonical copy is bachata-admin supabase/fixtures/phone-instagram-cases.json (A1); this file is it, byte for byte.
const FILE = resolve(__dirname, '../__fixtures__/phone-instagram-cases.json');
const raw = readFileSync(FILE, 'utf8');
const fixture = JSON.parse(raw) as Fixture;

/** sha256 of the file with LF endings (the bytes git stores). Update only together with the admin copy. */
const PINNED_SHA = '4c5ce98d828463e413d070325ee1499bd158b27550b6cf4595dd99d7a43278c7';

describe('phone-instagram-cases.json', () => {
  it('is the pinned, ASCII-only file', () => {
    const lf = raw.replace(/\r\n/g, '\n');
    expect(/^[\x00-\x7f]*$/.test(lf)).toBe(true);
    expect(createHash('sha256').update(lf).digest('hex')).toBe(PINNED_SHA);
  });

  it('carries the legacy shapes found on prod (PLAN section 2) and both outcomes', () => {
    const inputs = fixture.phone.map((c) => c.input);
    expect(inputs).toEqual(expect.arrayContaining(['+44 7700 900123', '12345678', '1234567']));
    expect(fixture.instagram.find((c) => c.input?.length === 34)?.error).toBe(INVALID_INSTAGRAM);
    for (const list of [fixture.phone, fixture.instagram]) {
      expect(list.some((c) => typeof c.expect === 'string')).toBe(true);
      expect(list.some((c) => c.error !== undefined)).toBe(true);
      // A case is either a stored value (or a clear) or a refusal, never both.
      for (const c of list) expect(('expect' in c) !== ('error' in c)).toBe(true);
    }
  });
});

describe.each(fixture.phone)('phone $input', (c) => {
  it(c.error ? `refuses with ${c.error} (${c.note})` : `stores ${c.expect} (${c.note})`, () => {
    const r = normalizePhoneE164(c.input);
    if (c.error) {
      expect(r).toEqual({ ok: false, code: c.error });
      expect(c.error).toBe(INVALID_PHONE);
    } else {
      expect(r).toEqual({ ok: true, value: c.expect });
      if (c.expect) expect(isValidE164(c.expect)).toBe(true);
    }
  });
});

describe.each(fixture.instagram)('instagram $input', (c) => {
  it(c.error ? `refuses with ${c.error} (${c.note})` : `stores ${c.expect} (${c.note})`, () => {
    const r = normalizeInstagramHandle(c.input);
    if (c.error) {
      expect(r).toMatchObject({ ok: false, code: c.error });
    } else {
      expect(r).toEqual({ ok: true, handle: c.expect });
      // The stored value is a fixed point: saving it again changes nothing.
      if (c.expect) expect(normalizeInstagramHandle(c.expect)).toEqual({ ok: true, handle: c.expect });
    }
  });
});

describe('stripInstagram is the server normaliser as it is', () => {
  it('keeps what the validator later refuses (no silent rewrite)', () => {
    expect(stripInstagram('papa cito')).toBe('papa cito');
    expect(stripInstagram('@@papacito')).toBe('@papacito');
  });
});
