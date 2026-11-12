// @vitest-environment jsdom
// Table-driven: every screen (night row chip, sheet story, button) x every shape of docs/briefs/profile-dash-organiser-raffle-rpc-reference.md.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ live: true, rpc: vi.fn() }));
vi.mock('@/lib/featureFlags', async (orig) => ({ ...(await orig<object>()), flags: new Proxy({}, { get: (_t, k) => (k === 'organiserRaffleLive' ? h.live : false) }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));

import { NightSheet } from '../../EventsView';
import { RaffleSheet } from '../RaffleSheet';
import { chipWord, closesAt, drawnLine, gate, nightOnDate, parseRead, parseSet, stepOf, type RaffleNight } from '../raffleModel';
import type { Night } from '../../eventsModel';

const night: Night = { key: 'k', seriesId: 's1', name: 'Sensual Fridays', date: '2026-11-13', dayLabel: 'Friday 13 November', sub: 'Tonight, 9pm', status: 'live', cancel: { ok: true, why: null }, canEdit: true, canDelete: false, moreDates: 0, openId: 's1' } as unknown as Night;

const row = (over: Record<string, unknown> = {}) => ({
  occurrence_id: 'o1', date: '2026-11-13', start_local: '2026-11-13T21:00:00', chip: 'closed', raffle_on: false, night_override: null,
  entries_count: 0, locked: false, winner: null, can_set: true, refuse_reason: null, ...over,
});
const read = (n: Record<string, unknown>, over: Record<string, unknown> = {}) => ({ ok: true, series_id: 's1', series_raffle_enabled: true, role: 'owner', can_edit: true, view_only_reason: null, nights: [n], ...over });

const SHAPES: Array<{ name: string; data: unknown; chip: string; story: RegExp; button: string | null; enabled?: boolean; track: number }> = [
  { name: 'off, nobody', data: read(row()), chip: 'Raffle off', story: /Raffle off/, button: 'Open a raffle', enabled: true, track: -1 },
  { name: 'open, no entries', data: read(row({ chip: 'open', raffle_on: true })), chip: 'Raffle open', story: /Nobody has entered yet/, button: 'Close the raffle', enabled: true, track: 0 },
  { name: '23 entered (locked)', data: read(row({ chip: 'locked', raffle_on: true, entries_count: 23, locked: true, can_set: false, refuse_reason: 'locked' })), chip: 'Raffle locked · 23', story: /23 entered, locked/, button: 'Message us to cancel', enabled: true, track: 1 },
  { name: '41 closed', data: read(row({ chip: 'past', entries_count: 41, can_set: false, refuse_reason: 'past' })), chip: 'Entries closed · 41', story: /We draw the winner from our side/, button: null, track: 2 },
  { name: 'drawn', data: read(row({ chip: 'drawn', entries_count: 41, winner: { first_name: 'Ana', drawn_at: '2026-11-14T10:30:00Z', locked_at: null, state: 'locked', entries_at_draw: 41 }, can_set: false, refuse_reason: 'past' })), chip: 'Winner drawn', story: /Winner drawn/, button: null, track: 3 },
  { name: 'past, nobody entered', data: read(row({ chip: 'past', can_set: false, refuse_reason: 'past' })), chip: 'No raffle', story: /Nobody entered before it closed/, button: null, track: -1 },
  { name: 'cancelled', data: read(row({ chip: 'cancelled', can_set: false, refuse_reason: 'cancelled' })), chip: 'No raffle', story: /cancelled, so it has no raffle/, button: null, track: -1 },
  { name: 'draft', data: read(row({ chip: 'draft', can_set: false, refuse_reason: 'draft' })), chip: 'No raffle', story: /Put the night live first/, button: null, track: -1 },
  { name: 'contributor, off', data: read(row(), { role: 'contributor', can_edit: false, view_only_reason: 'ask an owner' }), chip: 'Raffle off', story: /Raffle off/, button: 'Open a raffle', enabled: false, track: -1 },
  { name: 'contributor, open', data: read(row({ chip: 'open', raffle_on: true, can_set: false }), { role: 'contributor', can_edit: false, view_only_reason: 'ask an owner' }), chip: 'Raffle open', story: /Nobody has entered yet/, button: 'Close the raffle', enabled: false, track: 0 },
];

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

afterEach(cleanup);
beforeEach(() => { h.live = true; h.rpc.mockReset(); });

describe('screen x shape', () => {
  for (const s of SHAPES) {
    it(`${s.name}: night row chip, sheet story, button, track`, async () => {
      h.rpc.mockResolvedValue({ data: s.data, error: null });
      const onRaffle = vi.fn();
      wrap(<NightSheet night={night} onClose={vi.fn()} onCancel={vi.fn()} onDelete={vi.fn()} onRaffle={onRaffle} openTo="/x" />);
      expect((await screen.findByTestId('raffle-chip')).textContent).toBe(s.chip);
      cleanup();
      wrap(<RaffleSheet night={night} onClose={vi.fn()} />);
      await screen.findByTestId('raffle-sheet');
      expect(screen.getByTestId('raffle-story').textContent).toMatch(s.story);
      expect(Number(screen.queryByTestId('raffle-track')?.getAttribute('data-step') ?? -1)).toBe(s.track);
      const b = screen.queryByTestId('raffle-button') as HTMLButtonElement | null;
      if (s.button === null) expect(b).toBeNull();
      else {
        expect(b?.textContent).toBe(s.button);
        expect(b?.disabled).toBe(!s.enabled);
        if (!s.enabled) expect(screen.getByTestId('raffle-why').textContent).toMatch(/ask an owner/);
      }
      expect(h.rpc.mock.calls.every((c) => c[0] === 'organiser_raffle_nights_v1')).toBe(true); // opening a sheet never writes
    });
  }

  it('drawn shows winner first name, draw time, entries count', async () => {
    h.rpc.mockResolvedValue({ data: SHAPES[4].data, error: null });
    wrap(<RaffleSheet night={night} onClose={vi.fn()} />);
    await screen.findByTestId('raffle-facts');
    expect(screen.getByTestId('raffle-fact-winner').textContent).toBe('Ana');
    expect(screen.getByTestId('raffle-fact-entered').textContent).toBe('41 entered');
    expect(screen.getByTestId('raffle-fact-drawn').textContent).toBe('Sat 14 Nov, 10:30am');
  });

  it('drawn on a pre-snapshot win (entries_at_draw null, wins with no occurrence id) still reads', async () => {
    h.rpc.mockResolvedValue({ data: read(row({ chip: 'drawn', winner: { first_name: null, drawn_at: null, locked_at: null, state: 'locked', entries_at_draw: null }, can_set: false })), error: null });
    wrap(<RaffleSheet night={night} onClose={vi.fn()} />);
    await screen.findByTestId('raffle-facts');
    expect(screen.getByTestId('raffle-fact-entered').textContent).toBe('Not recorded');
    expect(screen.getByTestId('raffle-fact-winner').textContent).toBe('Name not shown');
    expect(screen.getByTestId('raffle-fact-drawn').textContent).toBe('Time not recorded');
  });

  it('50+ nights: the right night is found by date', async () => {
    const many = Array.from({ length: 53 }, (_, i) => row({ occurrence_id: `o${i}`, date: `2027-01-${String((i % 28) + 1).padStart(2, '0')}`, chip: 'open', raffle_on: true }));
    const r = parseRead(read(row(), { nights: [...many, row({ occurrence_id: 'target', chip: 'locked', entries_count: 135, locked: true })] }));
    expect(r.kind === 'ok' && nightOnDate(r.read, '2026-11-13')?.occurrenceId).toBe('target');
    expect(r.kind === 'ok' && r.read.nights).toHaveLength(54);
  });
});

describe('Coming soon (flag off)', () => {
  it('shows the card with a way to tell us and calls no RPC', () => {
    h.live = false;
    wrap(<NightSheet night={night} onClose={vi.fn()} onCancel={vi.fn()} onDelete={vi.fn()} onRaffle={vi.fn()} openTo="/x" />);
    expect(screen.getByTestId('raffle-soon').textContent).toMatch(/Coming soon/);
    fireEvent.click(screen.getByTestId('raffle-soon-tell'));
    expect(screen.getByTestId('raffle-msg-none') || screen.getByTestId('raffle-msg')).toBeTruthy(); // no support env in tests: says so, never a dead link
    expect(screen.queryByTestId('raffle-row')).toBeNull();
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe('write: confirmation both ways, failure, retry', () => {
  const open = async (shape: number) => {
    h.rpc.mockResolvedValue({ data: SHAPES[shape].data, error: null });
    wrap(<RaffleSheet night={night} onClose={vi.fn()} />);
    await screen.findByTestId('raffle-sheet');
  };
  const writes = () => h.rpc.mock.calls.filter((c) => c[0] === 'organiser_raffle_night_set_v1');

  it('tapping the button only opens the confirmation: nothing is sent; Not now sends nothing', async () => {
    await open(0);
    fireEvent.click(screen.getByTestId('raffle-button'));
    expect(screen.getByTestId('raffle-confirm').textContent).toMatch(/Once anyone enters, you cannot close it here/);
    expect(writes()).toHaveLength(0);
    fireEvent.click(screen.getByTestId('raffle-confirm-keep'));
    expect(writes()).toHaveLength(0);
  });

  it('open: confirm sends enabled true for that night, then re-reads', async () => {
    await open(0);
    h.rpc.mockImplementation(async (fn: string) => fn === 'organiser_raffle_night_set_v1' ? { data: { ok: true, night: row({ chip: 'open', raffle_on: true }) }, error: null } : { data: SHAPES[1].data, error: null });
    fireEvent.click(screen.getByTestId('raffle-button'));
    fireEvent.click(screen.getByTestId('raffle-confirm-go'));
    await waitFor(() => expect(screen.getByTestId('raffle-sheet').getAttribute('data-chip')).toBe('open'));
    expect(writes()).toEqual([['organiser_raffle_night_set_v1', { p_occurrence_id: 'o1', p_enabled: true }]]);
  });

  it('close: the red confirmation says nobody is told; confirm sends enabled false', async () => {
    await open(1);
    h.rpc.mockImplementation(async (fn: string) => fn === 'organiser_raffle_night_set_v1' ? { data: { ok: true, night: row() }, error: null } : { data: SHAPES[0].data, error: null });
    fireEvent.click(screen.getByTestId('raffle-button'));
    expect(screen.getByTestId('raffle-confirm').textContent).toMatch(/Nobody has entered, so nobody is told/);
    fireEvent.click(screen.getByTestId('raffle-confirm-go'));
    await waitFor(() => expect(screen.getByTestId('raffle-sheet').getAttribute('data-chip')).toBe('closed'));
    expect(writes()[0][1]).toEqual({ p_occurrence_id: 'o1', p_enabled: false });
  });

  it('a network failure says Nothing changed and Try again goes back to the confirmation (never a silent resend)', async () => {
    await open(0);
    h.rpc.mockImplementation(async (fn: string) => fn === 'organiser_raffle_night_set_v1' ? { data: null, error: { message: 'boom' } } : { data: SHAPES[0].data, error: null });
    fireEvent.click(screen.getByTestId('raffle-button'));
    fireEvent.click(screen.getByTestId('raffle-confirm-go'));
    expect((await screen.findByTestId('raffle-failed')).textContent).toMatch(/Nothing changed/);
    expect(writes()).toHaveLength(1);
    const again = screen.getByTestId('raffle-button');
    expect(again.textContent).toBe('Try again');
    fireEvent.click(again);
    expect(screen.getByTestId('raffle-confirm')).toBeTruthy();
    expect(writes()).toHaveLength(1);
  });

  it('locked while closing (someone just entered): says so, no Try again', async () => {
    await open(1);
    h.rpc.mockImplementation(async (fn: string) => fn === 'organiser_raffle_night_set_v1' ? { data: { ok: false, reason: 'locked' }, error: null } : { data: SHAPES[2].data, error: null });
    fireEvent.click(screen.getByTestId('raffle-button'));
    fireEvent.click(screen.getByTestId('raffle-confirm-go'));
    expect((await screen.findByTestId('raffle-failed')).textContent).toMatch(/Someone just entered/);
    await waitFor(() => expect(screen.getByTestId('raffle-button').getAttribute('data-action')).toBe('message'));
  });

  it('locked: the button is Message us to cancel and never writes', async () => {
    await open(2);
    fireEvent.click(screen.getByTestId('raffle-button'));
    expect(screen.queryByTestId('raffle-confirm')).toBeNull();
    expect(writes()).toHaveLength(0);
  });
});

describe('read failures', () => {
  it('error: Nothing was changed + Try again re-reads', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    wrap(<RaffleSheet night={night} onClose={vi.fn()} />);
    expect((await screen.findByTestId('raffle-sheet-error')).textContent).toMatch(/Nothing was changed/);
    h.rpc.mockResolvedValue({ data: SHAPES[0].data, error: null });
    fireEvent.click(screen.getByTestId('raffle-sheet-retry'));
    await screen.findByTestId('raffle-sheet');
  });
  it('a refusal (not_authorised) is told as ask an owner, no retry', async () => {
    h.rpc.mockResolvedValue({ data: { ok: false, reason: 'not_authorised' }, error: null });
    wrap(<RaffleSheet night={night} onClose={vi.fn()} />);
    expect((await screen.findByTestId('raffle-sheet-error')).textContent).toMatch(/Ask an owner/);
    expect(screen.queryByTestId('raffle-sheet-retry')).toBeNull();
  });
});

describe('model', () => {
  const n = (over: Partial<RaffleNight> = {}): RaffleNight => ({ occurrenceId: 'o', date: 'd', startLocal: null, chip: 'closed', raffleOn: false, entries: 0, locked: false, winner: null, canSet: true, refuseReason: null, ...over });
  it('closing time is 2 hours before the start', () => {
    expect(closesAt('2026-11-13T21:00:00')).toBe('7pm');
    expect(closesAt('2026-11-13T20:30:00')).toBe('6:30pm');
    expect(closesAt('2026-11-13T01:00:00')).toBe('11pm');
    expect(closesAt(null)).toBeNull();
  });
  it('drawnLine is London time and null on junk', () => {
    expect(drawnLine('2026-07-14T10:30:00Z')).toBe('Tue 14 Jul, 11:30am');
    expect(drawnLine('nope')).toBeNull();
  });
  it('unknown chip rows are dropped, not guessed', () => {
    const r = parseRead(read(row(), { nights: [row({ chip: 'weird' }), row()] }));
    expect(r.kind === 'ok' && r.read.nights).toHaveLength(1);
  });
  it('a contributor can never get an enabled open/close', () => {
    for (const chip of ['open', 'closed'] as const) expect(gate(n({ chip }), { canEdit: false, viewOnlyReason: 'ask an owner' }).enabled).toBe(false);
  });
  it('every chip has a word and a step in range', () => {
    for (const chip of ['draft', 'cancelled', 'past', 'drawn', 'locked', 'open', 'closed'] as const) { expect(chipWord(n({ chip }))).toBeTruthy(); expect(stepOf(n({ chip }))).toBeGreaterThanOrEqual(-1); }
  });
  it('parseSet reads ok and refusals; junk throws', () => {
    expect(parseSet({ ok: false, reason: 'locked' })).toMatchObject({ kind: 'refused', reason: 'locked' });
    expect(parseSet({ ok: true, night: row() }).kind).toBe('ok');
    expect(() => parseSet(null)).toThrow();
  });
});
