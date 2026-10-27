import { describe, expect, it } from 'vitest';
import { L } from '../labels';
import {
  PROGRAMME_WHY, dateStateOf, programmeRules, scopeWhy, shownControls,
  type ProgrammeControl, type ProgrammeFacts, type Scope, type SessionDateState,
} from '../programme';
import type { P3Kind } from '../types';
import { COMMAND_COPY, commandErrorMessage, programmeErrorCopy } from '../../../shared/selfServeErrors';

/*
 * W2d: the ONE rule set (model/programme.ts), table-driven over
 * kind {recurring (weekly), course, one-off, festival} x scope {every, just this}
 * x date {coming, today, past, cancelled} x the session {new, stored, added to the
 * date, not running on it} x the reader's verdict, plus the gate and the lifecycle.
 * Each cell: which controls are SHOWN, which are on, and every greyed one has a
 * plain reason that never points at a control the sheet does not draw.
 */

const KINDS: P3Kind[] = ['weekly', 'course', 'oneoff', 'festival'];
const SCOPES: Scope[] = ['every', 'date'];
const STATES: SessionDateState[] = ['coming', 'today', 'past', 'cancelled'];
type ItemShape = 'new' | 'stored' | 'extra' | 'notRunning';
const ITEMS: ItemShape[] = ['new', 'stored', 'extra', 'notRunning'];

const itemOf = (s: ItemShape): ProgrammeFacts['item'] =>
  s === 'new' ? null : { extra: s === 'extra', notRunning: s === 'notRunning', stored: true };

function facts(kind: P3Kind, scope: Scope, state: SessionDateState, it: ItemShape, extra: Partial<ProgrammeFacts> = {}): ProgrammeFacts {
  return { kind, lifecycle: 'live', gate: true, scope, date: { state, editable: state === 'coming' || state === 'today', notEditableReason: null }, item: itemOf(it), ...extra };
}

/** Every reason the rule set can give: plain words, no codes. */
const REASONS = new Set<string>(Object.values(PROGRAMME_WHY));

const ALL: ProgrammeControl[] = ['save', 'kind', 'add', 'removeAll', 'removeOne', 'notRunning', 'lineup'];

describe('programmeRules x every kind x scope x date x session', () => {
  for (const kind of KINDS) for (const scope of SCOPES) for (const state of STATES) for (const sh of ITEMS) {
    const f = facts(kind, scope, state, sh);
    it(`${kind} / ${scope} / ${state} / ${sh}`, () => {
      const r = programmeRules(f);
      const shown = shownControls(scope, f.item);
      // every reason is a known plain sentence
      for (const c of ALL) if (r[c] !== null) expect(REASONS.has(r[c] as string)).toBe(true);
      // festival: everything greyed with "Ask us", in both scopes (the programme is the team's)
      if (kind === 'festival') {
        for (const c of ALL) expect(r[c]).toBe(L.festivalAsk);
        return;
      }
      const dateOff = scope === 'date' && (state === 'past' || state === 'cancelled');
      if (dateOff) {
        for (const c of shown) expect(r[c]).toBe(state === 'past' ? PROGRAMME_WHY.past : PROGRAMME_WHY.cancelled);
        return;
      }
      // a live, writable scope: the shown controls are on, save for the session-shape rules
      for (const c of shown) {
        const expected =
          c === 'kind' && scope === 'date' && sh !== 'new' ? (sh === 'extra' ? PROGRAMME_WHY.kindExisting : PROGRAMME_WHY.kindOneDate)
          : c === 'kind' && scope === 'every' && sh === 'extra' ? PROGRAMME_WHY.everyOnly
          : (c === 'save' || c === 'lineup') && scope === 'every' && sh === 'extra' ? PROGRAMME_WHY.everyOnly
          : c === 'removeAll' && sh === 'extra' ? PROGRAMME_WHY.extraOnly
          : null;
        expect([c, r[c]]).toEqual([c, expected]);
      }
      // the shown set: no control from the other scope is drawn
      if (scope === 'every') expect(shown).not.toContain('notRunning');
      if (scope === 'date') expect(shown).not.toContain('removeAll');
      if (sh === 'notRunning' && scope === 'date') expect(shown).toEqual(['notRunning']);
      if (sh === 'extra' && scope === 'date') expect(shown).toContain('removeOne');
      if (sh === 'new') expect(shown).toEqual(['kind', 'save']);
    });
  }
});

describe('scope-wide reasons', () => {
  it('the gate greys every Every-date control with its reason, and leaves Just this date alone', () => {
    const r = programmeRules(facts('weekly', 'every', 'coming', 'stored', { gate: false }));
    for (const c of ALL) expect(r[c]).toBe(PROGRAMME_WHY.gate);
    expect(programmeRules(facts('weekly', 'date', 'coming', 'stored', { gate: false })).save).toBeNull();
  });
  it.each(['ended', 'archived'])('a %s event: everything greyed, both scopes', (lifecycle) => {
    for (const scope of SCOPES) expect(scopeWhy(facts('weekly', scope, 'coming', 'stored', { lifecycle }))).toBe(PROGRAMME_WHY.ended);
  });
  it.each([
    ['multi_day', PROGRAMME_WHY.multiDay], ['series_closed', PROGRAMME_WHY.ended], ['date_cancelled', PROGRAMME_WHY.cancelled], ['past_date', PROGRAMME_WHY.past],
  ])('the per-date reader says %s: greyed with its plain reason', (reason, why) => {
    expect(scopeWhy({ ...facts('weekly', 'date', 'coming', 'stored'), date: { state: 'coming', editable: false, notEditableReason: reason } })).toBe(why);
  });
  it('while the date programme loads, Just-this-date controls wait (never enabled on a guess)', () => {
    expect(scopeWhy({ ...facts('weekly', 'date', 'coming', 'stored'), date: { state: 'coming' } })).toBe(PROGRAMME_WHY.loading);
  });
  it('no date coming up: Just this date has nothing to act on', () => {
    expect(scopeWhy({ ...facts('weekly', 'date', 'coming', 'stored'), date: null })).toBe(PROGRAMME_WHY.noDate);
  });
  it('dateStateOf: cancelled wins; past / today / coming by London day', () => {
    expect(dateStateOf('2026-10-20', true, '2026-10-25')).toBe('cancelled');
    expect(dateStateOf('2026-10-20', false, '2026-10-25')).toBe('past');
    expect(dateStateOf('2026-10-25', false, '2026-10-25')).toBe('today');
    expect(dateStateOf('2026-10-30', false, '2026-10-25')).toBe('coming');
  });
  it('the one reason that names another control names one the sheet always draws (the scope picker)', () => {
    expect(PROGRAMME_WHY.everyScope).toContain('Every date above');
    expect(PROGRAMME_WHY.kindOneDate).toContain('Every date');
  });
});

/** Every programme refusal the server sends maps to plain copy, never its text and never the catch-all. */
describe('every programme refusal -> plain words', () => {
  const generic = commandErrorMessage(new Error('zzz unknown'));
  it.each([
    ['permission_denied: removing the session "Social" would delete its per-date changes on 3 dates', 'Social'],
    ['permission_denied: removing the session "" would delete its per-date changes', 'One of the sessions'],
    ['invalid_payload: this programme save carries no ids but the series has per-date changes; reload the editor and save again', 'Reload the page'],
    ['invalid_payload: a programme id does not belong to this series', 'Reload the page'],
    ['permission_denied: festival programmes are admin-only', 'Ask us'],
    ['invalid_payload: series.set_program day_index must be a whole number', 'Reload the page'],
    ['version_conflict: expected 7 got 8', ''],
  ])('every date: %s', (msg, part) => {
    const out = commandErrorMessage(Object.assign(new Error(msg), { message: msg }));
    expect(out).not.toBe(msg);
    expect(out).not.toBe(generic);
    expect(out).toContain(part);
  });
  it.each([
    ['version_conflict', true],
    ['permission_denied: changing the programme on a past date is admin-only', true],
    ['permission_denied: changing the programme on a cancelled date is not allowed', true],
    ['permission_denied: changing the programme on a multi-day event is not supported', true],
    ['permission_denied: changing the programme on an ended or archived series is admin-only', true],
    ['invalid_payload: session 2 people_remove names a person who is not on that session', true],
  ])('just this date: %s', (msg, reload) => {
    const c = programmeErrorCopy({ message: msg });
    expect(c.message).not.toBe(msg);
    expect(c.message).not.toMatch(/permission_denied|invalid_payload|version_conflict/);
    expect(c.reload).toBe(reload);
  });
  it('the festival and set_program rows sit before the loose rules (anchored first-match)', () => {
    const i = COMMAND_COPY.findIndex((c) => c.match.source.includes('festival programmes'));
    const loose = COMMAND_COPY.findIndex((c) => c.match.source.includes('on a past date is admin-only'));
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(loose);
  });
});
