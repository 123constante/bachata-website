import { describe, expect, it } from 'vitest';
import {
  PROFILE_FIELDS,
  PROFILE_FIELD_LABEL,
  finishScreenNotice,
  stillToAddText,
  type ProfileField,
} from '@/lib/profileCompletion';
import { UPLOAD_NETWORK_MESSAGE, uploadErrorMessage } from '@/lib/upload-validation';

// All 16 subsets of the four fields, in profile order.
const COMBOS: ProfileField[][] = Array.from({ length: 16 }, (_, mask) => PROFILE_FIELDS.filter((_f, i) => mask & (1 << i)));

describe('stillToAddText: every combination of the four fields', () => {
  it.each(COMBOS.map((m) => [m.join('+') || 'none', m] as [string, ProfileField[]]))('%s', (_n, missing) => {
    const text = stillToAddText(missing);
    if (missing.length === 0) return expect(text).toBe('');
    expect(text).toBe(`Still to add: ${missing.map((f) => PROFILE_FIELD_LABEL[f]).join(', ')}.`);
    for (const f of PROFILE_FIELDS) expect(text.includes(PROFILE_FIELD_LABEL[f])).toBe(missing.includes(f));
  });
  it('names all four on a fresh account', () => {
    expect(stillToAddText(PROFILE_FIELDS)).toBe('Still to add: first name, city, dance role, photo.');
  });
});

describe('finishScreenNotice: Saved vs Saved. Still to add vs complete', () => {
  it.each(COMBOS.filter((m) => m.length > 0).map((m) => [m.join('+'), m] as [string, ProfileField[]]))(
    'partial save, %s left: names exactly what is left, no contradiction',
    (_n, missing) => {
      const text = finishScreenNotice({ status: 'incomplete', missing }, true);
      expect(text).toBe(`Saved. ${stillToAddText(missing)}`);
      expect(text).not.toMatch(/rate parties/);
    },
  );
  it('complete after save is plain "Saved." (the screen then continues to returnTo)', () => {
    expect(finishScreenNotice({ status: 'complete', missing: [] }, true)).toBe('Saved.');
  });
  it('never says Saved on a re-check failure without admitting it', () => {
    expect(finishScreenNotice({ status: 'error', missing: [] }, true)).toMatch(/couldn.t re-check/);
  });
});

describe('uploadErrorMessage', () => {
  it.each([
    ['TypeError Failed to fetch', new TypeError('Failed to fetch')],
    ['plain Error Failed to fetch', new Error('Failed to fetch')],
    ['Safari Load failed', new TypeError('Load failed')],
    ['edge function fetch error', Object.assign(new Error('Failed to send a request to the Edge Function'), { name: 'FunctionsFetchError' })],
  ])('network failure (%s) is friendly and never raw', (_n, err) => {
    const msg = uploadErrorMessage(err);
    expect(msg).toBe(UPLOAD_NETWORK_MESSAGE);
    expect(msg).not.toMatch(/failed to fetch/i);
  });
  it.each([
    ['too big', 'File is too large (6.0 MB). Maximum is 5 MB.'],
    ['wrong type', 'Only image files are allowed (JPEG, PNG, WebP, GIF). Got "application/pdf".'],
    ['server', 'Upload failed: 403 Forbidden'],
  ])('real message kept (%s)', (_n, message) => {
    expect(uploadErrorMessage(new Error(message))).toBe(message);
  });
});
