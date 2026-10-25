/**
 * Invite W2: series_go_live_check_v1 with A1's teacher / DJ entries (agreed keys: teacher `teaching_styles`;
 * dj `dj_name`, `dj_genres`), additive to the dancer / organiser ones. Tables over role combinations x
 * missing keys: each gap reads as words and links to that role's editor; a role-only list fixes there.
 */
import { describe, expect, it } from 'vitest';
import { parseGoLiveCheck } from '@/modules/organiser/shared/goLiveCheck';
import { goLiveGaps } from '@/modules/organiser/home/onboarding/golive/goLiveModel';
import { profileFixPath } from '@/modules/organiser/events/lifecycleModel';
import { DEFAULT_AREA_PATHS } from '@/modules/areas/shared/paths';

const check = (profile_missing: unknown[]) => parseGoLiveCheck({ ready: false, event_missing: [], recommended: [], profile_rule_applies: true, profile_missing });

describe('go-live check with teacher / DJ entries: role combinations x missing keys', () => {
  it.each([
    ['DJ name + genres', [{ area: 'dj', organiser_id: null, fields: ['dj_name', 'dj_genres'] }], ['Your DJ page: add your DJ name', 'Your DJ page: add the music you play'], DEFAULT_AREA_PATHS.dj.profile],
    ['DJ genres only', [{ area: 'dj', organiser_id: null, fields: ['dj_genres'] }], ['Your DJ page: add the music you play'], DEFAULT_AREA_PATHS.dj.profile],
    ['teacher styles', [{ area: 'teacher', organiser_id: null, fields: ['teaching_styles'] }], ['Your teacher page: add the styles you teach'], DEFAULT_AREA_PATHS.teacher.profile],
    ['teacher then DJ', [{ area: 'teacher', organiser_id: null, fields: ['teaching_styles'] }, { area: 'dj', organiser_id: null, fields: ['dj_name'] }], ['Your teacher page: add the styles you teach', 'Your DJ page: add your DJ name'], null],
    ['an unknown role key still reads as words', [{ area: 'dj', organiser_id: null, fields: ['dj_photo'] }], ['Your DJ page: add your dj photo'], DEFAULT_AREA_PATHS.dj.profile],
  ] as const)('%s', (_l, missing, texts, fix) => {
    const c = check([...missing]);
    const gaps = goLiveGaps(c, 's1', 'org-1');
    expect(gaps.map((g) => g.text)).toEqual(texts);
    for (const g of gaps) {
      const role = g.key.split(':')[0] as 'teacher' | 'dj';
      expect(g.href?.startsWith(DEFAULT_AREA_PATHS[role].profile)).toBe(true);
    }
    if (fix) expect(profileFixPath(c)).toBe(fix);
    else expect(profileFixPath(c)).not.toMatch(/^\/account\/(dj|teacher)/);
  });

  it('a role entry mixed with an organiser entry fixes the page first (the wizard)', () => {
    const c = check([{ area: 'organiser', organiser_id: 'org-1', fields: ['category'] }, { area: 'dj', organiser_id: null, fields: ['dj_name'] }]);
    expect(profileFixPath(c)).toContain('o=org-1');
  });

  it('an area the website does not know is still a bad shape', () => {
    expect(() => check([{ area: 'venue', organiser_id: null, fields: ['x'] }])).toThrow('go_live_bad_shape');
  });
});

