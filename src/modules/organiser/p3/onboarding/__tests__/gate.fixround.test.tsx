// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';

/*
 * P3-GATE review fix round (one round, stopping rule). Each block pins one finding of the independent review
 * and was run RED against the first push (e984ac1) before the fix:
 *   1. a refused write never reads "finished" (contributor / status lagging); Continue never points at a page
 *      the person cannot edit;
 *   2. a refusal with no gate host listening, or for a screen the person has left, never opens later;
 *   3. only the topmost sheet answers Escape, and each sheet is named by its own title;
 *   5. Repeat (F-12): the gate sheet waits for Save; a refusal the status read predicts is never sent.
 * Only exports that existed at e984ac1 are used, so the red run measured behaviour, not a missing import.
 */

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, auth: {}, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({
  ...(await orig<typeof import('../../../shared/selfServeApi')>()),
  fetchCancellationReasons: async () => [{ key: 'weather', label: 'Weather' }],
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));

import { closeGate, gatedCopy, getGate, subscribeGate } from '../gate';
import { GateHost } from '../GateHost';
import { gateView } from '../gateModel';
import { Sheet } from '../../screens/Sheet';
import { CancelEventSheet } from '../../screens/CancelEventSheet';
import { EventPage } from '../../screens/EventPage';
import { SHAPES } from '../../screens/__tests__/wsFixtures';

const REFUSAL = { code: 'P0001', message: 'onboarding_incomplete', details: JSON.stringify({ missing: ['nationality'], organiser_id: 'o1' }), hint: 'Finish your details' };
const page = (id: string, missing: string[]) => ({ id, name: id, role: 'owner', lifecycle: 'live', complete: missing.length === 0, missing, about: { done: false, skipped: false } });
const status = (person: string[], orgs: unknown[]) => ({ v: 1, gate_on: true, is_admin: false, complete: false, person: { complete: person.length === 0, missing: person }, organisers: orgs });

beforeEach(() => rpc.mockReset());
afterEach(() => { cleanup(); act(() => closeGate()); });

describe('1. a refused write never reads "finished"', () => {
  it('status caught up to 0 for the refused page: the refusal\u2019s own codes show, Continue to that page', () => {
    const v = gateView(status([], [page('o1', [])]), 'o1', ['nationality']) as { kind: string; rows?: string[]; to?: string };
    expect(v.kind).toBe('left');
    expect(v.rows).toEqual(['Nationality']);
    expect(v.to).toBe('/account/p3/start?o=o1&at=review');
  });
  it('contributor (refused page not theirs), nothing of their own missing: listed, Continue off with a reason', () => {
    const v = gateView(status([], []), 'o1', ['nationality', 'org_logo']) as { kind: string; rows?: string[]; to?: string | null; why?: string | null };
    expect(v.kind).toBe('left');
    expect(v.rows).toEqual(['Nationality', 'Page logo']);
    expect(v.to ?? null).toBeNull();
    expect(v.why).toMatch(/page you don\u2019t run/);
  });
  it('contributor with their own items missing: Continue goes to their own details, never the page they cannot edit', () => {
    const v = gateView(status(['languages'], []), 'o1', ['nationality']) as { kind: string; rows?: string[]; to?: string };
    expect(v.kind).toBe('left');
    expect(v.rows).toEqual(['Languages', 'Nationality']);
    expect(v.to).toBe('/account/p3/you/details');
  });
});

describe('2. no late or wrong-screen opening', () => {
  it('no gate host listening (the person left the P3 frame): a refusal opens nothing', () => {
    expect(gatedCopy(REFUSAL, () => 'x')).toBeNull();
    expect(getGate()).toBeNull();
  });

  it('a write refused after the person moved to another screen does not open the sheet there', async () => {
    let answer: (e: unknown) => void = () => {};
    const send = () => new Promise<never>((_, reject) => { answer = reject; });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/account/p3/events/ser-1']}>
          <Routes>
            <Route path="/account/p3/events/ser-1" element={<><CancelEventSheet name="Party" plan={{ dateId: 'd1', day: 'Saturday 31 October' }} send={send} onDone={() => {}} onClose={() => {}} /><Link to="/account/p3/events" data-testid="away">away</Link></>} />
            <Route path="/account/p3/events" element={<p data-testid="events">Events</p>} />
          </Routes>
          <GateHost fetcher={async () => status(['nationality'], [page('o1', [])])} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Weather' }));
    fireEvent.click(screen.getByTestId('p3-cancel-confirm'));
    fireEvent.click(screen.getByTestId('away'));
    await screen.findByTestId('events');
    await act(async () => { answer(REFUSAL); });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('p3-gate')).toBeNull();
    expect(getGate()).toBeNull();
  });
});

describe('3. stacked sheets', () => {
  it('Escape closes only the topmost sheet, and each dialog is named by its own title', () => {
    const lower = vi.fn();
    const upper = vi.fn();
    render(
      <>
        <Sheet title="Status: Live" onClose={lower}><p>lower</p></Sheet>
        <Sheet title="A few details first" onClose={upper}><p>upper</p></Sheet>
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(upper).toHaveBeenCalledTimes(1);
    expect(lower).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'A few details first' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Status: Live' })).toBeTruthy();
  });
});

describe('5. Repeat (F-12): the gate sheet waits for Save, and a refusal the status read predicts is never sent', () => {
  const statusOf: Record<string, unknown> = {
    'status unknown (read fails)': null,
    'gate on, the page unfinished': status(['nationality'], [page('o1', ['org_logo'])]),
    'gate off': { ...status(['nationality'], [page('o1', ['org_logo'])]), gate_on: false },
  };
  const render5 = (st: unknown, refuse: boolean) => {
    rpc.mockImplementation(async (name: string, args?: { p_envelope?: { command?: { payload?: { dry_run?: boolean } } } }) => {
      if (name === 'admin_event_workspace_p5') return { data: SHAPES.weekly, error: null };
      if (name === 'organiser_onboarding_status_v1') return st === null ? { data: null, error: { message: 'boom' } } : { data: st, error: null };
      if (name === 'series_command_p5') {
        if (refuse) return { data: null, error: REFUSAL };
        const dry = args?.p_envelope?.command?.payload?.dry_run === true;
        return { data: { ok: true, new_version: 8, dry_run: dry, data: { will_add: [], will_remove: [], will_cancel_booked: [], keeps_own_changes: [], next_8: ['2026-10-26'] } }, error: null };
      }
      return { data: [], error: null };
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/account/p3/events/ser-1']}>
          <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
          <GateHost fetcher={async () => status(['nationality'], [page('o1', [])])} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };
  const commands = () => rpc.mock.calls.filter((c) => c[0] === 'series_command_p5').length;
  const saveBtn = () => screen.getByRole('button', { name: /Save the new pattern/ }) as HTMLButtonElement;

  for (const [label, st] of Object.entries(statusOf)) {
    const refuse = label !== 'gate off';
    it(`${label}: two changes, no sheet before Save; Save ${refuse ? 'opens the sheet once' : 'saves'}`, async () => {
      let opens = 0;
      let last: unknown = null;
      const off = subscribeGate(() => { const g = getGate(); if (g && g !== last) opens += 1; last = g; });
      render5(st, refuse);
      fireEvent.click(await screen.findByTestId('p3-open-repeat'));
      await screen.findByTestId('p3-sheet');
      fireEvent.click(screen.getByRole('button', { name: 'Monday' }));
      fireEvent.click(screen.getByRole('button', { name: 'Tuesday' }));
      await waitFor(() => expect(saveBtn().disabled).toBe(false), { timeout: 3000 });
      await new Promise((r) => setTimeout(r, 450));
      // never a sheet before the person taps Save
      expect(screen.queryByTestId('p3-gate')).toBeNull();
      expect(opens).toBe(0);
      // a refusal the status read predicts sends no dry run at all (each refused one is a failed-change row);
      // with no status answer at most ONE refused dry run, then nothing more is asked
      const before = commands();
      expect(before).toBeLessThanOrEqual(label === 'gate on, the page unfinished' ? 0 : label === 'gate off' ? 2 : 1);
      if (refuse) expect(screen.getByTestId('p3-repeat-held')).toBeTruthy();
      fireEvent.click(saveBtn());
      if (refuse) {
        await screen.findByTestId('p3-gate', {}, { timeout: 3000 });
        expect(opens).toBe(1);
        expect(commands()).toBe(before); // Save on a held change sends nothing: the sheet is the answer
      } else {
        await waitFor(() => expect(commands()).toBe(before + 1));
        expect(opens).toBe(0);
      }
      off();
    });
  }
});
