// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { rafflePoolJoinedKey, isRafflePoolJoined, markRafflePoolJoined } from '../raffleSession';

describe('pool joined helper', () => {
  beforeEach(() => window.sessionStorage.clear());
  it('starts false, true after mark, stored under the shared key', () => {
    expect(isRafflePoolJoined()).toBe(false);
    markRafflePoolJoined();
    expect(isRafflePoolJoined()).toBe(true);
    expect(window.sessionStorage.getItem(rafflePoolJoinedKey)).toBe('1');
  });
  it('never throws when storage is blocked', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    try { expect(isRafflePoolJoined()).toBe(false); } finally { Storage.prototype.getItem = orig; }
  });
});
