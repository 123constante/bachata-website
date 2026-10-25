/**
 * RELEASE-A-WEB fix pass, finding 8 (test gap found by mutation): every key
 * parseGoLiveCheck reads refuses a bad shape. A `ready: "false"` string read
 * as truthy would send Go live; each row keeps the OTHER keys valid so the one
 * bad key is the only reason to refuse.
 */
import { describe, expect, it } from 'vitest';
import { parseGoLiveCheck } from '../goLiveCheck';

const ORG = 'org00000-0000-4000-8000-000000000001';
const GOOD = {
  ready: false,
  event_missing: [{ code: 'venue', section: 'venue' }],
  recommended: [{ code: 'ticket_link', section: 'tickets' }],
  profile_rule_applies: true,
  profile_missing: [{ area: 'dancer', organiser_id: null, fields: ['photo'] }, { area: 'organiser', organiser_id: ORG, fields: ['logo'] }],
};
const BAD = 'go_live_bad_shape';

describe('parseGoLiveCheck: one bad key, the rest valid', () => {
  it('the good shape parses (the baseline every row changes one key of)', () => {
    expect(parseGoLiveCheck(GOOD)).toEqual({
      ready: false,
      eventMissing: [{ code: 'venue', section: 'venue' }],
      recommended: [{ code: 'ticket_link', section: 'tickets' }],
      profileRuleApplies: true,
      profileMissing: [{ area: 'dancer', organiserId: null, fields: ['photo'] }, { area: 'organiser', organiserId: ORG, fields: ['logo'] }],
    });
  });

  const rows: Array<[name: string, over: Record<string, unknown>]> = [
    ['ready "false" (string)', { ready: 'false' }],
    ['ready "true" (string)', { ready: 'true' }],
    ['ready 1', { ready: 1 }],
    ['ready missing', { ready: undefined }],
    ['event_missing not an array', { event_missing: {} }],
    ['event_missing item without section', { event_missing: [{ code: 'venue' }] }],
    ['event_missing item with a numeric code', { event_missing: [{ code: 3, section: 'venue' }] }],
    ['event_missing item null', { event_missing: [null] }],
    ['recommended not an array', { recommended: 'ticket_link' }],
    ['recommended item without section', { recommended: [{ code: 'ticket_link' }] }],
    ['profile_rule_applies "true" (string)', { profile_rule_applies: 'true' }],
    ['profile_rule_applies missing', { profile_rule_applies: undefined }],
    ['profile_missing not an array', { profile_missing: null }],
    ['profile_missing with a bad area (teacher and dj are A1 areas now)', { profile_missing: [{ area: 'venue', organiser_id: null, fields: ['bio'] }] }],
    ['profile_missing with no area', { profile_missing: [{ organiser_id: ORG, fields: ['bio'] }] }],
    ['profile_missing organiser_id a number', { profile_missing: [{ area: 'organiser', organiser_id: 7, fields: ['bio'] }] }],
    ['profile_missing fields not an array', { profile_missing: [{ area: 'organiser', organiser_id: ORG, fields: 'bio' }] }],
    ['profile_missing fields with a non-string', { profile_missing: [{ area: 'organiser', organiser_id: ORG, fields: ['bio', 2] }] }],
  ];
  it.each(rows)('%s -> bad shape', (_n, over) => {
    expect(() => parseGoLiveCheck({ ...GOOD, ...over })).toThrow(BAD);
  });

  it.each([['null', null], ['an array', [GOOD]], ['a string', 'ready'], ['a number', 1]])('the answer is %s -> bad shape', (_n, raw) => {
    expect(() => parseGoLiveCheck(raw)).toThrow(BAD);
  });
});
