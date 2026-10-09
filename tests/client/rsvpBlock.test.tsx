// @vitest-environment jsdom
/**
 * Gate for the event page "I'm Going" RSVP (RsvpBlock + useOccurrenceRsvp).
 * Covers: set going / clear, optimistic count + rollback on an RPC error, the
 * error-code copy, signed-out and anonymous taps opening sign-in without any
 * RPC, closed nights (cancelled / ended / non-live series) disabled, and the
 * exact RPC names and argument shapes. No network: supabase.rpc is mocked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean },
  rpc: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user, isLoading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: h.rpc } }));
vi.mock('sonner', () => ({ toast: { error: h.toastError } }));

import { RsvpBlock } from '@/modules/event-page/bento/blocks/RsvpBlock';
import { rsvpErrorMessage } from '@/modules/event-page/hooks/useOccurrenceRsvp';
import { eventPageQueryKey } from '@/modules/event-page/useEventPageQuery';
import type { EventPageSnapshot, EventPageSnapshotOccurrence } from '@/modules/event-page/types';

const PAGE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PUBLIC_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OCC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const future = (days: number) => {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 19) + '+00:00';
};

// A naive London wall clock (how the snapshot stores starts_at/ends_at).
const londonWall = (offsetMs: number) =>
  new Date(Date.now() + offsetMs)
    .toLocaleString('sv-SE', { timeZone: 'Europe/London', hour12: false })
    .replace(' ', 'T');

const occ = (over: Partial<EventPageSnapshotOccurrence> = {}) =>
  ({
    occurrenceId: OCC,
    startsAt: future(2),
    endsAt: future(2.2),
    timezone: 'Europe/London',
    isCancelled: false,
    isPast: false,
    ...over,
  }) as EventPageSnapshotOccurrence;

let qc: QueryClient;

const seedSnapshot = (goingCount: number) =>
  qc.setQueryData(eventPageQueryKey(PAGE_ID, null), {
    eventId: PUBLIC_ID,
    occurrenceId: OCC,
    attendance: { goingCount, interestedCount: 0, currentUserStatus: null, preview: [] },
  } as unknown as EventPageSnapshot);

const snapshotGoing = () =>
  qc.getQueryData<EventPageSnapshot>(eventPageQueryKey(PAGE_ID, null))?.attendance.goingCount;

const mount = (props: Partial<Parameters<typeof RsvpBlock>[0]> = {}) =>
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/event/some-night?occurrenceId=' + OCC]}>
        <RsvpBlock
          pageEventId={PAGE_ID}
          publicEventId={PUBLIC_ID}
          occurrenceId={OCC}
          occurrence={occ()}
          seriesLifecycle="live"
          goingCountLabel={`${snapshotGoing() ?? 4} going`}
          {...props}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );

const statusSettled = () =>
  waitFor(() => {
    expect(h.rpc).toHaveBeenCalledWith('get_my_occurrence_attendance_p5_v1', expect.anything());
    expect(screen.getByTestId('rsvp-block').getAttribute('aria-busy')).toBe('false');
  });

const setCalls = () => h.rpc.mock.calls.filter(([name]) => name === 'set_my_occurrence_attendance_p5_v1');

let myStatus: string | null;

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  h.user = { id: 'u1' };
  h.toastError.mockReset();
  myStatus = null;
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (name: string, args: { p_status?: string | null }) => {
    if (name === 'get_my_occurrence_attendance_p5_v1') return { data: myStatus, error: null };
    if (name === 'set_my_occurrence_attendance_p5_v1') {
      myStatus = args.p_status ?? null;
      return { data: { event_id: PUBLIC_ID, occurrence_id: OCC, status: myStatus, updated_at: null }, error: null };
    }
    // The snapshot refetch after invalidation: keep the seeded count stable.
    return { data: null, error: null };
  });
  seedSnapshot(4);
});
afterEach(cleanup);

describe('RsvpBlock', () => {
  it('reads the caller status with the exact RPC name and arguments', async () => {
    myStatus = 'going';
    mount();
    expect((await screen.findByText("You're Going")).closest('button')?.getAttribute('aria-pressed')).toBe('true');
    expect(h.rpc).toHaveBeenCalledWith('get_my_occurrence_attendance_p5_v1', {
      p_public_event_id: PUBLIC_ID,
      p_occurrence_id: OCC,
    });
  });

  it('tap sets going, tap again clears, with the exact payload', async () => {
    mount();
    await statusSettled();

    fireEvent.click(screen.getByTestId('rsvp-going'));
    await screen.findByText("You're Going");
    expect(setCalls()[0]).toEqual([
      'set_my_occurrence_attendance_p5_v1',
      { p_public_event_id: PUBLIC_ID, p_occurrence_id: OCC, p_status: 'going' },
    ]);

    fireEvent.click(screen.getByTestId('rsvp-going'));
    await screen.findByText("I'm Going");
    expect(setCalls()[1]).toEqual([
      'set_my_occurrence_attendance_p5_v1',
      { p_public_event_id: PUBLIC_ID, p_occurrence_id: OCC, p_status: null },
    ]);
  });

  it('interested sets and clears through the same RPC', async () => {
    mount();
    await statusSettled();
    fireEvent.click(screen.getByTestId('rsvp-interested'));
    await waitFor(() => expect(screen.getByTestId('rsvp-interested').getAttribute('aria-pressed')).toBe('true'));
    expect(setCalls()[0][1]).toEqual({ p_public_event_id: PUBLIC_ID, p_occurrence_id: OCC, p_status: 'interested' });
  });

  it('updates the page going count optimistically and rolls back on an RPC error', async () => {
    let reject!: (v: unknown) => void;
    h.rpc.mockImplementation(async (name: string) => {
      if (name === 'get_my_occurrence_attendance_p5_v1') return { data: null, error: null };
      if (name === 'set_my_occurrence_attendance_p5_v1') return new Promise((r) => { reject = r; });
      return { data: null, error: null };
    });
    mount();
    await statusSettled();

    fireEvent.click(screen.getByTestId('rsvp-going'));
    await screen.findByText("You're Going");
    expect(snapshotGoing()).toBe(5);

    await act(async () => {
      reject({ data: null, error: { code: 'P0001', message: 'occurrence_cancelled: this night is cancelled' } });
    });
    await screen.findByText("I'm Going");
    expect(snapshotGoing()).toBe(4);
    expect(h.toastError).toHaveBeenCalledWith('This night has been cancelled.');
  });

  it.each([
    [{ code: '28000', message: 'anonymous_session: sign in with an account to RSVP' }, 'Sign in to RSVP.'],
    [{ code: '22023', message: 'invalid_argument: x' }, 'Something went wrong with this event link. Please refresh.'],
    [{ code: 'P0002', message: 'not_found: event or occurrence not found' }, "We couldn't find this night."],
    [{ code: 'P0001', message: 'rsvp_closed: this event is not taking RSVPs' }, "This event isn't taking RSVPs right now."],
    [{ code: 'P0001', message: 'occurrence_cancelled: this night is cancelled' }, 'This night has been cancelled.'],
    [{ code: 'P0001', message: 'occurrence_ended: this night has already ended' }, 'This night has already ended.'],
    [{ code: '57014', message: 'canceling statement' }, "Couldn't update your RSVP. Please try again."],
  ])('maps %o to friendly copy', (err, copy) => {
    expect(rsvpErrorMessage(err)).toBe(copy);
  });

  it.each([
    ['signed out', null],
    ['anonymous', { id: 'anon', is_anonymous: true }],
  ])('%s: tap opens sign-in and never calls an RPC', async (_label, user) => {
    h.user = user;
    mount();
    fireEvent.click(screen.getByTestId('rsvp-going'));
    expect(await screen.findByText('Sign in to RSVP')).toBeTruthy();
    expect(screen.getByText('Log In')).toBeTruthy();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['cancelled night', { occurrence: occ({ isCancelled: true }) }, 'This night is cancelled'],
    ['ended night', { occurrence: occ({ startsAt: future(-1.2), endsAt: future(-1) }) }, 'This night has ended'],
    ['paused series', { seriesLifecycle: 'paused' }, 'RSVPs are closed for this event'],
    ['ended series', { seriesLifecycle: 'ended' }, 'RSVPs are closed for this event'],
  ])('%s: disabled with a reason and never writes', async (_label, props, reason) => {
    myStatus = 'going';
    mount(props);
    expect((await screen.findByTestId('rsvp-meta')).textContent).toBe(reason);
    // The caller's earlier RSVP still shows on a closed night.
    await screen.findByText("You're Going");
    const going = screen.getByTestId('rsvp-going') as HTMLButtonElement;
    expect(going.disabled).toBe(true);
    fireEvent.click(going);
    expect(setCalls()).toHaveLength(0);
  });

  it('a tap after the night ends on an open page greys out instead of writing', async () => {
    const endsSoon = occ({ startsAt: londonWall(-3_600_000), endsAt: londonWall(60_000) });
    mount({ occurrence: endsSoon });
    await statusSettled();
    expect(screen.getByTestId('rsvp-meta').textContent).toBe('4 going');
    const realNow = Date.now;
    Date.now = () => realNow() + 120_000;
    try {
      fireEvent.click(screen.getByTestId('rsvp-going'));
      expect((await screen.findByTestId('rsvp-meta')).textContent).toBe('This night has ended');
    } finally {
      Date.now = realNow;
    }
    expect(setCalls()).toHaveLength(0);
  });

  it('ignores a tap while the caller status is still loading', async () => {
    let resolveGet!: (v: unknown) => void;
    h.rpc.mockImplementation((name: string) =>
      name === 'get_my_occurrence_attendance_p5_v1'
        ? new Promise((r) => { resolveGet = r; })
        : Promise.resolve({ data: null, error: null }),
    );
    mount();
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('get_my_occurrence_attendance_p5_v1', expect.anything()));
    fireEvent.click(screen.getByTestId('rsvp-going'));
    await act(async () => {});
    expect(setCalls()).toHaveLength(0);
    await act(async () => resolveGet({ data: 'going', error: null }));
    await screen.findByText("You're Going");
  });

  it('a failed status read blocks the write and retries the read', async () => {
    h.rpc.mockImplementation(async (name: string) =>
      name === 'get_my_occurrence_attendance_p5_v1'
        ? { data: null, error: { code: '57014', message: 'canceling statement' } }
        : { data: null, error: null },
    );
    mount();
    await waitFor(() => expect(screen.getByTestId('rsvp-block').getAttribute('aria-busy')).toBe('false'));
    const reads = () => h.rpc.mock.calls.filter(([n]) => n === 'get_my_occurrence_attendance_p5_v1').length;
    const before = reads();
    fireEvent.click(screen.getByTestId('rsvp-going'));
    await act(async () => {});
    expect(setCalls()).toHaveLength(0);
    expect(h.toastError).toHaveBeenCalledWith("Couldn't load your RSVP. Please try again.");
    await waitFor(() => expect(reads()).toBe(before + 1));
  });

  it('shows the page going count on an open night', async () => {
    mount();
    expect((await screen.findByTestId('rsvp-meta')).textContent).toBe('4 going');
  });
});
