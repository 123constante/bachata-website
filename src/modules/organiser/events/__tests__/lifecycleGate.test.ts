/**
 * The rollback switch on the server-checked Go live (A-WEB1a merged with main #869): with the A1 gate OFF the
 * card still says the platform update is pending; with it ON it never does, and what is missing is the server's
 * series_go_live_check_v1 list. (The real constant is true on prod.)
 */
import { describe, expect, it } from 'vitest';
import { A1_REASON, goLiveState } from '../lifecycleModel';
import type { GoLiveCheck } from '@/modules/organiser/shared/goLiveCheck';

const S = 'series-1';
const unlocked = { locked: false, reason: null };
const notReady: GoLiveCheck = {
  ready: false,
  eventMissing: [{ code: 'venue', section: 'venue' }],
  recommended: [],
  profileRuleApplies: false,
  profileMissing: [],
};

describe('goLiveState gate', () => {
  it('OFF: names the platform update', () => {
    const s = goLiveState(notReady, S, unlocked, false);
    expect(s.kind).toBe('a1');
    expect(s.kind === 'a1' ? s.reason : '').toContain(A1_REASON);
  });
  it('ON: never names the platform update; a missing item blocks it (fix, with the count)', () => {
    const s = goLiveState(notReady, S, unlocked, true);
    expect(s.kind).toBe('fix');
    expect(JSON.stringify(s)).not.toContain(A1_REASON);
  });
  it('ON with no check loaded: sends (the server refusal lists what is missing)', () => {
    expect(goLiveState(undefined, S, unlocked, true)).toEqual({ kind: 'send' });
  });
});
