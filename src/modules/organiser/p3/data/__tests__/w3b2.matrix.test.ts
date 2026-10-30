import { describe, expect, it } from 'vitest';
import { parseEventWorkspace, type EventWorkspace } from '../../../events/eventModel';
import { newPriceRow, toPass, type PriceRow } from '../../../events/seriesExtras';
import { OWNER_OVERRIDE_KEYS, overrideCommand, type OverridePatch } from '../../../shared/seriesCommands';
import { parseDateDetail, type DateDetail } from '../../../shared/seriesModel';
import { L } from '../../model';
import {
  DATE_NAME_MAX, dateFieldsWhy, dateGalleryOf, dateGalleryPatch, dateNameOf, dateNamePatch, dateNameProblem, datePriceRows, datePricesLock, datePricesPatch,
} from '../dateFields';
import { ownDetailsOf } from '../dateFacts';
import { planCommands, resetNormalPlan } from '../dates';
import { SHAPES, occ, wsRaw, type ShapeKey } from '../../screens/__tests__/wsFixtures';

/*
 * W3b-2: a date's own Name (title), Photos (gallery), Price (passes). Every field x every
 * prod shape x {untouched, changed, cleared, invalid}; "refused by the server" is in
 * screens/__tests__/w3b2.send.test.tsx. The rules these mirror were read off prod
 * (stsdtacfauprzrdebmzg, 2026-10-28): the owner arm of apply_aggregate_write_p5 (title 1..80
 * non-blank; gallery <= 30 http(s) strings; passes via _owner_passes_problem_p5; JSON null always
 * allowed; on a cancelled date title/gallery/passes refused even as null) and the handler
 * _cmd_occurrence_set_override_p5 (null = back to the series, [] = owned and empty).
 */

const D = { id: 'o-2026-10-30', version: 3, occurrence_date: '2026-10-30' };
const PH = (n: number) => Array.from({ length: n }, (_, i) => `https://img.example.test/p${i}.jpg`);
const PASS = { id: '0b5e3d1e-0000-4000-8000-000000000001', name: 'Entry', price: 12, currency: 'GBP' };
const TEAM_PASS = { id: 'x', name: 'Early', price: 10, tier: 'vip' };

/** event_view_p5 for one date, as prod sends it (keys read off _compute_effective_occurrence_p5). */
const detailOf = (event: Record<string, unknown> = {}, occurrence: Record<string, unknown> = {}): DateDetail =>
  parseDateDetail({ event, occurrence: { id: D.id, date: D.occurrence_date, version: 3, lifecycle_status: 'scheduled', ...occurrence }, schedule: {} });

/** The prod override shapes (377 rows: 16 title, 44 gallery (0: 3, 1: 33, many: 8), 5 both, 0 price, 1 cancelled). */
const DETAILS: Record<string, DateDetail> = {
  none: detailOf(),
  titleOnly: detailOf({ title_override: 'Halloween Special' }),
  galleryOnly: detailOf({ gallery_override: PH(1) }),
  galleryEmpty: detailOf({ gallery_override: [] }),
  galleryMany: detailOf({ gallery_override: PH(4) }),
  both: detailOf({ title_override: 'Halloween Special', gallery_override: PH(2) }),
  priceSet: detailOf({ passes_override: [PASS] }),
  priceTeam: detailOf({ passes_override: [TEAM_PASS] }),
  cancelled: detailOf({ title_override: 'Halloween Special', gallery_override: PH(1) }, { lifecycle_status: 'cancelled' }),
};

const withSeries = (k: ShapeKey, extra: Record<string, unknown>): EventWorkspace => {
  const raw = SHAPES[k] as { series: { series: Record<string, unknown> } };
  return parseEventWorkspace({ ...raw, series: { ...raw.series, series: { ...raw.series.series, ...extra } } });
};
const KINDS: ShapeKey[] = ['weekly', 'course', 'monthly', 'custom', 'oneoff', 'festival'];
const SERIES_GALLERY = PH(3);
const wsOf = (k: ShapeKey) => withSeries(k, { gallery: SERIES_GALLERY, passes: [PASS] });

describe('the owner key mirror carries the three new keys and sends them as the handler reads them', () => {
  it('title, gallery, passes are owner keys (music_styles waits for admin A2 R4)', () => {
    expect(OWNER_OVERRIDE_KEYS).toEqual(expect.arrayContaining(['title', 'gallery', 'passes']));
    expect(OWNER_OVERRIDE_KEYS as readonly string[]).not.toContain('music_styles');
  });
  const cases: Array<[string, OverridePatch, Record<string, unknown>]> = [
    ['title trimmed', { title: '  Halloween Special ' }, { title: 'Halloween Special' }],
    ['title cleared = null (inherit)', { title: null }, { title: null }],
    ['title blank = null, never a blank the owner arm refuses', { title: '   ' }, { title: null }],
    ['gallery in order', { gallery: PH(2) }, { gallery: PH(2) }],
    ['gallery [] is owned and empty, not a clear', { gallery: [] }, { gallery: [] }],
    ['gallery cleared = null', { gallery: null }, { gallery: null }],
    ['passes as the owner pass shape', { passes: [toPass({ id: PASS.id, name: ' Entry ', price: '12', currency: 'GBP' })] }, { passes: [PASS] }],
    ['passes [] is owned and empty', { passes: [] }, { passes: [] }],
    ['passes cleared = null', { passes: null }, { passes: null }],
  ];
  it.each(cases)('%s', (_n, patch, payload) => {
    expect(overrideCommand(patch)).toEqual({ kind: 'occurrence.set_override', payload });
  });
});

describe.each(KINDS)('%s series', (k) => {
  const w = wsOf(k);
  const festival = k === 'festival';

  it(festival ? 'festival: not offered, with the reason' : 'offered', () => {
    expect(dateFieldsWhy(w)).toBe(festival ? L.dateFieldsFestival : null);
  });

  describe.each(Object.entries(DETAILS))('date %s', (shape, det) => {
    const series = w.series.name;
    it('Name: untouched sends nothing; changed sends it; typed back to usual clears an own one; invalid sends nothing', () => {
      const base = dateNameOf(w, det);
      expect(base).toBe(det.titleOverride ?? series);
      expect(dateNamePatch(w, det, base)).toBeNull();
      expect(dateNamePatch(w, det, `  ${base}  `)).toBeNull();
      expect(dateNamePatch(w, det, 'Spooky Night')).toEqual({ title: 'Spooky Night' });
      expect(dateNamePatch(w, det, series)).toEqual(det.titleOverride !== null ? { title: null } : null);
      for (const bad of ['', '   ', 'x'.repeat(DATE_NAME_MAX + 1)]) {
        expect(dateNameProblem(bad)).not.toBeNull();
        expect(dateNamePatch(w, det, bad)).toBeNull();
      }
      expect(dateNameProblem('x'.repeat(DATE_NAME_MAX))).toBeNull();
    });

    it('Photos: untouched nothing; add / remove sends the list; back to the usual list clears; [] owned', () => {
      const base = dateGalleryOf(w, det);
      expect(base).toEqual(det.galleryOverride ?? SERIES_GALLERY);
      expect(dateGalleryPatch(w, det, [...base])).toBeNull();
      expect(dateGalleryPatch(w, det, [...base, 'https://img.example.test/new.jpg'])).toEqual({ gallery: [...base, 'https://img.example.test/new.jpg'] });
      expect(dateGalleryPatch(w, det, SERIES_GALLERY)).toEqual(det.galleryOverride !== null && JSON.stringify(det.galleryOverride) !== JSON.stringify(SERIES_GALLERY) ? { gallery: null } : null);
      expect(dateGalleryPatch(w, det, [])).toEqual(det.galleryOverride?.length === 0 ? null : { gallery: [] });
      expect(dateGalleryPatch(w, det, PH(31))).toBeNull();
    });

    it('Price: untouched nothing; changed sends the owner shape; back to the usual list clears; invalid nothing; a team list is locked', () => {
      const lock = datePricesLock(w, det);
      expect(lock !== null).toBe(shape === 'priceTeam');
      const base = datePriceRows(w, det);
      expect(datePricesPatch(w, det, base.map((r) => ({ ...r })))).toBeNull();
      if (lock) {
        expect(base).toEqual([]);
        expect(datePricesPatch(w, det, [{ ...newPriceRow(), name: 'Door', price: '5' }])).toBeNull();
        return;
      }
      const more: PriceRow[] = [...base, { ...newPriceRow(), name: 'Door', price: '15.50' }];
      expect(datePricesPatch(w, det, more)).toEqual({ passes: more.map(toPass) });
      const seriesRows = datePriceRows(w, null);
      expect(datePricesPatch(w, det, seriesRows)).toEqual(det.passesOverride !== null && JSON.stringify(det.passesOverride) !== JSON.stringify([PASS]) ? { passes: null } : null);
      for (const bad of [[{ ...newPriceRow(), name: '', price: '5' }], [{ ...newPriceRow(), name: 'Door', price: '5.555' }], Array.from({ length: 11 }, () => ({ ...newPriceRow(), name: 'A', price: '1' }))]) {
        expect(datePricesPatch(w, det, bad)).toBeNull();
      }
    });

    it('"Put this date back to normal" uses the composite: the three keys go as null, never on a cancelled date', () => {
      const plan = resetNormalPlan(D, det, false);
      const payload = (plan ? planCommands(plan)[0]?.payload : {}) ?? {};
      const want: Record<string, null> = {};
      if (!det.cancelled) {
        if (det.titleOverride !== null) want.title = null;
        if (det.galleryOverride !== null) want.gallery = null;
        if (det.passesOverride !== null) want.passes = null;
      }
      expect(Object.fromEntries(Object.entries(payload).filter(([key]) => ['title', 'gallery', 'passes'].includes(key)))).toEqual(want);
      if (det.cancelled) expect(plan).toBeNull();
      expect(ownDetailsOf({ ...occ(D.occurrence_date), has_override: false } as never, det)).toBe(shape !== 'none');
    });
  });
});

describe('series edge shapes', () => {
  it('a series with no photos and no prices: the usual reads empty, an own list is still offered', () => {
    const w = parseEventWorkspace(wsRaw({ gallery: [], passes: null }, [], [occ('2026-10-30')]));
    expect(dateGalleryOf(w, DETAILS.none)).toEqual([]);
    expect(dateGalleryPatch(w, DETAILS.none, [])).toBeNull();
    expect(datePriceRows(w, DETAILS.none)).toEqual([]);
    expect(datePricesPatch(w, DETAILS.none, [])).toBeNull();
  });
  it('a series price list the team set up: the date may not start from it (locked, with the reason)', () => {
    const w = withSeries('weekly', { passes: [TEAM_PASS] });
    expect(datePricesLock(w, DETAILS.none)).not.toBeNull();
    expect(datePricesLock(w, DETAILS.priceSet)).toBeNull();
  });
  it('a name the same as the series name, stored on the date (2 on prod): typing it again sends nothing', () => {
    const w = wsOf('weekly');
    const det = detailOf({ title_override: w.series.name });
    expect(dateNamePatch(w, det, w.series.name)).toBeNull();
    expect(dateNamePatch(w, det, 'Other')).toEqual({ title: 'Other' });
  });
});
