import { describe, expect, it } from 'vitest';
import { londonWeekday, parseReminder, reminderView, type ReminderRead } from '../reminderModel';

const base: ReminderRead = {
  enabled: true, sendAt: '2026-11-19T18:00:00Z', buyerCount: 12, sentAt: null, sentCount: 0,
  windowPassed: false, nightCancelled: false, nightLive: true, canEdit: true,
};
const MOJIBAKE = /[ÂÃâ][\u0080-¿€™‚-›]/;

// every night shape the screen meets x the state it must show
const SHAPES: [string, Partial<ReminderRead>, { on: boolean; why: boolean; has: RegExp }][] = [
  ['far future, buyers', {}, { on: true, why: false, has: /^Sends 18:00 on Thursday to 12 buyers\. Sent once\.$/ }],
  ['tomorrow, one buyer', { buyerCount: 1 }, { on: true, why: false, has: /to 1 buyer\./ }],
  ['no tickets yet', { buyerCount: 0 }, { on: true, why: false, has: /^Will send to everyone who has a ticket by 18:00 on Thursday/ }],
  ['sold out (many buyers)', { buyerCount: 300 }, { on: true, why: false, has: /300 buyers/ }],
  ['switched off', { enabled: false }, { on: false, why: false, has: /^Off/ }],
  ['already sent', { sentAt: '2026-11-19T18:00:05Z', sentCount: 9, windowPassed: true }, { on: true, why: true, has: /^Sent to 9 buyers at 18:00 on Thursday\.$/ }],
  ['sent to one', { sentAt: '2026-11-19T18:00:05Z', sentCount: 1, windowPassed: true }, { on: true, why: true, has: /Sent to 1 buyer at/ }],
  ['today / window passed, on', { windowPassed: true }, { on: true, why: true, has: /has passed/ }],
  ['past night, off', { windowPassed: true, enabled: false }, { on: false, why: true, has: /has passed/ }],
  ['cancelled night', { nightCancelled: true }, { on: false, why: true, has: /^No reminder will go out\.$/ }],
  ['event not live', { nightLive: false }, { on: true, why: true, has: /until the event is live/ }],
  ['helper role, cannot edit', { canEdit: false }, { on: true, why: true, has: /^Sends/ }],
];

describe('reminderView matrix', () => {
  it.each(SHAPES)('%s', (_n, patch, want) => {
    const v = reminderView({ ...base, ...patch });
    expect(v.on).toBe(want.on);
    expect(!!v.disabledWhy).toBe(want.why);
    expect(v.line).toMatch(want.has);
    expect(v.line + (v.disabledWhy ?? '')).not.toMatch(MOJIBAKE);
  });
  it('uses London weekday across the DST change', () => {
    expect(londonWeekday('2026-03-28T18:00:00Z')).toBe('Saturday');
    expect(londonWeekday('2026-10-24T17:00:00Z')).toBe('Saturday');
    expect(londonWeekday(null)).toBeNull();
  });
});

describe('parseReminder', () => {
  it('refusals carry the reason', () => expect(parseReminder({ ok: false, reason: 'not_allowed' })).toEqual({ ok: false, reason: 'not_allowed' }));
  it('garbage is a refusal', () => expect(parseReminder(null).ok).toBe(false));
  it('reads the server shape', () => {
    const p = parseReminder({ ok: true, enabled: false, send_at: 'x', buyer_count: 3, sent_at: null, sent_count: 0, window_passed: false, night_cancelled: false, night_live: true, can_edit: true });
    expect(p.ok && p.read.buyerCount).toBe(3);
    expect(p.ok && p.read.enabled).toBe(false);
  });
});
