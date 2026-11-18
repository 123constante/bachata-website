/*
 * Slice 5: the "Reminder to buyers" row on the One night screen. Pure model: the server payload of
 * organiser_night_reminder_get_v1 / _set_v1 and the one mapping from that payload to what the row says.
 */
export type ReminderRead = {
  enabled: boolean;
  sendAt: string | null;
  buyerCount: number;
  sentAt: string | null;
  sentCount: number;
  windowPassed: boolean;
  nightCancelled: boolean;
  nightLive: boolean;
  canEdit: boolean;
};

export type ReminderParse = { ok: true; read: ReminderRead } | { ok: false; reason: string };

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

export function parseReminder(raw: unknown): ReminderParse {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (r.ok !== true) return { ok: false, reason: typeof r.reason === 'string' ? r.reason : 'unknown' };
  return {
    ok: true,
    read: {
      enabled: r.enabled !== false,
      sendAt: str(r.send_at),
      buyerCount: num(r.buyer_count),
      sentAt: str(r.sent_at),
      sentCount: num(r.sent_count),
      windowPassed: r.window_passed === true,
      nightCancelled: r.night_cancelled === true,
      nightLive: r.night_live !== false,
      canEdit: r.can_edit === true,
    },
  };
}

/** Full weekday name of an instant, in London time (the send is 18:00 London). */
export function londonWeekday(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'Europe/London' }).format(d);
}

export const buyersWord = (n: number): string => (n === 1 ? '1 buyer' : `${n} buyers`);

export type ReminderView = {
  /** Second line under the label. */
  line: string;
  /** Switch position as shown. */
  on: boolean;
  /** When set the switch cannot be used, and this says why. */
  disabledWhy: string | null;
};

export function reminderView(r: ReminderRead): ReminderView {
  const day = londonWeekday(r.sendAt);
  const at = day ? `18:00 on ${day}` : '18:00 the day before';
  if (r.nightCancelled) return { line: 'This night is cancelled — no reminder will go out.', on: false, disabledWhy: 'This night is cancelled' };
  if (r.sentAt) {
    const sentDay = londonWeekday(r.sentAt) ?? day;
    return { line: `Sent to ${buyersWord(r.sentCount)} at 18:00 on ${sentDay ?? 'the day before'}.`, on: true, disabledWhy: 'Already sent — it is sent once' };
  }
  if (r.windowPassed) {
    return { line: `The send time (${at}) has passed, so nothing will be sent.`, on: r.enabled, disabledWhy: 'The send time has passed' };
  }
  if (!r.nightLive) return { line: 'No reminder goes out until the event is live.', on: r.enabled, disabledWhy: 'The event is not live' };
  const why = r.canEdit ? null : 'Only owners and managers can change this';
  if (!r.enabled) return { line: 'Off — nothing will be sent for this night.', on: false, disabledWhy: why };
  if (r.buyerCount === 0) return { line: `Will send to everyone who has a ticket by ${at}. Sent once.`, on: true, disabledWhy: why };
  return { line: `Sends ${at} to ${buyersWord(r.buyerCount)}. Sent once.`, on: true, disabledWhy: why };
}
