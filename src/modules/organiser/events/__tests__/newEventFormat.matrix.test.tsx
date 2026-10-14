// @vitest-environment jsdom
/**
 * W1: the New event page asks the name and the FORMAT, nothing else. The matrix is
 * 4 cards x {selectable, disabled + reason} x {name empty, duplicate, unique} x
 * {online, lost reply, refused, city lookup fail}, plus the one-selected-state rule
 * (#750 walk) and the duplicate note's statuses (d32). Red-first against main and the
 * mutants it kills: docs/handover/event-creation-w1.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { home } from './fixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c-edinburgh' }) }));
vi.mock('@/modules/organiser/shared/createCity', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/modules/organiser/shared/createCity')>();
  return { ...real, resolveCreateCityId: vi.fn(real.resolveCreateCityId) };
});

import { resolveCreateCityId } from '@/modules/organiser/shared/createCity';
import NewEventPage from '../NewEventPage';
import { duplicateNamed } from '../newEvent';
import { FORMAT_CARDS, FORMAT_HINT, SELECTABLE_FORMATS, TEAM_SETS_UP, formatHint } from '../eventType';

type Handler = (args: Record<string, unknown>) => unknown;
let handlers: Record<string, Handler>;
type Env = { command: { kind: string; payload: Record<string, unknown> } } & Record<string, unknown>;
const envelopes = () => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5').map(([, a]) => (a as { p_envelope: Env }).p_envelope);
const ok: Handler = () => ({ ok: true, new_version: 4 });

// Prod shapes (survey in the handover): an organiser's live, paused, draft and archived series;
// two live/paused series of one organiser can share a name.
const SERIES = [
  { id: 's1', name: 'Friday Party', lifecycle_status: 'live', upcoming_count: 2, next_dates: [] },
  { id: 's3', name: 'Sunday Social', lifecycle_status: 'paused', upcoming_count: 0, next_dates: [] },
  { id: 's2', name: 'Autumn Party', lifecycle_status: 'draft', upcoming_count: 0, next_dates: [] },
  { id: 's4', name: 'Old Night', lifecycle_status: 'archived', upcoming_count: 0, next_dates: [] },
];

beforeEach(() => {
  handlers = { organiser_home_v1: () => home(SERIES), series_command_p5: ok };
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    const h = handlers[fn];
    if (!h) return { data: null, error: { message: `unexpected ${fn}` } };
    try { return { data: await h(args), error: null }; } catch (e) { return { data: null, error: e }; }
  });
});
afterEach(cleanup);

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

async function mountNew() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/events/new']}>
        <Routes>
          <Route path="/account/o/events/new" element={<NewEventPage />} />
          <Route path="*" element={<span />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByTestId('org-new-event-form');
}
const card = (id: string) => screen.getByTestId(`org-new-event-format-${id}`) as HTMLButtonElement;
const nameInput = () => screen.getByTestId('org-new-event-name') as HTMLInputElement;
const typeName = (v: string) => fireEvent.change(nameInput(), { target: { value: v } });
const create = () => fireEvent.click(screen.getByTestId('org-new-event-create'));
const errorText = () => screen.queryByTestId('org-new-event-error')?.textContent ?? null;

const NAMES = {
  empty: '',
  duplicate: '  friday PARTY ',
  unique: 'Tuesday Class',
} as const;
type NameCase = keyof typeof NAMES;
const OUTCOMES = ['online', 'lost reply', 'refused', 'city lookup fail'] as const;
type Outcome = (typeof OUTCOMES)[number];

function arrange(outcome: Outcome) {
  if (outcome === 'lost reply') handlers.series_command_p5 = () => { throw new TypeError('fetch failed'); };
  if (outcome === 'refused') handlers.series_command_p5 = () => { throw { message: 'invalid_payload: name refused', code: 'P0001' }; };
  if (outcome === 'city lookup fail') vi.mocked(resolveCreateCityId).mockRejectedValueOnce(new TypeError('fetch failed'));
}

describe('the four format cards', () => {
  it('shows One-off, Recurring, Course, Festival in that order; only the first two are selectable', async () => {
    await mountNew();
    expect(FORMAT_CARDS.map((c) => c.id)).toEqual(['one_off', 'recurring', 'course', 'festival']);
    for (const c of FORMAT_CARDS) {
      expect(card(c.id).textContent).toContain(c.label);
      expect(card(c.id).disabled).toBe(c.disabledReason !== null);
    }
    expect(SELECTABLE_FORMATS.map((c) => c.id)).toEqual(['one_off', 'recurring']);
  });

  it.each(['course', 'festival'])('%s is disabled and says why on the card (d33)', async (id) => {
    await mountNew();
    expect(card(id).disabled).toBe(true);
    expect(screen.getByTestId(`org-new-event-format-${id}-reason`).textContent).toBe(TEAM_SETS_UP);
    expect(TEAM_SETS_UP).toBe('Ask the Bachata Calendar team to set this up.');
    fireEvent.click(card(id));
    expect(card(id).getAttribute('data-selected')).toBe('false');
  });

  it('no hint, in any phase, names a disabled card or a session type', () => {
    const hints = [FORMAT_HINT, ...SELECTABLE_FORMATS.map((c) => c.hint)];
    for (const phase of ['open', 'sent', 'made'] as const) for (const busy of [false, true]) for (const blocked of [false, true]) {
      for (const f of [null, 'one_off', 'recurring'] as const) hints.push(formatHint(phase, busy, f, blocked));
    }
    for (const h of hints) expect(h).not.toMatch(/course|festival|class|party|workshop/i);
  });

  it('exactly ONE selected state: picking another card clears the previous card’s selected and focus look (#750 walk)', async () => {
    await mountNew();
    card('one_off').focus();
    fireEvent.click(card('one_off'));
    expect(card('one_off').getAttribute('aria-pressed')).toBe('true');
    card('recurring').focus();
    fireEvent.click(card('recurring'));
    const pressed = FORMAT_CARDS.filter((c) => card(c.id).getAttribute('aria-pressed') === 'true').map((c) => c.id);
    expect(pressed).toEqual(['recurring']);
    expect(card('one_off').getAttribute('data-selected')).toBe('false');
    expect(card('one_off').className).not.toContain('border-[var(--gold)]');
    expect(document.activeElement).toBe(card('recurring'));
    for (const c of FORMAT_CARDS) {
      // No colour transition to linger on the card just left; a ring only for keyboard focus.
      expect(card(c.id).className).not.toMatch(/(^|\s)transition/);
      expect(card(c.id).className).not.toMatch(/(^|\s)focus:/);
    }
  });
});

describe('the duplicate-name note (d32): quiet, never blocks', () => {
  it.each([
    ['live, other case and spaces', '  friday PARTY ', 's1'],
    ['paused', 'sunday social', 's3'],
    ['draft does not count', 'Autumn Party', null],
    ['archived does not count', 'Old Night', null],
    ['unique', 'Tuesday Class', null],
    ['empty', '   ', null],
  ])('%s', async (_label, name, id) => {
    await mountNew();
    typeName(name);
    const note = screen.queryByTestId('org-new-event-duplicate');
    if (id === null) { expect(note).toBeNull(); return; }
    expect(note?.textContent).toContain('You already have an event called');
    expect(screen.getByTestId('org-new-event-duplicate-open').getAttribute('href')).toBe(`/account/o/events/${id}`);
    expect((screen.getByTestId('org-new-event-create') as HTMLButtonElement).disabled).toBe(false);
  });

  it('two live or paused matches: the note names one, deterministically', () => {
    const twin = [{ id: 'b', name: 'Salsa', lifecycle_status: 'live' }, { id: 'a', name: 'salsa', lifecycle_status: 'paused' }];
    expect(duplicateNamed('SALSA', twin)?.id).toBe(duplicateNamed('salsa', [...twin].reverse())?.id);
  });
});

describe('matrix: card x name x outcome', () => {
  const rows = SELECTABLE_FORMATS.flatMap((c) => (Object.keys(NAMES) as NameCase[]).flatMap((n) => OUTCOMES.map((o) => [c.id, n, o] as const)));

  it.each(rows)('%s / name %s / %s', async (format, nameCase, outcome) => {
    // An empty name never reaches the lookup, so a queued lookup failure would leak into the next case.
    if (nameCase !== 'empty') arrange(outcome);
    await mountNew();
    typeName(NAMES[nameCase]);
    fireEvent.click(card(format));
    expect(screen.queryByTestId('org-new-event-duplicate') !== null).toBe(nameCase === 'duplicate');
    create();

    if (nameCase === 'empty') {
      await waitFor(() => expect(errorText()).toBe('Give your event a name.'));
      expect(envelopes()).toHaveLength(0);
      return;
    }
    if (outcome === 'city lookup fail') {
      await waitFor(() => expect(errorText()).toContain('We could not look up your city; nothing was saved'));
      expect(envelopes()).toHaveLength(0);
      expect(nameInput().disabled).toBe(false);
      expect(card(format).disabled).toBe(false);
      return;
    }
    await waitFor(() => expect(envelopes().length).toBeGreaterThan(0));
    const [first] = envelopes();
    expect(first.command.kind).toBe('series.upsert');
    expect(first.command.payload.format).toBe(format);
    expect(first.command.payload).not.toHaveProperty('category');
    expect(first.command.payload.name).toBe(NAMES[nameCase].trim());

    if (outcome === 'online') {
      await waitFor(() => expect(screen.getByTestId('where').textContent).not.toBe('/account/o/events/new'));
      const [, schedule, ...rest] = envelopes();
      expect(rest).toHaveLength(0);
      if (format === 'one_off') expect(schedule.command).toEqual({ kind: 'series.add_date', payload: { date: '2026-10-15' } });
      else expect(schedule.command).toEqual({ kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [4], end: { kind: 'none' } } });
      // No session is seeded: the organiser adds sessions on the draft (W2).
      expect(rpc.mock.calls.some(([fn]) => fn === 'organiser_set_occurrence_programme_v1')).toBe(false);
      return;
    }
    if (outcome === 'refused') {
      await waitFor(() => expect(errorText()).not.toBeNull());
      // Nothing saved: the form opens again for an edit.
      expect(nameInput().disabled).toBe(false);
      expect(card(format).disabled).toBe(false);
      return;
    }
    // Lost reply: frozen on the create sent, and the resend is byte-identical (same key).
    await waitFor(() => expect(errorText()).toContain('We could not confirm the save'));
    expect(nameInput().disabled).toBe(true);
    for (const c of FORMAT_CARDS) expect(card(c.id).disabled).toBe(true);
    create();
    await waitFor(() => expect(envelopes()).toHaveLength(2));
    expect(envelopes()[1]).toEqual(envelopes()[0]);
  });

  it.each(['course', 'festival'])('a disabled card (%s) never becomes the format: Create asks for one of the two', async (id) => {
    await mountNew();
    typeName(NAMES.unique);
    fireEvent.click(card(id));
    create();
    await waitFor(() => expect(errorText()).toBe('Choose One-off or Recurring.'));
    expect(envelopes()).toHaveLength(0);
  });
});
