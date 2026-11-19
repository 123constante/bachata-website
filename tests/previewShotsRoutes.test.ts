import { describe, expect, it } from 'vitest';
// @ts-expect-error -- plain .mjs helper, no types
import { isSafeRoute, parsePreviewRoutes, pickUpcomingEventId, shotName } from '../scripts/lib/previewShotsRoutes.mjs';
// @ts-expect-error -- plain .mjs script
import { main, selfTest } from '../scripts/preview-shots.mjs';

describe('parsePreviewRoutes', () => {
  it('reads comma and space separated routes from the labelled line', () => {
    const r = parsePreviewRoutes('## x\nPreview routes: /a, /b/c  /d?x=1\nother /z');
    expect(r.routes).toEqual(['/a', '/b/c', '/d?x=1']);
  });
  it('returns nothing without the label', () => {
    expect(parsePreviewRoutes('no label /a').routes).toEqual([]);
    expect(parsePreviewRoutes(undefined).routes).toEqual([]);
  });
  it('rejects schemes, // and non-slash starts', () => {
    const r = parsePreviewRoutes('Preview routes: https://evil.test/x, //evil.test, /ok, nope, /a//b, /../x, javascript:1');
    expect(r.routes).toEqual(['/ok']);
    expect(r.rejected.length).toBe(6);
  });
  it('caps at 6 and drops duplicates', () => {
    const r = parsePreviewRoutes('Preview routes: /1 /2 /3 /4 /5 /6 /7 /1');
    expect(r.routes).toHaveLength(6);
    expect(r.overflow).toEqual(['/7']);
  });
  it('isSafeRoute rejects backslash and whitespace', () => {
    expect(isSafeRoute('/a\\b')).toBe(false);
    expect(isSafeRoute('/a b')).toBe(false);
    expect(isSafeRoute('/')).toBe(true);
  });
});

describe('helpers', () => {
  it('shotName is filesystem safe', () => {
    expect(shotName('/city/london-gb')).toBe('city-london-gb.png');
    expect(shotName('/a?b=c')).toBe('a-b-c.png');
  });
  it('pickUpcomingEventId takes the soonest non-cancelled future row', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const rows = [
      { event_id: 'past', occurrence_starts_at: '2025-12-31T00:00:00Z' },
      { event_id: 'cancelled', occurrence_starts_at: '2026-01-02T00:00:00Z', is_cancelled: true },
      { event_id: 'later', occurrence_starts_at: '2026-01-05T00:00:00Z' },
      { event_id: 'soon', occurrence_starts_at: '2026-01-03T00:00:00Z' },
    ];
    expect(pickUpcomingEventId(rows, now)).toBe('soon');
    expect(pickUpcomingEventId([], now)).toBeNull();
  });
});

describe('preview-shots main', () => {
  it('self-test passes (exit codes 0/1/2 driven through main)', async () => {
    expect(await selfTest()).toBe(true);
  });
  it('exits 2 without supabase env', async () => {
    expect(await main([], { env: {} })).toBe(2);
  });
});
