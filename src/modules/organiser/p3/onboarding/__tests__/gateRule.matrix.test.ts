import { describe, expect, it } from 'vitest';
import { gateAnswerFrom, heldRefusal } from '../gateRule';
import { isOnboardingRefusal } from '../../../shared/selfServeErrors';
import { refusalFacts } from '../gate';

/**
 * F-12: the client's mirror of _require_onboarding_complete_v1 + _command_target_organisers_p5 (read on prod
 * 2026-11-01). Shapes from the prod survey (counts only): 48 pages with events, 0 finished onboarding; 571 of 758
 * series have no organiser_ids (the server then targets the caller's own pages); 6 series run by 2+ pages.
 */
const page = (id: string, complete: boolean) => ({ id, name: id, complete, missing: complete ? [] : ['org_logo'] });
const st = (over: Record<string, unknown>) => ({ v: 1, gate_on: true, is_admin: false, person: { missing: [] }, organisers: [page('a', false)], ...over });

const ROWS: Array<[string, unknown, string[], string]> = [
  ['flag off', st({ gate_on: false }), ['a'], 'pass'],
  ['admin', st({ is_admin: true }), ['a'], 'pass'],
  ['gate on, the one page unfinished', st({}), ['a'], 'refuse'],
  ['gate on, the one page finished', st({ organisers: [page('a', true)] }), ['a'], 'pass'],
  ['not a member of the event’s pages', st({}), ['z'], 'pass'],
  ['two pages, one finished (any one passes)', st({ organisers: [page('a', false), page('b', true)] }), ['a', 'b'], 'pass'],
  ['two pages, the finished one not on this event', st({ organisers: [page('a', false), page('b', true)] }), ['a'], 'refuse'],
  ['series with no organiser_ids, own page unfinished', st({}), [], 'refuse'],
  ['series with no organiser_ids, one own page finished', st({ organisers: [page('a', false), page('b', true)] }), [], 'pass'],
  ['series with no organiser_ids, no pages at all', st({ organisers: [] }), [], 'pass'],
  ['no status (null)', null, ['a'], 'unknown'],
  ['an old shape without gate_on', { organisers: [] }, ['a'], 'unknown'],
  ['organisers not an array', st({ organisers: null }), ['a'], 'unknown'],
];

describe('gateAnswerFrom: every shape', () => {
  it.each(ROWS)('%s', (_label, raw, targets, want) => {
    expect(gateAnswerFrom(raw, targets).s).toBe(want);
  });
  it('a refusal names the first of the event’s pages the person is on', () => {
    expect(gateAnswerFrom(st({ organisers: [page('x', false), page('a', false)] }), ['a', 'x'])).toEqual({ s: 'refuse', organiserId: 'x' });
  });
  it('the held refusal goes through the ONE refusal mapping (isOnboardingRefusal, refusalFacts)', () => {
    const e = heldRefusal('a');
    expect(isOnboardingRefusal(e)).toBe(true);
    expect(refusalFacts(e)).toEqual({ organiserId: 'a', missing: [] });
  });
});
