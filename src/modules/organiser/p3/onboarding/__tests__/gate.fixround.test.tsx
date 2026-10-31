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
 *   5. Repeat's dry-run preview opens the gate at most once per sheet.
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

describe('5. Repeat\u2019s dry-run preview opens the gate at most once per sheet', () => {
  it('two draft changes, both refused: one opening', async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === 'admin_event_workspace_p5') return { data: SHAPES.weekly, error: null };
      if (name === 'series_command_p5') return { data: null, error: REFUSAL };
      return { data: [], error: null };
    });
    let opens = 0;
    let last: unknown = null;
    const off = subscribeGate(() => { const g = getGate(); if (g && g !== last) opens += 1; last = g; });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/account/p3/events/ser-1']}>
          <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
          <GateHost fetcher={async () => status(['nationality'], [page('o1', [])])} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByTestId('p3-open-repeat'));
    await screen.findByTestId('p3-sheet');
    fireEvent.click(screen.getByRole('button', { name: 'Monday' }));
    await screen.findByTestId('p3-gate', {}, { timeout: 3000 });
    fireEvent.click(screen.getByTestId('p3-gate-not-now'));
    await waitFor(() => expect(screen.queryByTestId('p3-gate')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Tuesday' }));
    await waitFor(() => expect(rpc.mock.calls.filter((c) => c[0] === 'series_command_p5').length).toBeGreaterThanOrEqual(2), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByTestId('p3-gate')).toBeNull();
    expect(opens).toBe(1);
    off();
  });
});
