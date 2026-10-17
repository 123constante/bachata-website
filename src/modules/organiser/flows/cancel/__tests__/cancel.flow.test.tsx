// @vitest-environment jsdom
/**
 * S3 Cancel a date (plan 4.5, boards C11 -> C12 -> C13 -> Done, D61): ONE
 * occurrence.cancel {cancelled:true, reason} through occurrence_command_p5 on
 * the DATE with the date's own version (the S2 amendment); the Done screen has
 * exactly two buttons and "Put it back" sends ONE occurrence.cancel
 * {cancelled:false} (D46) and lands on Done again; C12 lists scheduled dates
 * only; WARN_DATE is imported by exactly ONE file (D31, D40).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const REASONS = vi.hoisted(() => [{ key: 'venue_closed', label: 'Venue closed' }, { key: 'bank_holiday', label: 'Bank holiday' }, { key: 'other', label: 'Other' }]);
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: REASONS, error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import CancelFlow from '../index';
import Done from '@/modules/organiser/flows/Done';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { VERSION_CONFLICT, WARN_DATE } from '@/modules/organiser/shared/copy';
import { RESTORE_CAP_NOTE } from '../cancelModel';
import { A, AFTER, BEFORE, FROZEN, GONE, PAST, answer, commandsOf, comingRun, day, defaultWorld, flush, line75, mount, series, tooSmall, type World } from '../../add/__tests__/fixtures';

const ROOT = resolve(__dirname, '../../../../../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

let world: World;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  rpc.mockReset();
  world = defaultWorld();
  // The server flips the date: a cancel marks it cancelled, a put-back scheduled, each a new version.
  world.command = (fn, env) => {
    const e = env as { target_id: string; command: { kind: string; payload: { cancelled?: boolean } } };
    const o = Object.values(world.occs).flat().find((x) => x.id === e.target_id);
    if (fn === 'occurrence_command_p5' && o && e.command.kind === 'occurrence.cancel') {
      o.status = e.command.payload.cancelled ? 'cancelled' : 'scheduled';
      o.version += 1;
    }
    return { data: { ok: true, new_version: o?.version ?? 1 }, error: null };
  };
  answer(rpc, () => world);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const routes = (
  <>
    <Route path="/account/o/cancel" element={<CancelFlow step="event" />} />
    <Route path="/account/o/cancel/:seriesId" element={<CancelFlow step="date" />} />
    <Route path="/account/o/cancel/:seriesId/:occurrenceId" element={<CancelFlow step="confirm" />} />
    <Route path="/account/o/done" element={<Done />} />
  </>
);
const where = () => screen.getByTestId('where').textContent;

describe('C11 which event', () => {
  it('lists live events with a coming scheduled date only', async () => {
    mount(ORG_PATHS.cancel, routes);
    const names = within(await screen.findByTestId('cancel-which-event')).getAllByTestId('cancel-event-row').map((r) => r.textContent ?? '');
    expect(names).toHaveLength(2);
    expect(names[0]).toContain('Friday Social');
    expect(names[1]).toContain('Sunday Class');
  });

  it('the one-event organiser skips to that event\'s dates (D34)', async () => {
    world.series = [world.series[0], world.series[2]]; // + a draft, which cannot be cancelled
    mount(ORG_PATHS.cancel, routes);
    await waitFor(() => expect(where()).toBe(ORG_PATHS.cancelEvent(A)));
  });
});

describe('C12 which date', () => {
  it('lists coming SCHEDULED dates only (not the past one, not the cancelled one)', async () => {
    mount(ORG_PATHS.cancelEvent(A), routes);
    const rows = within(await screen.findByTestId('cancel-which-date')).getAllByTestId('cancel-date-row');
    expect(rows.map((r) => r.textContent ?? '')).toEqual([expect.stringContaining('Friday 23 October'), expect.stringContaining('Friday 30 October')]);
    fireEvent.click(rows[1]);
    await waitFor(() => expect(where()).toBe(ORG_PATHS.cancelDate(A, AFTER)));
  });

  it('an all-cancelled event shows "No dates to cancel" with the ONE action "Add a date"', async () => {
    world.occs[A].forEach((o) => { o.status = 'cancelled'; });
    world.series[0] = series(A, 'Friday Social', world.occs[A]);
    mount(ORG_PATHS.cancelEvent(A), routes);
    const empty = await screen.findByTestId('cancel-which-date');
    expect(empty.textContent).toContain('No dates to cancel');
    const buttons = within(empty).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe('Add a date');
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(where()).toBe(ORG_PATHS.addEvent(A)));
  });
});

describe('C13 confirm, then ONE command; Done with Put it back (D61)', () => {
  it('shows the D31 line, a quiet Keep it and the gold Cancel this date; every control >= 44px', async () => {
    const { container } = mount(ORG_PATHS.cancelDate(A, AFTER), routes);
    const screenEl = await screen.findByTestId('cancel-confirm');
    expect(screenEl.textContent).toContain(WARN_DATE);
    expect(screenEl.textContent).toContain('Friday 30 October');
    expect(screen.getByTestId('cancel-keep').textContent).toBe('Keep it');
    expect(screen.getByTestId('cancel-send').textContent).toBe('Cancel this date');
    expect(tooSmall(container)).toEqual([]);
    fireEvent.click(screen.getByTestId('cancel-keep'));
    await waitFor(() => expect(where()).toBe(ORG_PATHS.cancelEvent(A)));
    expect(commandsOf(rpc)).toHaveLength(0);
  });

  it('cancel sends ONE occurrence.cancel on the date with its own version; the reason is optional ("Other" when none is picked)', async () => {
    mount(ORG_PATHS.cancelDate(A, AFTER), routes);
    fireEvent.click(await screen.findByTestId('cancel-send'));
    expect(await screen.findByTestId('org-done-message')).toBeTruthy();
    expect(screen.getByTestId('org-done-message').textContent).toBe('Cancelled - Friday 30 October');
    const sent = commandsOf(rpc);
    expect(sent).toHaveLength(1);
    expect(sent[0].fn).toBe('occurrence_command_p5');
    expect(sent[0].env.target_id).toBe(AFTER);
    expect(sent[0].env.expected_version).toBe(6);
    expect(sent[0].env.command).toEqual({ kind: 'occurrence.cancel', payload: { cancelled: true, reason: 'Other' } });
  });

  it('a picked reason travels as its label', async () => {
    mount(ORG_PATHS.cancelDate(A, BEFORE), routes);
    fireEvent.click(await screen.findByRole('button', { name: 'Venue closed' }));
    fireEvent.click(screen.getByTestId('cancel-send'));
    await screen.findByTestId('org-done-message');
    expect(commandsOf(rpc)[0].env.command.payload).toEqual({ cancelled: true, reason: 'Venue closed' });
  });

  it('the Done screen has exactly two buttons; Put it back sends ONE uncancel and lands on Done again', async () => {
    mount(ORG_PATHS.cancelDate(A, AFTER), routes);
    fireEvent.click(await screen.findByTestId('cancel-send'));
    const done = await screen.findByTestId('org-done');
    const buttons = within(done).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Back to Home', 'Put it back']);
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(screen.getByTestId('org-done-message').textContent).toBe('Back on - Friday 30 October'));
    await flush();
    const sent = commandsOf(rpc);
    expect(sent).toHaveLength(2);
    expect(sent[1].fn).toBe('occurrence_command_p5');
    expect(sent[1].env.target_id).toBe(AFTER);
    expect(sent[1].env.expected_version).toBe(7);
    expect(sent[1].env.command).toEqual({ kind: 'occurrence.cancel', payload: { cancelled: false } });
    // The put-back Done is final: one button, Home.
    expect(within(screen.getByTestId('org-done')).getAllByRole('button').map((b) => b.textContent)).toEqual(['Back to Home']);
  });

  it('a past date is refused with eventState.ts:75 verbatim and sends nothing', async () => {
    mount(ORG_PATHS.cancelDate(A, PAST), routes);
    expect((await screen.findByTestId('cancel-refusal')).textContent).toContain(line75(read));
    expect(screen.queryByTestId('cancel-send')).toBeNull();
    await flush();
    expect(commandsOf(rpc)).toHaveLength(0);
  });

  it('an already-cancelled date offers Put it back instead of a second cancel', async () => {
    mount(ORG_PATHS.cancelDate(A, GONE), routes);
    expect(await screen.findByTestId('cancel-already')).toBeTruthy();
    expect(screen.queryByTestId('cancel-send')).toBeNull();
  });

  it('version_conflict shows the R3-7 line with one way to the event', async () => {
    world.command = () => ({ data: null, error: { message: 'version_conflict: expected 6 got 7' } });
    mount(ORG_PATHS.cancelDate(A, AFTER), routes);
    fireEvent.click(await screen.findByTestId('cancel-send'));
    const box = await screen.findByTestId('cancel-conflict');
    expect(box.textContent).toContain(VERSION_CONFLICT);
    expect(within(box).getAllByRole('button')).toHaveLength(1);
  });
});

// B1: the server caps an UN-cancel at 30 coming scheduled dates (date_cap). Prod 2026-10-17:
// 27 of 67 live series hold 30+, the smallest 47, so a put back there is always refused.
describe.each([
  { shape: 'the default series (2 coming)', run: 0, offered: true },
  { shape: '29 coming after the cancel', run: 28, offered: true },
  { shape: '30 coming after the cancel', run: 29, offered: false },
  { shape: '47 coming (the smallest prod at-cap series)', run: 45, offered: false },
])('Put it back with $shape', ({ run, offered }) => {
  beforeEach(() => {
    // Day 30 on, clear of the default dates; the cancelled one (GONE) never counts.
    world.occs[A] = [...world.occs[A], ...comingRun(run, 30)];
    world.series[0] = series(A, 'Friday Social', world.occs[A]);
  });

  it(offered ? 'Done offers Put it back after a cancel' : 'Done offers no Put it back after a cancel', async () => {
    mount(ORG_PATHS.cancelDate(A, AFTER), routes);
    fireEvent.click(await screen.findByTestId('cancel-send'));
    const done = await screen.findByTestId('org-done');
    expect(within(done).getAllByRole('button').map((b) => b.textContent)).toEqual(offered ? ['Back to Home', 'Put it back'] : ['Back to Home']);
  });

  it(offered ? 'an already-cancelled date can be put back' : 'an already-cancelled date shows Put it back disabled with the reason; a tap sends nothing', async () => {
    world.occs[A] = world.occs[A].filter((o) => o.id !== AFTER); // so the count is the same as after the cancel above
    world.series[0] = series(A, 'Friday Social', world.occs[A]);
    mount(ORG_PATHS.cancelDate(A, GONE), routes);
    const box = await screen.findByTestId('cancel-already');
    const button = screen.getByTestId('cancel-put-back');
    expect(button.getAttribute('aria-disabled')).toBe(offered ? null : 'true');
    expect((box.textContent ?? '').includes(RESTORE_CAP_NOTE)).toBe(!offered);
    fireEvent.click(button);
    await flush();
    expect(commandsOf(rpc)).toHaveLength(offered ? 1 : 0);
  });

  it(offered ? 'the put-back link sends ONE uncancel' : 'the put-back link (a stale Done) sends nothing', async () => {
    world.occs[A] = world.occs[A].filter((o) => o.id !== AFTER);
    world.series[0] = series(A, 'Friday Social', world.occs[A]);
    mount(`${ORG_PATHS.cancelDate(A, GONE)}?put=back`, routes);
    if (offered) await screen.findByTestId('org-done');
    else await screen.findByTestId('cancel-already');
    await flush();
    expect(commandsOf(rpc)).toHaveLength(offered ? 1 : 0);
  });
});

describe('refusals and retries on the cancel writes (S2)', () => {
  it('a cancel retry after a lost reply reuses its idempotency key; the error line shows between', async () => {
    const base = world.command;
    let n = 0;
    world.command = (fn, env) => (n++ === 0 ? { data: null, error: { message: 'network' } } : base(fn, env));
    mount(ORG_PATHS.cancelDate(A, AFTER), routes);
    fireEvent.click(await screen.findByTestId('cancel-send'));
    expect(await screen.findByTestId('cancel-error-message')).toBeTruthy();
    fireEvent.click(screen.getByTestId('cancel-send'));
    await screen.findByTestId('org-done');
    const sent = commandsOf(rpc);
    expect(sent).toHaveLength(2);
    expect(sent[1].env.idempotency_key).toBe(sent[0].env.idempotency_key);
  });

  it('a put-back retry after a lost reply reuses its idempotency key', async () => {
    const base = world.command;
    let n = 0;
    world.command = (fn, env) => (n++ === 0 ? { data: null, error: { message: 'network' } } : base(fn, env));
    mount(ORG_PATHS.cancelDate(A, GONE), routes);
    fireEvent.click(await screen.findByTestId('cancel-put-back'));
    expect(await screen.findByTestId('cancel-error-message')).toBeTruthy();
    fireEvent.click(screen.getByTestId('cancel-put-back'));
    await screen.findByTestId('org-done');
    const sent = commandsOf(rpc);
    expect(sent).toHaveLength(2);
    expect(sent[1].env.idempotency_key).toBe(sent[0].env.idempotency_key);
  });

  const DATE_CAP = 'permission_denied: date_cap: this series already has 47 upcoming dates (cap 30); remove or cancel one before restoring another';

  it('a date_cap refusal of Put it back (C13 button) says why in restore words, not the add-date copy', async () => {
    world.command = () => ({ data: null, error: { message: DATE_CAP } });
    mount(ORG_PATHS.cancelDate(A, GONE), routes);
    fireEvent.click(await screen.findByTestId('cancel-put-back'));
    const line = await screen.findByTestId('cancel-error-message');
    expect(line.textContent).toBe(RESTORE_CAP_NOTE);
    expect(line.textContent).not.toContain('No new date can be added');
  });

  it('a date_cap refusal of Put it back (from Done) says why in restore words, not the add-date copy', async () => {
    world.command = () => ({ data: null, error: { message: DATE_CAP } });
    mount(`${ORG_PATHS.cancelDate(A, GONE)}?put=back`, routes);
    const line = await screen.findByTestId('cancel-error-message');
    expect(line.textContent).toBe(RESTORE_CAP_NOTE);
    expect(commandsOf(rpc)).toHaveLength(1);
  });
});

describe('WARN_DATE (D31, D40)', () => {
  it('is imported by exactly ONE file: the cancel confirm', () => {
    const MODULE = resolve(ROOT, 'src/modules/organiser');
    const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return n === '__tests__' ? [] : files(p);
      return /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
    const sites = files(MODULE)
      .filter((p) => !p.endsWith('shared/copy.ts'))
      .filter((p) => /import\s*\{[^}]*\bWARN_DATE\b[^}]*\}\s*from/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(MODULE, p).replace(/\\/g, '/'));
    expect(sites).toEqual(['flows/cancel/Confirm.tsx']);
  });
});
