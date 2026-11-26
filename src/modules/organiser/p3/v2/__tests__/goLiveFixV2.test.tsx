// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { EventWorkspace } from '../../../events/eventModel';

const check = vi.hoisted(() => ({ value: { data: undefined, isError: false } as { data?: unknown; isError: boolean } }));
const nav = vi.hoisted(() => vi.fn());
const sent = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('react-router-dom', async (orig) => ({ ...((await orig()) as object), useNavigate: () => nav }));
vi.mock('../../../shared/goLiveCheck', async (orig) => ({ ...((await orig()) as object), useGoLiveCheck: () => check.value }));
vi.mock('../../../shared/selfServeApi', async (orig) => ({ ...((await orig()) as object), runSeriesCommand: (...a: unknown[]) => sent.run(...a), runOccurrenceCommand: vi.fn() }));
vi.mock('../../screens/Toast', async () => {
  const { useRunCommands } = await import('../../../shared/runCommands');
  return { useToast: (id: string) => ({ run: useRunCommands(id), show: vi.fn(), node: null }) };
});
vi.mock('../../screens/StatusSheet', () => ({ StatusSheet: () => <div data-testid="status-sheet" /> }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...((await orig()) as object), londonTodayKey: () => '2026-11-22' }));
import { MemoryRouter } from "react-router-dom";
import { GoLiveBar } from '../GoLiveBar';
import { GO_LIVE_V2_FIX, goLiveFixOn, v2FixFor } from '../goLiveFixV2';
import { GO_LIVE_BLOCKERS, GO_LIVE_SECTIONS } from '../../../shared/goLiveKeys';
import { goLiveFixHref } from '../../../shared/goLiveCheck';

const ws = (over: Record<string, unknown> = {}) => ({
  series: { id: 's1', version: 7, format: 'recurring', name: 'Thursdays', lifecycle_status: 'draft', payment_methods: null, ...over },
  gallery: [], musicStyles: [], organiserIds: [], endedOn: null, dates: [],
}) as unknown as EventWorkspace;
const first = (code: string, section: string) => {
  check.value = { data: { ready: false, eventMissing: [{ code, section }], recommended: [], profileRuleApplies: false, profileMissing: [] }, isError: false };
};
const client = new QueryClient();
const bar = (w: EventWorkspace, onFix?: (t: never) => void) => render(<MemoryRouter><QueryClientProvider client={client}><GoLiveBar ws={w} onFix={onFix} /></QueryClientProvider></MemoryRouter>);

beforeEach(() => { sent.run.mockResolvedValue({ new_version: 8 }); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.clearAllMocks(); check.value = { data: undefined, isError: false }; });

describe('contract', () => {
  it.each(Object.keys(GO_LIVE_BLOCKERS))('code %s has a v2 fix', (code) => { expect(v2FixFor(code)).not.toBeNull(); });
  it.each(GO_LIVE_SECTIONS)('section %s is mapped', (s) => { expect(Object.keys(GO_LIVE_V2_FIX)).toContain(s); });
  it('unknown code is null', () => { expect(v2FixFor('nope')).toBeNull(); });
});

describe('How dancers pay', () => {
  it('no_payment: tap opens the sheet; Cash + Save sends one upsert', async () => {
    first('no_payment', 'payment');
    bar(ws());
    fireEvent.click(screen.getByTestId('golive-fix'));
    expect(screen.getByTestId('howpay-sheet')).toBeTruthy();
    fireEvent.click(screen.getByText('Cash'));
    fireEvent.click(screen.getByTestId('howpay-save'));
    await waitFor(() => expect(sent.run).toHaveBeenCalledTimes(1));
    const payload = sent.run.mock.calls[0][0].command.payload;
    expect(payload.payment_methods).toBe('cash');
    expect(payload.name).toBe('Thursdays');
    await waitFor(() => expect(screen.queryByTestId('howpay-sheet')).toBeNull());
  });
  it('untouched Save sends nothing and closes', async () => {
    first('no_payment', 'payment');
    bar(ws({ payment_methods: 'door' }));
    fireEvent.click(screen.getByTestId('golive-fix'));
    fireEvent.click(screen.getByTestId('howpay-save'));
    await waitFor(() => expect(screen.queryByTestId('howpay-sheet')).toBeNull());
    expect(sent.run).not.toHaveBeenCalled();
  });
  it('empty pick shows Pick at least one and sends nothing', () => {
    first('no_payment', 'payment');
    bar(ws());
    fireEvent.click(screen.getByTestId('golive-fix'));
    fireEvent.click(screen.getByTestId('howpay-save'));
    expect(screen.getByTestId('howpay-err').textContent).toBe('Pick at least one.');
    expect(sent.run).not.toHaveBeenCalled();
  });
  it('failure keeps the sheet open with the retry words', async () => {
    sent.run.mockRejectedValue(new Error('boom'));
    first('no_payment', 'payment');
    bar(ws());
    fireEvent.click(screen.getByTestId('golive-fix'));
    fireEvent.click(screen.getByText('Cash'));
    fireEvent.click(screen.getByTestId('howpay-save'));
    await waitFor(() => expect(screen.getByTestId('howpay-err').textContent).toBe('Not saved. Try again.'));
    expect(screen.getByTestId('howpay-sheet')).toBeTruthy();
  });
  it('festival shows only Ticket link', () => {
    first('no_payment', 'payment');
    bar(ws({ format: 'festival' }));
    fireEvent.click(screen.getByTestId('golive-fix'));
    const chips = screen.getAllByTestId('howpay-chip');
    expect(chips.map((c) => c.textContent)).toEqual(['Ticket link']);
  });
  it('every-night line shows on a weekly event, not a one-off', () => {
    first('no_payment', 'payment');
    bar(ws());
    fireEvent.click(screen.getByTestId('golive-fix'));
    expect(screen.queryByText('Every night of this event.')).toBeTruthy();
    cleanup();
    bar(ws({ format: 'one_off' }));
    fireEvent.click(screen.getByTestId('golive-fix'));
    expect(screen.queryByText('Every night of this event.')).toBeNull();
  });
  it('a successful command invalidates the go-live check', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    first('no_payment', 'payment');
    bar(ws());
    fireEvent.click(screen.getByTestId('golive-fix'));
    fireEvent.click(screen.getByText('Cash'));
    fireEvent.click(screen.getByTestId('howpay-save'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['series-go-live-check', 's1'] }));
  });
});

describe('other blockers', () => {
  it('venue first, no onFix: navigates to the old fix screen', () => {
    first('venue', 'venue');
    bar(ws());
    fireEvent.click(screen.getByTestId('golive-fix'));
    expect(nav).toHaveBeenCalledWith(goLiveFixHref('venue', 's1'));
  });
  it('venue first, with onFix: called with where, no navigation', () => {
    first('venue', 'venue');
    const onFix = vi.fn();
    bar(ws(), onFix);
    fireEvent.click(screen.getByTestId('golive-fix'));
    expect(onFix).toHaveBeenCalledWith('where');
    expect(nav).not.toHaveBeenCalled();
  });
  it('checking and error lines stay plain text', () => {
    bar(ws());
    expect(screen.queryByTestId('golive-fix')).toBeNull();
    expect(screen.getByTestId('golive-reason')).toBeTruthy();
  });
  it('flag false: plain text, no golive-fix', () => {
    vi.stubEnv('VITE_ENABLE_GOLIVE_FIX', 'false');
    expect(goLiveFixOn()).toBe(false);
    first('no_payment', 'payment');
    bar(ws());
    expect(screen.queryByTestId('golive-fix')).toBeNull();
    expect(screen.getByTestId('golive-reason').textContent).toBe('Say how dancers pay');
  });
});
