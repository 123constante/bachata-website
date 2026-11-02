import { describe, expect, it } from 'vitest';
import { saveWordsFor } from '../saveWords';

const LIVES = ['live', 'draft', 'ended', 'archived', 'cancelled', 'paused', 'weird', null, undefined] as const;
const msgs = (l: string | null | undefined) => {
  const w = saveWordsFor(l);
  return { savedEvery: w.savedEvery, savedDate: w.savedDate('Fri 6 Nov'), addedEvery: w.addedEvery, addedDate: w.addedDate('Fri 6 Nov'), detailsSaved: w.detailsSaved, prices: w.prices };
};

describe('save words by lifecycle', () => {
  for (const l of LIVES) {
    for (const [key, text] of Object.entries(msgs(l))) {
      it(`${String(l)} x ${key}: claims dancers see it now only when live`, () => {
        expect(/see (it|them) now/.test(text)).toBe(l === 'live');
        if (l === 'draft') expect(text).toMatch(/draft\. Dancers do not see (it|them) yet\.$/);
      });
    }
  }
  it('live wording is unchanged', () => {
    expect(msgs('live')).toEqual({
      savedEvery: 'Saved for every date. Dancers see it now.',
      savedDate: 'Saved for Fri 6 Nov only. Dancers see it now.',
      addedEvery: 'Session added to every date. Dancers see it now.',
      addedDate: 'Added to Fri 6 Nov only. Dancers see it now.',
      detailsSaved: 'Saved for every date. Dancers see it now.',
      prices: 'Prices saved. Dancers see them now.',
    });
  });
  it('draft says so, one sentence each', () => {
    expect(msgs('draft').savedEvery).toBe('Saved for every date as a draft. Dancers do not see it yet.');
    expect(msgs('draft').prices).toBe('Prices saved as a draft. Dancers do not see them yet.');
  });
});
