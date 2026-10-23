/**
 * Invite W2 "Do you also DJ or teach?": tables over role combinations x what is already saved.
 * The question never repeats (claimed or declined roles are not asked); a Yes sends ONLY the
 * minimum keys that differ; an answer that changes nothing sends nothing.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  ROLE_MINIMUM_REASON, ROLE_QUESTION_REASON_BOTH, ROLE_QUESTION_REASON_ONE, listFromText, minimumPatch,
  roleQuestionBlock, rolesToAsk, saveRoleAnswers, type RoleQuestionWriters,
} from '../roleQuestion';

describe('rolesToAsk: every combination of claimed x declined', () => {
  it.each([
    [[], [], ['teacher', 'dj']],
    [['dancer', 'organiser'], [], ['teacher', 'dj']],
    [['teacher'], [], ['dj']],
    [['dj'], [], ['teacher']],
    [['teacher', 'dj'], [], []],
    [[], ['teacher'], ['dj']],
    [[], ['dj'], ['teacher']],
    [[], ['teacher', 'dj'], []],
    [['teacher'], ['dj'], []],
    [['dj'], ['teacher'], []],
  ])('roles %j, declined %j -> asks %j', (roles, declined, want) => {
    expect(rolesToAsk({ roles, declined })).toEqual(want);
  });
});

describe('roleQuestionBlock', () => {
  const dj = { dj_name: 'DJ Ana', genres: 'Bachata' };
  it.each([
    ['both unanswered', ['teacher', 'dj'], {}, ROLE_QUESTION_REASON_BOTH],
    ['one of two answered', ['teacher', 'dj'], { teacher: { yes: false, fields: {} } }, ROLE_QUESTION_REASON_BOTH],
    ['the only one unanswered', ['dj'], {}, ROLE_QUESTION_REASON_ONE],
    ['both No', ['teacher', 'dj'], { teacher: { yes: false, fields: {} }, dj: { yes: false, fields: {} } }, null],
    ['DJ Yes, no name', ['dj'], { dj: { yes: true, fields: { genres: 'Bachata' } } }, ROLE_MINIMUM_REASON],
    ['DJ Yes, no music', ['dj'], { dj: { yes: true, fields: { dj_name: 'DJ Ana', genres: ' , ' } } }, ROLE_MINIMUM_REASON],
    ['DJ Yes, both filled', ['dj'], { dj: { yes: true, fields: dj } }, null],
    ['teacher Yes, no style', ['teacher'], { teacher: { yes: true, fields: {} } }, ROLE_MINIMUM_REASON],
    ['teacher Yes with a style, DJ No', ['teacher', 'dj'], { teacher: { yes: true, fields: { teaching_styles: 'Sensual' } }, dj: { yes: false, fields: {} } }, null],
  ] as const)('%s', (_l, asked, answers, want) => {
    expect(roleQuestionBlock(asked, answers)).toBe(want);
  });
});

describe('minimumPatch: changed keys only', () => {
  it.each([
    ['nothing saved yet (DJ)', 'dj', { dj_name: ' DJ Ana ', genres: 'Bachata, Kizomba, Bachata' }, {}, { dj_name: 'DJ Ana', genres: ['Bachata', 'Kizomba'] }],
    ['name already saved the same', 'dj', { dj_name: 'DJ Ana', genres: 'Bachata' }, { dj_name: 'DJ Ana', genres: [] }, { genres: ['Bachata'] }],
    ['genre already saved', 'dj', { dj_name: 'DJ Ana', genres: 'Bachata' }, { dj_name: 'DJ Ana', genres: ['Bachata'] }, {}],
    ['adds to saved genres, never drops one', 'dj', { dj_name: 'DJ Ana', genres: 'Kizomba' }, { dj_name: 'DJ Ana', genres: ['Bachata'] }, { genres: ['Bachata', 'Kizomba'] }],
    ['teacher styles from nothing', 'teacher', { teaching_styles: 'Sensual' }, {}, { teaching_styles: ['Sensual'] }],
    ['teacher styles already there', 'teacher', { teaching_styles: 'sensual' }, { teaching_styles: ['sensual'] }, {}],
  ] as const)('%s', (_l, role, fields, current, want) => {
    expect(minimumPatch(role, fields, current)).toEqual(want);
  });

  it('listFromText trims, drops blanks and repeats', () => {
    expect(listFromText(' a, ,b ,a')).toEqual(['a', 'b']);
  });
});

function writers(details: Record<string, Record<string, unknown>> = {}, doYouWrites = 1): RoleQuestionWriters & Record<string, ReturnType<typeof vi.fn>> {
  return {
    answerDoYou: vi.fn(async () => doYouWrites),
    fetchDetails: vi.fn(async (r: string) => details[r] ?? {}),
    saveMyRole: vi.fn(async () => ({})),
  };
}

describe('saveRoleAnswers', () => {
  it('No to both: two Yes/No writes, no role save, no details read', async () => {
    const w = writers();
    await saveRoleAnswers(['teacher', 'dj'], { teacher: { yes: false, fields: {} }, dj: { yes: false, fields: {} } }, w);
    expect(w.answerDoYou.mock.calls).toEqual([['teacher', false], ['dj', false]]);
    expect(w.fetchDetails).not.toHaveBeenCalled();
    expect(w.saveMyRole).not.toHaveBeenCalled();
  });

  it('Yes DJ: the Yes first, then the minimum with only the changed keys', async () => {
    const w = writers({ dj: { dj_name: 'DJ Ana', genres: [] } });
    await saveRoleAnswers(['dj'], { dj: { yes: true, fields: { dj_name: 'DJ Ana', genres: 'Bachata' } } }, w);
    expect(w.answerDoYou.mock.calls).toEqual([['dj', true]]);
    expect(w.saveMyRole.mock.calls).toEqual([['dj', { genres: ['Bachata'] }]]);
  });

  it('an answer the server already holds sends nothing', async () => {
    const w = writers({ teacher: { teaching_styles: ['Sensual'] } }, 0);
    const n = await saveRoleAnswers(['teacher'], { teacher: { yes: true, fields: { teaching_styles: 'Sensual' } } }, w);
    expect(n).toBe(0);
    expect(w.saveMyRole).not.toHaveBeenCalled();
  });
});

// ---- A1's teacher / DJ go-live entries (additive to the dancer / organiser ones) ----------------
import { parseGoLiveCheck } from '@/modules/organiser/shared/goLiveCheck';
import { goLiveGaps } from '../goLiveModel';
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
