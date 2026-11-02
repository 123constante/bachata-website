import { describe, expect, it } from 'vitest';
import { saveWordsFor } from '../saveWords';

/**
 * Every P3 save message x {one date, many} x every series lifecycle_status (prod 2026-11-02: archived 653,
 * live 69, ended 21, draft 14, paused 2) plus cancelled, null, the empty string (what seriesModel passes for a
 * null lifecycle_status) and an unknown value. Only a live event may
 * say dancers see it now; the live column is main's words byte for byte.
 */
const LIFECYCLES = ['live', 'draft', 'paused', 'ended', 'archived', 'cancelled', null, '', 'mystery'] as const;
const DAY = 'Fri 6 Nov';
type Msg = 'detailsSaved' | 'pricesSaved' | 'savedEvery' | 'savedDate' | 'addedEvery' | 'addedDate';
const MSGS: Msg[] = ['detailsSaved', 'pricesSaved', 'savedEvery', 'savedDate', 'addedEvery', 'addedDate'];

const textOf = (oneDate: boolean, life: string | null, m: Msg): string => {
  const w = saveWordsFor(oneDate, life);
  const v = w[m];
  return typeof v === 'function' ? v(DAY) : v;
};

/** main's words before this change (labels.ts savedEvery..addedDate, detailsSaved(One), pricesSaved). */
const LIVE: Record<'one' | 'many', Record<Msg, string>> = {
  one: {
    detailsSaved: 'Saved. Dancers see it now.',
    pricesSaved: 'Saved. Dancers see it now.',
    savedEvery: 'Saved for every date. Dancers see it now.',
    savedDate: `Saved for ${DAY} only. Dancers see it now.`,
    addedEvery: 'Session added to every date. Dancers see it now.',
    addedDate: `Added to ${DAY} only. Dancers see it now.`,
  },
  many: {
    detailsSaved: 'Saved for all dates. Dancers see it now. A date with its own pictures keeps them.',
    pricesSaved: 'Prices saved. Dancers see them now.',
    savedEvery: 'Saved for every date. Dancers see it now.',
    savedDate: `Saved for ${DAY} only. Dancers see it now.`,
    addedEvery: 'Session added to every date. Dancers see it now.',
    addedDate: `Added to ${DAY} only. Dancers see it now.`,
  },
};

const CELLS = [true, false].flatMap((oneDate) => LIFECYCLES.flatMap((life) => MSGS.map((m) => [oneDate, life, m] as const)));

describe('saveWordsFor(oneDate, lifecycle): every save message x date count x lifecycle', () => {
  it.each(CELLS)('oneDate=%s lifecycle=%s %s', (oneDate, life, m) => {
    const text = textOf(oneDate, life, m);
    expect(text.length).toBeGreaterThan(0);
    if (life === 'live') {
      expect(text).toBe(LIVE[oneDate ? 'one' : 'many'][m]);
      return;
    }
    expect(text).not.toMatch(/dancers see (it|them) now/i);
    if (life === 'draft') expect(text).toMatch(/as a draft\. Dancers do not see (it|them) yet\.$|as a draft\. Dancers do not see (it|them) yet\. A date/);
    else if (life === 'paused') {
      // P3 calls a paused event Hidden (labels.ts); a paused page can still show on the public site, so no dancer claim.
      expect(text).toMatch(/hidden from the calendar\./);
      expect(text).not.toMatch(/dancers|paused/i);
    }
    else expect(text).not.toMatch(/dancers/i);
    expect(text).not.toMatch(/[\u2013\u2014\u2026]/);
  });

  it('the button and the nothing-changed line do not depend on the lifecycle', () => {
    for (const life of LIFECYCLES) {
      expect(saveWordsFor(true, life).save).toBe(saveWordsFor(true, 'live').save);
      expect(saveWordsFor(false, life).save).toBe(saveWordsFor(false, 'live').save);
      expect(saveWordsFor(false, life).nothing).toBe(saveWordsFor(false, 'live').nothing);
    }
  });

  it('the owner draft wording, one date', () => {
    expect(saveWordsFor(true, 'draft').detailsSaved).toBe('Saved as a draft. Dancers do not see it yet.');
  });
});
