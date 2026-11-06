import { describe, it, expect } from 'vitest';
import { RAFFLE_WIN_STATES, showsPublicName } from '../raffleWinState';

describe('raffleWinState', () => {
  it.each([
    ['contacted', false], ['locked', true], ['attended', true],
    ['no_show', false], ['released', false], ['cancelled', false],
  ])('%s -> %s', (s, v) => expect(showsPublicName(s)).toBe(v));
  it('has exactly six states; unknown shows nothing', () => {
    expect(Object.keys(RAFFLE_WIN_STATES)).toHaveLength(6);
    expect(showsPublicName('winner')).toBe(false);
    expect(showsPublicName(null)).toBe(false);
    expect(showsPublicName('toString')).toBe(false);
  });
});
