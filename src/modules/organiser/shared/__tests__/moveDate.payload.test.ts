import { describe, expect, it } from 'vitest';
import { moveDateCommand } from '../seriesCommands';
import { selfServeErrorCopy, commandErrorMessage } from '../selfServeErrors';
import { MOVE_PEOPLE_COPY, moveNoticesOf, moveOutcomeCopy, peopleCountsOf } from '../../p3/model';
import { PLAN } from '../../p3/data/dates';

describe('moveDateCommand payload', () => {
  it('default is byte-identical to before', () => {
    expect(JSON.stringify(moveDateCommand('2026-11-20'))).toBe('{"kind":"occurrence.move_date","payload":{"to_date":"2026-11-20"}}');
    expect(moveDateCommand('2026-11-20', false)).toEqual({ kind: 'occurrence.move_date', payload: { to_date: '2026-11-20' } });
  });
  it('carries acknowledge_people: true only when asked', () => {
    expect(moveDateCommand('2026-11-20', true).payload).toEqual({ to_date: '2026-11-20', acknowledge_people: true });
  });
  it('PLAN.move passes the flag through', () => {
    const d = { id: 'o1', version: 2, occurrence_date: '2026-11-13' } as never;
    expect(JSON.stringify(PLAN.move(d, '2026-11-20'))).not.toContain('acknowledge');
    expect(JSON.stringify(PLAN.move(d, '2026-11-20', true))).toContain('"acknowledge_people":true');
  });
});

describe('date_has_people copy for any other caller', () => {
  it('has plain copy, never raw text', () => {
    expect(commandErrorMessage({ message: 'date_has_people: 3 guest list' })).toBe('Some people are on this date. Open the date and confirm the move to go ahead.');
    expect(selfServeErrorCopy({ message: 'x' }).message).not.toMatch(/date_has_people/);
  });
});

describe('people counts and outcome copy', () => {
  it.each([
    ['details object', { message: 'date_has_people:', details: { guest_list: 1, going: 2, tickets: 3, total: 6 } }, { guest_list: 1, going: 2, tickets: 3, total: 6 }],
    ['details string', { message: 'date_has_people:', details: '{"guest_list":0,"going":2,"tickets":0,"total":2}' }, { guest_list: 0, going: 2, tickets: 0, total: 2 }],
    ['message only', { message: 'date_has_people: 4 2 1' }, { guest_list: 4, going: 2, tickets: 1, total: 7 }],
    ['garbled details', { message: 'date_has_people: 1 1 1', details: '{oops' }, { guest_list: 1, going: 1, tickets: 1, total: 3 }],
    ['nothing', { message: 'date_has_people: there are people' }, null],
  ])('%s', (_n, err, want) => expect(peopleCountsOf(err)).toEqual(want));

  const counts = [
    ['guest list only', { guest_list: 2, going: 0, tickets: 0, total: 2 }, '2 people are on this date', '2 on the guest list'],
    ['going only', { guest_list: 0, going: 3, tickets: 0, total: 3 }, '3 people are on this date', '3 going'],
    ['tickets only', { guest_list: 0, going: 0, tickets: 4, total: 4 }, '4 people are on this date', '4 with tickets'],
    ['all three', { guest_list: 1, going: 2, tickets: 3, total: 6 }, '6 people are on this date', '1 on the guest list, 2 going and 3 with tickets'],
    ['singular', { guest_list: 1, going: 0, tickets: 0, total: 1 }, '1 person is on this date', '1 on the guest list'],
  ] as const;
  it.each(counts)('%s', (_n, c, title, body) => {
    expect(MOVE_PEOPLE_COPY.title(c.total)).toBe(title);
    expect(MOVE_PEOPLE_COPY.body(c)).toBe(body);
  });

  it('outcome copy: with and without notices', () => {
    expect(moveOutcomeCopy(undefined).confirm).toBe('They are not told automatically. Tell them yourself.');
    expect(moveOutcomeCopy(null).done).toBe('Moved. Tell the people on it yourself: they are not told automatically.');
    expect(moveOutcomeCopy({ queued: 5, guest_list_unreached: 0 }).done).toBe('Moved. We emailed 5 people about the new date.');
    expect(moveOutcomeCopy({ queued: 5, guest_list_unreached: 2 }).done).toBe('Moved. We emailed 5 people about the new date. 2 guest-list people have no contact details, so please tell them yourself.');
    expect(moveOutcomeCopy({ queued: 1, guest_list_unreached: 1 }).done).toBe('Moved. We emailed 1 person about the new date. 1 guest-list person has no contact details, so please tell them yourself.');
  });
  it('reads notices from the reply top level or data', () => {
    expect(moveNoticesOf({ ok: true })).toBeNull();
    expect(moveNoticesOf({ notices: { queued: 2, guest_list_unreached: 0 } })).toEqual({ queued: 2, guest_list_unreached: 0 });
    expect(moveNoticesOf({ data: { notices: { queued: 1 } } })).toEqual({ queued: 1, guest_list_unreached: 0 });
  });
});
