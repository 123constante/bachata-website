// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PENDING_LEVEL_RATING_KEY,
  clearPendingLevelRating,
  stashPendingLevelRating,
  takePendingLevelRating,
} from '@/lib/pendingLevelRating';

beforeEach(() => localStorage.clear());

describe('pending level rating', () => {
  it('hands the level back exactly once and removes it before returning', () => {
    stashPendingLevelRating({ seriesId: 'a', level: 'strong' });
    expect(takePendingLevelRating('a')).toBe('strong');
    expect(localStorage.getItem(PENDING_LEVEL_RATING_KEY)).toBeNull();
    expect(takePendingLevelRating('a')).toBeNull();
  });

  it('leaves a vote for another series alone', () => {
    stashPendingLevelRating({ seriesId: 'a', level: 'mixed' });
    expect(takePendingLevelRating('b')).toBeNull();
    expect(takePendingLevelRating('a')).toBe('mixed');
  });

  it.each([
    ['not json', '{oops'],
    ['an old five-level value', JSON.stringify({ seriesId: 'a', level: 'beginner', at: Date.now() })],
    ['a missing series', JSON.stringify({ level: 'strong' })],
    ['null', 'null'],
    ['no timestamp', JSON.stringify({ seriesId: 'a', level: 'strong' })],
    ['an expired tap', JSON.stringify({ seriesId: 'a', level: 'strong', at: Date.now() - 2 * 60 * 60 * 1000 })],
  ])('drops %s without throwing', (_name, raw) => {
    localStorage.setItem(PENDING_LEVEL_RATING_KEY, raw);
    expect(takePendingLevelRating('a')).toBeNull();
    expect(localStorage.getItem(PENDING_LEVEL_RATING_KEY)).toBeNull();
  });

  it('clear removes a stashed vote', () => {
    stashPendingLevelRating({ seriesId: 'a', level: 'strong' });
    clearPendingLevelRating();
    expect(takePendingLevelRating('a')).toBeNull();
  });
});
