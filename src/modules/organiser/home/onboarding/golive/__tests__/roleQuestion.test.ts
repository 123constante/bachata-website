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

// ---- "It's live" offer --------------------------------------------------------------------------
import { readDoneState } from '@/modules/organiser/flows/doneState';
import { offerRoles } from '../roleQuestion';

describe("It's live offer", () => {
  it.each([
    [null, {}, []],
    [{ roles: ['dancer', 'organiser'], declined: [] }, {}, []],
    [{ roles: ['dj'], declined: [] }, {}, ['dj']],
    [{ roles: [], declined: [] }, { teacher: { yes: true, fields: {} } }, ['teacher']],
    [{ roles: ['dj'], declined: [] }, { teacher: { yes: true, fields: {} } }, ['teacher', 'dj']],
    [{ roles: [], declined: [] }, { teacher: { yes: false, fields: {} }, dj: { yes: false, fields: {} } }, []],
  ] as const)('intent %j, answers %j -> %j', (intent, answers, want) => {
    expect(offerRoles(intent as never, answers as never)).toEqual(want);
  });

  it('router state keeps only known roles, teacher first; none -> no offer key', () => {
    expect(readDoneState({ title: 't', message: 'm', offer: ['dj', 'venue', 'teacher'] })?.offer).toEqual(['teacher', 'dj']);
    expect(readDoneState({ title: 't', message: 'm', offer: [] })).not.toHaveProperty('offer');
    expect(readDoneState({ title: 't', message: 'm', offer: 'dj' })).not.toHaveProperty('offer');
  });
});
