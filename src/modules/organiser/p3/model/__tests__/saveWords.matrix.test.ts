import { describe, expect, it } from 'vitest';
import { saveWordsFor } from '../saveWords';

const LIVES = ['live', 'draft', 'ended', 'archived', 'cancelled', 'paused', 'weird', null, undefined] as const;
const DATES = [true, false] as const;
const msgs = (one: boolean, l: string | null | undefined) => {
  const w = saveWordsFor(one, l);
  return {
    detailsSaved: w.detailsSaved, pricesSaved: w.pricesSaved, savedEvery: w.savedEvery, savedDate: w.savedDate('Fri 6 Nov'),
    addedEvery: w.addedEvery, addedDate: w.addedDate('Fri 6 Nov'),
  };
};

describe('save words: every message x {one date, many} x lifecycle', () => {
  for (const one of DATES) {
    for (const l of LIVES) {
      for (const [key, text] of Object.entries(msgs(one, l))) {
        it(`${one ? 'one date' : 'many dates'} x ${String(l)} x ${key}: claims dancers see it now only when live`, () => {
          expect(/see (it|them) now/.test(text)).toBe(l === 'live');
          if (l === 'draft') expect(text).toMatch(/draft\. Dancers do not see (it|them) yet\./);
          if (l === 'paused') expect(text).toMatch(/It is paused, so dancers do not see (it|them)\./);
          if (l !== 'live' && l !== 'draft' && l !== 'paused') expect(text).not.toMatch(/dancers (see|do not)/i);
        });
      }
    }
  }
  it('live is main\'s wording, byte for byte', () => {
    expect(msgs(true, 'live')).toMatchObject({ detailsSaved: 'Saved. Dancers see it now.', pricesSaved: 'Saved. Dancers see it now.' });
    expect(msgs(false, 'live')).toEqual({
      detailsSaved: 'Saved for all dates. Dancers see it now. A date with its own pictures keeps them.',
      pricesSaved: 'Prices saved. Dancers see them now.',
      savedEvery: 'Saved for every date. Dancers see it now.',
      savedDate: 'Saved for Fri 6 Nov only. Dancers see it now.',
      addedEvery: 'Session added to every date. Dancers see it now.',
      addedDate: 'Added to Fri 6 Nov only. Dancers see it now.',
    });
  });
  it('the button words follow the date count only', () => {
    for (const l of LIVES) {
      expect(saveWordsFor(true, l).save).toBe('Save');
      expect(saveWordsFor(false, l).save).toBe('Save for all dates');
    }
  });
  it('draft and paused, many dates', () => {
    expect(msgs(false, 'draft').detailsSaved).toBe('Saved for all dates as a draft. Dancers do not see it yet. A date with its own pictures keeps them.');
    expect(msgs(false, 'draft').pricesSaved).toBe('Prices saved as a draft. Dancers do not see them yet.');
    expect(msgs(true, 'paused').detailsSaved).toBe('Saved. It is paused, so dancers do not see it.');
    expect(msgs(false, 'ended').savedEvery).toBe('Saved for every date.');
  });
});
