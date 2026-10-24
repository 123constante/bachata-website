// @vitest-environment jsdom
/**
 * Going P3 -- the organiser parts, table-driven: every component x every night
 * shape x every read state.
 *
 * Night shapes. From the prod shape survey (2026-10-24, read-only, counts only:
 * 64 series with upcoming nights, 1786 live nights ALL at 0 going, 50 cancelled
 * nights all at 0, max 57 upcoming nights per series, the longest finished
 * first name 21 chars): 0 going, cancelled 0. Built from the RPC's own rules
 * (not yet on prod): 1, 9 (more than a row of faces), 200 (the cap), 250 going
 * with 200 listed, cancelled with people, a hidden page (null id, never a
 * photo), a photo, a 21-char name, an unreadable start.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  on: true,
  rpc: vi.fn(),
  emit: vi.fn(),
  user: { id: 'u1' } as null | { id: string; is_anonymous?: boolean },
  authLoading: false,
}));
vi.mock('@/lib/goingCheckin', () => ({
  get GOING_CHECKIN_ENABLED() {
    return h.on;
  },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string, a?: unknown) => h.rpc(fn, a) }));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: h.emit }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: h.authLoading }),
}));

import {
  GOING_COPY,
  GoingLoadState,
  GoingNightSummary,
  GoingPeopleSheet,
  ORGANISER_GOING_REFUSAL_CODES,
  goingErrorCode,
  organiserGoingStateFor,
  organiserNightView,
  parseMyEventGoing,
  goingKeys,
  invalidateGoing,
  useMyEventGoing,
  type GoingPerson,
  type MyEventGoingNight,
  type OrganiserGoingView,
} from '@/modules/going';

const NAMES = ['Ana', 'Leo', 'Mia', 'Sam', 'Kai', 'Zoe', 'Raf', 'In\u00e9s', 'Tom', 'Bea'];
const person = (i: number, over: Partial<GoingPerson> = {}): GoingPerson => ({
  dancer_profile_id: `d${i}`,
  first_name: NAMES[i % NAMES.length],
  photo_url: null,
  ...over,
});
const night = (count: number, over: Partial<MyEventGoingNight> = {}): MyEventGoingNight => ({
  occurrence_id: 'o1',
  occurrence_date: '2026-10-29',
  starts_at_local: '2026-10-29T21:00:00',
  is_cancelled: false,
  going_count: count,
  people: Array.from({ length: Math.min(count, 200) }, (_, i) => person(i)),
  ...over,
});

type Shape = {
  name: string;
  night: MyEventGoingNight;
  text: string;
  kind: 'nobody' | 'some' | 'cancelled';
  rows: number;
  links: number;
  photos: number;
  more: string | null;
};
const SHAPES: Shape[] = [
  { name: '0 going (every live prod night)', night: night(0), text: GOING_COPY.orgNobody, kind: 'nobody', rows: 0, links: 0, photos: 0, more: null },
  { name: 'cancelled, 0 (every cancelled prod night)', night: night(0, { is_cancelled: true }), text: 'This date is cancelled', kind: 'cancelled', rows: 0, links: 0, photos: 0, more: null },
  { name: '1 going', night: night(1), text: '1 going', kind: 'some', rows: 1, links: 1, photos: 0, more: null },
  { name: '9 going', night: night(9), text: '9 going', kind: 'some', rows: 9, links: 9, photos: 0, more: null },
  { name: '200 going (the cap)', night: night(200), text: '200 going', kind: 'some', rows: 200, links: 200, photos: 0, more: null },
  { name: '250 going, 200 listed', night: night(250), text: '250 going', kind: 'some', rows: 200, links: 200, photos: 0, more: 'And 50 more people' },
  {
    name: 'cancelled with 3 who had said going',
    night: night(3, { is_cancelled: true }),
    text: 'This date is cancelled \u00b7 3 had said they were going',
    kind: 'cancelled', rows: 3, links: 3, photos: 0, more: null,
  },
  {
    name: 'hidden page (null id) + photo + 21-char name',
    night: night(3, {
      people: [
        person(0, { dancer_profile_id: null }),
        person(1, { photo_url: 'https://x.test/a.jpg' }),
        person(2, { first_name: 'Maximiliana-Josefinaa' }),
      ],
    }),
    text: '3 going', kind: 'some', rows: 3, links: 2, photos: 1, more: null,
  },
  {
    name: 'count below the people listed (stale count)',
    night: { ...night(2), going_count: 0 },
    text: '2 going', kind: 'some', rows: 2, links: 2, photos: 0, more: null,
  },
];

let qc: QueryClient;
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => {
  h.on = true;
  h.user = { id: 'u1' };
  h.authLoading = false;
  h.emit.mockReset();
  h.rpc.mockReset();
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(cleanup);

describe('organiserNightView: one mapping for every shape', () => {
  it.each(SHAPES)('$name', (s) => {
    const v = organiserNightView(s.night);
    expect(v.kind).toBe(s.kind);
    expect(v.text).toBe(s.text);
    expect(v.openable).toBe(s.rows > 0);
    expect(v.when).toBe('Thursday 29 Oct \u00b7 9 PM');
    expect(v.count).toBe(Math.max(s.night.going_count, s.night.people.length));
    expect(v.extra).toBe(v.count - s.night.people.length);
  });
  it('a cancelled night never says "0 going" or invites', () => {
    const t = organiserNightView(night(0, { is_cancelled: true })).text;
    expect(t).not.toMatch(/0 going|yet/);
  });
  it('starts_at_local is read as stored (no zone shift), full weekday names', () => {
    expect(organiserNightView(night(0, { starts_at_local: '2026-03-29T00:30:00' })).when).toBe('Sunday 29 Mar \u00b7 12:30 AM');
    expect(organiserNightView(night(0, { starts_at_local: '2026-10-25T01:30:00' })).when).toBe('Sunday 25 Oct \u00b7 1:30 AM');
    expect(organiserNightView(night(0, { starts_at_local: null })).when).toBeNull();
  });
});

describe('GoingNightSummary x every shape', () => {
  it.each(SHAPES)('$name: text, button only when there is a list and onOpen', (s) => {
    const onOpen = vi.fn();
    render(<GoingNightSummary night={s.night} variant="compact" onOpen={onOpen} />);
    const el = screen.getByTestId('going-night-summary');
    expect(el.textContent).toBe(s.text);
    expect(el.getAttribute('data-variant')).toBe('compact');
    expect(el.style.minHeight).toBe('44px');
    if (s.rows > 0) {
      expect(el.tagName).toBe('BUTTON');
      expect(el.style.minWidth).toBe('44px');
      fireEvent.click(el);
      expect(onOpen).toHaveBeenCalledWith(s.night);
    } else {
      expect(el.tagName).toBe('P');
      expect(screen.queryByRole('button')).toBeNull();
    }
  });
  it('without onOpen it is plain text even with people (no navigation of its own)', () => {
    render(<GoingNightSummary night={night(9)} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByTestId('going-night-summary').textContent).toBe('9 going');
  });
  it('the button names the night for a screen reader', () => {
    render(<GoingNightSummary night={night(12)} onOpen={() => {}} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(`12 going, Thursday 29 Oct \u00b7 9 PM. ${GOING_COPY.orgSheetTitle}`);
  });
});

describe('GoingPeopleSheet x every shape', () => {
  it.each(SHAPES)('$name', (s) => {
    render(
      <MemoryRouter>
        <GoingPeopleSheet night={s.night} eventId="e1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading').textContent).toBe(GOING_COPY.orgSheetTitle);
    expect(screen.getByTestId('going-sheet-when').textContent).toBe('Thursday 29 Oct \u00b7 9 PM');
    expect(screen.getByTestId('going-sheet-count').textContent).toBe(s.text);
    expect(screen.queryAllByRole('listitem')).toHaveLength(s.rows);
    expect(screen.queryAllByTestId('going-sheet-link')).toHaveLength(s.links);
    expect(screen.queryAllByTestId('going-sheet-person')).toHaveLength(s.rows - s.links);
    expect(screen.queryAllByTestId('going-photo')).toHaveLength(s.photos);
    expect(screen.queryAllByTestId('going-initial')).toHaveLength(s.rows - s.photos);
    expect(screen.queryByTestId('going-sheet-more')?.textContent ?? null).toBe(s.more);
    if (s.rows > 0) {
      const list = screen.getByTestId('going-sheet-list');
      expect(list.style.overflowY).toBe('auto');
      expect(list.style.maxHeight).not.toBe('');
    }
    expect(document.body.textContent).not.toMatch(/\b0 going/);
  });
  it('a hidden page is a name with no link and never a photo; a link emits the profile view', () => {
    render(
      <MemoryRouter>
        <GoingPeopleSheet night={SHAPES[7].night} eventId="e1" />
      </MemoryRouter>,
    );
    const hidden = screen.getAllByTestId('going-sheet-person')[0];
    expect(hidden.textContent).toContain('Ana');
    expect(hidden.querySelector('img')).toBeNull();
    const links = screen.getAllByTestId('going-sheet-link');
    expect(links[0].getAttribute('href')).toContain('d1');
    expect(links[0].getAttribute('aria-label')).toBe('Leo, dancer page');
    fireEvent.click(links[0]);
    expect(h.emit).toHaveBeenCalledWith(expect.objectContaining({ personId: 'd1', profileType: 'dancer', eventId: 'e1' }));
  });
  it('every row is at least 56px tall (explicit px)', () => {
    render(
      <MemoryRouter>
        <GoingPeopleSheet night={SHAPES[7].night} />
      </MemoryRouter>,
    );
    for (const el of [...screen.getAllByTestId('going-sheet-link'), ...screen.getAllByTestId('going-sheet-person')]) {
      expect(el.style.minHeight).toBe('56px');
    }
  });
});

const VIEWS: Array<{ name: string; view: OrganiserGoingView; text: string | null; button: string | null }> = [
  { name: 'off', view: organiserGoingStateFor({ enabled: false, signedIn: true, status: 'success' }), text: null, button: null },
  { name: 'ready', view: organiserGoingStateFor({ enabled: true, signedIn: true, status: 'success' }), text: null, button: null },
  { name: 'auth loading', view: organiserGoingStateFor({ enabled: true, signedIn: null, status: 'pending' }), text: GOING_COPY.orgLoading, button: null },
  { name: 'loading', view: organiserGoingStateFor({ enabled: true, signedIn: true, status: 'pending' }), text: GOING_COPY.orgLoading, button: null },
  { name: 'signed out', view: organiserGoingStateFor({ enabled: true, signedIn: false, status: 'pending' }), text: GOING_COPY.orgNotSignedIn, button: 'Sign in again' },
  ...(['not_signed_in', 'not_found', 'not_organiser', 'network', 'unknown'] as const).map((code) => ({
    name: `error ${code}`,
    view: organiserGoingStateFor({ enabled: true, signedIn: true, status: 'error', error: code }),
    text: { not_signed_in: GOING_COPY.orgNotSignedIn, not_found: GOING_COPY.orgNotFound, not_organiser: GOING_COPY.orgNotOrganiser, network: GOING_COPY.peopleLoadFailed, unknown: GOING_COPY.peopleLoadFailed }[code],
    button: { not_signed_in: 'Sign in again', not_found: null, not_organiser: null, network: 'Try again', unknown: 'Try again' }[code],
  })),
];

describe('GoingLoadState x every read state', () => {
  it.each(VIEWS)('$name', ({ view, text, button }) => {
    const onRetry = vi.fn();
    const onSignIn = vi.fn();
    const { container } = render(<GoingLoadState view={view} onRetry={onRetry} onSignIn={onSignIn} />);
    if (text === null) {
      expect(container.innerHTML).toBe('');
      return;
    }
    expect(screen.getByTestId('going-load-state').textContent).toBe(text + (button ?? ''));
    const b = screen.queryByRole('button');
    expect(b?.textContent ?? null).toBe(button);
    if (b) {
      expect(b.style.minHeight).toBe('44px');
      fireEvent.click(b);
      expect(button === 'Try again' ? onRetry : onSignIn).toHaveBeenCalledTimes(1);
    }
  });
  it('the error words read as the brief: "Couldn\u2019t load who\u2019s going. Try again"', () => {
    render(<GoingLoadState view={VIEWS.find((v) => v.name === 'error network')!.view} onRetry={() => {}} />);
    expect(screen.getByRole('alert').textContent).toBe('Couldn\u2019t load who\u2019s going.Try again');
  });
  it('signed out with no onSignIn: the words alone, no dead button', () => {
    render(<GoingLoadState view={VIEWS.find((v) => v.name === 'signed out')!.view} onRetry={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('every refusal of get_my_event_going_v1 has its own state', () => {
    for (const code of ORGANISER_GOING_REFUSAL_CODES) {
      const s = organiserGoingStateFor({ enabled: true, signedIn: true, status: 'error', error: goingErrorCode({ message: code, code: '42501' }) }).state;
      expect(s).toBe(code);
    }
  });
});

describe('parseMyEventGoing', () => {
  it('keeps the night exactly as the RPC returns it, drops broken rows', () => {
    const raw = {
      public_event_id: 'e1',
      nights: [
        { occurrence_id: 'o1', occurrence_date: '2026-10-29', starts_at_local: '2026-10-29T21:00:00', is_cancelled: false, going_count: 1,
          people: [{ dancer_profile_id: null, first_name: ' Ana ', photo_url: null }, { first_name: '' }] },
        { occurrence_date: '2026-10-30' },
      ],
    };
    expect(parseMyEventGoing(raw, 'e1')).toEqual({
      public_event_id: 'e1',
      nights: [{ occurrence_id: 'o1', occurrence_date: '2026-10-29', starts_at_local: '2026-10-29T21:00:00', is_cancelled: false, going_count: 1,
        people: [{ dancer_profile_id: null, first_name: 'Ana', photo_url: null }] }],
    });
    expect(parseMyEventGoing(null, 'e2')).toEqual({ public_event_id: 'e2', nights: [] });
  });
});

const EV = '7f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f';

describe('useMyEventGoing', () => {
  const reply = { public_event_id: EV, nights: [night(0), night(3, { occurrence_id: 'o2', is_cancelled: true })] };

  it('switch off: state off, no RPC', async () => {
    h.on = false;
    const { result } = renderHook(() => useMyEventGoing(EV), { wrapper: wrap });
    expect(result.current.view.state).toBe('off');
    await new Promise((r) => setTimeout(r, 20));
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ['signed out', null],
    ['anonymous', { id: 'a1', is_anonymous: true }],
  ])('%s: not_signed_in without a request', async (_n, user) => {
    h.user = user;
    const { result } = renderHook(() => useMyEventGoing(EV), { wrapper: wrap });
    expect(result.current.view.state).toBe('not_signed_in');
    await new Promise((r) => setTimeout(r, 20));
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('auth still resolving: loading', () => {
    h.user = null;
    h.authLoading = true;
    const { result } = renderHook(() => useMyEventGoing(EV), { wrapper: wrap });
    expect(result.current.view.state).toBe('loading');
  });
  it('ready: ONE call with p_public_event_id, nights as returned', async () => {
    h.rpc.mockResolvedValue({ data: reply, error: null });
    const { result } = renderHook(() => useMyEventGoing(EV), { wrapper: wrap });
    expect(result.current.view.state).toBe('loading');
    await waitFor(() => expect(result.current.view.state).toBe('ready'));
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith('get_my_event_going_v1', { p_public_event_id: EV });
    expect(result.current.nights).toEqual(reply.nights);
  });
  it.each(ORGANISER_GOING_REFUSAL_CODES)('refusal %s: its state, not retried', async (code) => {
    h.rpc.mockResolvedValue({ data: null, error: { message: code, code: code === 'not_found' ? 'P0002' : '42501' } });
    qc = new QueryClient();
    const { result } = renderHook(() => useMyEventGoing(EV), { wrapper: wrap });
    await waitFor(() => expect(result.current.view.state).toBe(code));
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(result.current.nights).toEqual([]);
  });
  it('network failure: retried once, then error; Try again reads again and recovers', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } });
    const { result } = renderHook(() => useMyEventGoing(EV), { wrapper: wrap });
    await waitFor(() => expect(result.current.view.state).toBe('error'), { timeout: 4000 });
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(result.current.view.action?.label).toBe('Try again');
    h.rpc.mockResolvedValue({ data: reply, error: null });
    result.current.retry();
    await waitFor(() => expect(result.current.view.state).toBe('ready'));
  });
  it('a failed RE-read keeps the loaded nights on screen (ready + refreshFailed), never blanks them', async () => {
    h.rpc.mockResolvedValue({ data: reply, error: null });
    const { result } = renderHook(() => useMyEventGoing(EV), { wrapper: wrap });
    await waitFor(() => expect(result.current.view.state).toBe('ready'));
    h.rpc.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch', code: '' } });
    result.current.retry();
    await waitFor(() => expect(result.current.refreshFailed).toBe(true), { timeout: 4000 });
    expect(result.current.view.state).toBe('ready');
    expect(result.current.nights).toEqual(reply.nights);
  });
  it('retry keeps one identity across renders', async () => {
    h.rpc.mockResolvedValue({ data: reply, error: null });
    const { result, rerender } = renderHook(() => useMyEventGoing(EV), { wrapper: wrap });
    const first = result.current.retry;
    rerender();
    expect(result.current.retry).toBe(first);
  });
  it.each(['e1', 'latin-lovers', '123'])('a non-uuid id (%s): not_found, no request (22P02 is no retry case)', async (id) => {
    const { result } = renderHook(() => useMyEventGoing(id), { wrapper: wrap });
    expect(result.current.view.state).toBe('not_found');
    await new Promise((r) => setTimeout(r, 20));
    expect(h.rpc).not.toHaveBeenCalled();
  });
  it('invalidateGoing re-reads only the organiser read that holds the night', async () => {
    const other = '8f1e2d3c-4b5a-4c6d-8e9f-0a1b2c3d4e5f';
    qc.setQueryData(goingKeys.event('u1', EV), reply);
    qc.setQueryData(goingKeys.event('u1', other), { public_event_id: other, nights: [night(0, { occurrence_id: 'x9' })] });
    await invalidateGoing(qc, 'o2');
    expect(qc.getQueryState(goingKeys.event('u1', EV))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(goingKeys.event('u1', other))?.isInvalidated).toBe(false);
  });
  it('no event id yet: loading, no request', async () => {
    const { result } = renderHook(() => useMyEventGoing(null), { wrapper: wrap });
    expect(result.current.view.state).toBe('loading');
    await new Promise((r) => setTimeout(r, 20));
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
