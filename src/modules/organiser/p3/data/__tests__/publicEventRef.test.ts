import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rowOf } from '../home';
import { shareLinkOf } from '../analyticsV2';
import { SHAPES, TODAY } from '../../screens/__tests__/fixtures';

/*
 * The share link must open the public event page for every live event. Prod (read-only,
 * 2026-11-07, 70 live series): resolve_public_event_ref_v1(series id) resolves 12 of 12
 * unbridged and 0 of 58 bridged; by slug 70 of 70; by COALESCE(legacy_event_id, id) 70 of 70.
 * organiser_home_v1 sends the series slug (organisers[].series[].slug) and no legacy_event_id.
 */
const SID = 'series-0000-aaaa';
const LEGACY = 'legacy-1111-bbbb';

type Case = { name: string; over: Record<string, unknown>; ref: string };
const CASES: Case[] = [
  { name: 'bridged, slug present', over: { slug: 'sensual-fridays', legacy_event_id: LEGACY }, ref: 'sensual-fridays' },
  { name: 'bridged, slug absent (legacy id in payload)', over: { slug: null, legacy_event_id: LEGACY }, ref: LEGACY },
  { name: 'bridged, empty-string slug', over: { slug: '', legacy_event_id: LEGACY }, ref: LEGACY },
  { name: 'unbridged, slug present', over: { slug: 'tonight-social', legacy_event_id: null }, ref: 'tonight-social' },
  { name: 'unbridged, slug absent (legacy null in payload)', over: { slug: null, legacy_event_id: null }, ref: SID },
  { name: 'unbridged, blank slug', over: { slug: '   ', legacy_event_id: null }, ref: SID },
  { name: 'slug with spaces and unicode', over: { slug: 'café night ✨', legacy_event_id: LEGACY }, ref: 'café night ✨' },
  { name: 'home_v1 today: slug present, no legacy key', over: { slug: 'first-saturdays' }, ref: 'first-saturdays' },
  { name: 'home_v1 today: slug absent, no legacy key (bridging unknown: no link)', over: { slug: null }, ref: '' },
  { name: 'home_v1 today: empty-string slug, no legacy key', over: { slug: '' }, ref: '' },
];

describe('P3Row.publicEventRef x shape', () => {
  it.each(CASES)('$name', (c) => {
    const r = rowOf({ ...SHAPES.weekly, id: SID, ...c.over } as never, TODAY);
    expect(r.publicEventRef).toBe(c.ref);
    const bridged = typeof c.over.legacy_event_id === 'string';
    const unknown = !('legacy_event_id' in c.over);
    if (bridged || unknown) expect(r.publicEventRef).not.toBe(SID);
    if (r.publicEventRef) {
      const link = shareLinkOf('https://x.test', r.publicEventRef, 'abc');
      expect(link).toBe(`https://x.test/event/${encodeURIComponent(c.ref)}?ref=abc`);
      if (bridged) expect(link).not.toContain(SID);
    }
  });
});

describe('source scan: no /event/ link from a bare .id under p3', () => {
  const root = join(__dirname, '..', '..');
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); } else if (/\.(ts|tsx)$/.test(f)) files.push(p);
    }
  };
  walk(root);
  it('finds the source files', () => expect(files.length).toBeGreaterThan(5));
  it.each(files.map((f) => [f.slice(root.length + 1), f]))('%s', (_n, f) => {
    const src = readFileSync(f, 'utf8');
    expect(src).not.toMatch(/\/event\/\$\{[^}]*\.id\b[^}]*\}/);
    expect(src).not.toMatch(/['"`]\/event\/['"`]\s*\+\s*[\w.]*\.id\b/);
    expect(src).not.toMatch(/shareLinkOf\([^)]*\.id\s*,/);
  });
});
