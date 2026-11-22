// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

const h = vi.hoisted(() => ({ on: true, going: { view: { state: 'ready' }, nights: [] as unknown[], retry: () => undefined, fetching: false, refreshFailed: false } as Record<string, unknown>, raffle: vi.fn() }));
vi.mock('@/modules/going', async (orig) => ({
  ...(await orig<object>()),
  useMyEventGoing: () => h.going,
  GoingPeopleSheet: () => <div data-testid="people-list" />,
}));
vi.mock('../../screens/P3Going', async (orig) => ({ ...(await orig<object>()), p3GoingOn: () => h.on }));
vi.mock('../../events/raffle/raffleApi', () => ({ raffleNightsQueryKey: (id: string) => ['rn', id], fetchRaffleNights: () => h.raffle() }));
vi.mock('../../events/raffle/RaffleSheet', () => ({ RaffleSheet: () => <div data-testid="raffle-sheet-stub" /> }));
import { NightHub, gbp } from '../NightHub';
import { V2 } from '../copy';
import { V2Toast, type V2ToastState } from '../V2Toast';

const night = { seriesId: 's1', date: '2026-11-26', dayLabel: 'Thursday 26 November' } as never;
const gnight = (extra: Record<string, unknown> = {}) => ({ occurrence_id: 'o1', occurrence_date: '2026-11-26', starts_at_local: null, is_cancelled: false, going_count: 5, people: [{ first_name: 'Ana' }, { first_name: 'bo' }, { first_name: 'Cy' }], ...extra });
const rread = (n: Record<string, unknown> | null) => ({ kind: 'ok', read: { seriesId: 's1', canEdit: true, viewOnlyReason: null, nights: n ? [{ occurrenceId: 'o1', date: '2026-11-26', startLocal: null, chip: 'open', raffleOn: true, entries: 12, locked: false, winner: null, canSet: true, refuseReason: null, ...n }] : [] } });

function Host({ oneOff = false, props = {} }: { oneOff?: boolean; props?: Record<string, unknown> }) {
  const [t, setT] = useState<V2ToastState | null>(null);
  return (
    <>
      <NightHub seriesId="s1" seriesName="Thursdays" occurrenceId="o1" raffleNight={night} oneOff={oneOff} shareLink="https://x.test/event/thu" toast={(text) => setT((p) => ({ seq: (p?.seq ?? 0) + 1, text }))} {...props} />
      <V2Toast toast={t} onDone={() => setT(null)} />
    </>
  );
}
const at = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  h.on = true;
  h.going = { view: { state: 'ready' }, nights: [gnight()], retry: () => undefined, fetching: false, refreshFailed: false };
  h.raffle.mockReset().mockResolvedValue(rread({}));
});
afterEach(cleanup);

describe('going card', () => {
  it('shows initials, +N and "<n> going"; opens the list', () => {
    at(<Host />);
    const card = screen.getByTestId('hub-going');
    expect(card.textContent).toContain('5 going');
    expect(Array.from(card.querySelectorAll('i')).map((i) => i.textContent)).toEqual(['A', 'B', 'C', '+2']);
    fireEvent.click(card);
    expect(screen.getByTestId('people-list')).toBeTruthy();
  });
  it('hidden when the switch is off, no read state, or the night is not in the read', () => {
    h.on = false;
    at(<Host />);
    expect(screen.queryByTestId('hub-going')).toBeNull();
    cleanup();
    h.on = true;
    h.going = { ...h.going, view: { state: 'off' } };
    at(<Host />);
    expect(screen.queryByTestId('hub-going')).toBeNull();
    cleanup();
    h.going = { ...h.going, view: { state: 'ready' }, nights: [gnight({ occurrence_id: 'other' })] };
    at(<Host />);
    expect(screen.queryByTestId('hub-going')).toBeNull();
  });
});

describe('tiles and heading', () => {
  it('tiles show 0 and money formats', () => {
    at(<Host />);
    expect(screen.getByTestId('hub-sold').textContent).toBe('0');
    expect(screen.getByTestId('hub-money').textContent).toBe('£0');
    expect(screen.getByText('after fees')).toBeTruthy();
    expect(gbp(2500)).toBe('£25');
    expect(gbp(2550)).toBe('£25.50');
  });
  it('heading: This night / On the night', () => {
    at(<Host />);
    expect(screen.getByText('This night')).toBeTruthy();
    cleanup();
    at(<Host oneOff />);
    expect(screen.getByText('On the night')).toBeTruthy();
  });
});

describe('raffle row', () => {
  it('pill On with n entries, 1 entry, Off; opens the sheet', async () => {
    at(<Host />);
    expect((await screen.findByTestId('hub-raffle-pill')).textContent).toBe('On · 12 entries');
    fireEvent.click(screen.getByTestId('hub-raffle'));
    expect(screen.getByTestId('raffle-sheet-stub')).toBeTruthy();
    cleanup();
    h.raffle.mockResolvedValue(rread({ entries: 1 }));
    at(<Host />);
    expect((await screen.findByTestId('hub-raffle-pill')).textContent).toBe('On · 1 entry');
    cleanup();
    h.raffle.mockResolvedValue(rread({ raffleOn: false, chip: 'closed' }));
    at(<Host />);
    expect((await screen.findByTestId('hub-raffle-pill')).textContent).toBe('Off');
  });
  it('nothing while loading; row without pill on error', async () => {
    h.raffle.mockReturnValue(new Promise(() => undefined));
    at(<Host />);
    expect(screen.queryByTestId('hub-raffle')).toBeNull();
    cleanup();
    h.raffle.mockRejectedValue(new Error('x'));
    at(<Host />);
    expect((await screen.findByTestId('hub-raffle')).textContent).toContain('Raffle');
    expect(screen.queryByTestId('hub-raffle-pill')).toBeNull();
  });
});

describe('share', () => {
  const open = async () => { at(<Host />); fireEvent.click(screen.getByTestId('hub-share')); await screen.findByTestId('share-link'); };
  it('copy lines and sheet', async () => {
    at(<Host />);
    expect(screen.getByText(V2.shareLine)).toBeTruthy();
    fireEvent.click(screen.getByTestId('hub-share'));
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Share this night');
    expect(screen.getByTestId('share-link').textContent).toBe('https://x.test/event/thu');
    expect(screen.getByTestId('share-copy').textContent).toBe('Copy link');
  });
  it('copy success toast, no Undo', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open();
    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toBe('Link copied'));
    expect(writeText).toHaveBeenCalledWith('https://x.test/event/thu');
    expect(screen.queryByTestId('v2-toast-undo')).toBeNull();
  });
  it('blocked clipboard toast', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true });
    await open();
    fireEvent.click(screen.getByTestId('share-copy'));
    await waitFor(() => expect(screen.getByTestId('v2-toast').textContent).toBe('Select the link to copy it'));
    expect(screen.queryByTestId('v2-toast-undo')).toBeNull();
  });
});
