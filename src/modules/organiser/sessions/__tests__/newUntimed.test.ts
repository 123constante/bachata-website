// ER-FIX2-S5, owner click: NO untimed NEW sessions (both times required when adding);
// a stored untimed session stays valid (decision 3; prod 223 untimed items).
import { describe, expect, it } from 'vitest';
import { blockingIssues, newSession, type SessionDraft } from '../sessionsModel';

const stored = (over: Partial<SessionDraft> = {}): SessionDraft => ({ ...newSession('party', '21:00', 'st1'), name: 'Party', ...over });

describe('a new session needs both times', () => {
  it.each([
    ['new, untimed', [], [{ ...newSession('class', '19:00', 'n1'), name: 'Class', start: '', end: '' }], ['start']],
    ['new, timed', [], [{ ...newSession('class', '19:00', 'n1'), name: 'Class' }], []],
    ['stored untimed, untouched', [stored({ start: '', end: '' })], [stored({ start: '', end: '' })], []],
    ['stored untimed, renamed', [stored({ start: '', end: '' })], [stored({ start: '', end: '', name: 'Late party' })], []],
    ['stored timed, made untimed (the way back, F-C4-2)', [stored()], [stored({ start: '', end: '' })], []],
  ] as const)('%s', (_n, initial, current, codes) => {
    expect(blockingIssues(initial as SessionDraft[], current as SessionDraft[]).map((i) => i.code)).toEqual(codes);
  });
});
