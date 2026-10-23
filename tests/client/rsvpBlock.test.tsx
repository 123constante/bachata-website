// @vitest-environment jsdom
/**
 * Gate for the event page "Who's going" tile (design A, Going P2): RsvpBlock on
 * the going module. Table-driven over every shape the brief names -- night
 * (live / ended with an end time / ended with none / cancelled / event not
 * live), going 0 / 1 / 3 / 8 / 9 / 200, person (photo / no photo / null id),
 * viewer (signed out / anonymous / each missing field / finished / going /
 * rate limited / network error) -- plus the optimistic write and its rollback,
 * the exact RPC names and payloads, and the placeholder matching the tile.
 *
 * Every case mounts the tile the way BentoPage does: lazyWithRetry inside
 * Suspense with RsvpBlockPlaceholder as the fallback. No network: rpcLoose is mocked.
 */
import { Suspense } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // these specs exercise the going surfaces
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const h = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean },
  rpc: null as unknown as import('vitest').Mock<Parameters<Rpc>, ReturnType<Rpc>>,
}));
h.rpc = vi.fn();

vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false }),
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (fn: string, a?: Record<string, unknown>) => h.rpc(fn, a) }));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));
vi.mock('@/components/AuthPromptModal', () => ({
  AuthPromptModal: ({ open, title, description }: { open: boolean; title: string; description: string }) =>
    open ? <div data-testid="auth-prompt">{`${title} | ${description}`}</div> : null,
}));

import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { ProfileGateContext } from '@/hooks/useAuth';
import { profileGateValue, type ProfileField } from '@/lib/profileCompletion';
import type { RsvpBlock } from '@/modules/event-page/bento/blocks/RsvpBlock';
import * as Block from '@/modules/event-page/bento/blocks/RsvpBlock';
import * as Placeholder from '@/modules/event-page/bento/blocks/RsvpBlockPlaceholder';
import { GOING_COPY, goingCountText, type GoingPerson } from '@/modules/going';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

const { RsvpBlockPlaceholder } = Placeholder;
const PUBLIC_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OCC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const FUTURE = '2099-10-29 21:00:00'; // a Thursday
const PAST = '2020-01-02 21:00:00';

const occ = (over: Partial<Record<keyof EventPageSnapshotOccurrence, unknown>> = {}) =>
  ({ occurrenceId: OCC, startsAt: FUTURE, endsAt: null, timezone: 'Europe/London', isCancelled: false, isPast: false, ...over }) as unknown as EventPageSnapshotOccurrence;

const makeLazy = () =>
  lazyWithRetry(() => import('@/modules/event-page/bento/blocks/RsvpBlock').then((m) => ({ default: m.RsvpBlock })));
const LazyBlock = makeLazy();

type Gate = { status: 'complete' | 'incomplete' | 'no_profile'; missing?: ProfileField[] } | null;

let qc: QueryClient;
let gate: Gate;
let nights: { going_count: number; people: GoingPerson[] };
let myGoing: boolean;
let setReply: (args: { p_going: boolean }) => Promise<{ data: unknown; error: { message: string } | null }>;

const tree = (props: Partial<Parameters<typeof RsvpBlock>[0]> = {}, Lazy = LazyBlock) => {
  const inner = (
    <Suspense fallback={<RsvpBlockPlaceholder />}>
      <Lazy publicEventId={PUBLIC_ID} occurrenceId={OCC} occurrence={occ()} seriesLifecycle="live" {...props} />
    </Suspense>
  );
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/event/some-night?occurrenceId=' + OCC]}>
        {gate === null ? (
          inner
        ) : (
          <ProfileGateContext.Provider value={profileGateValue({ status: gate.status, missing: gate.missing ?? [], profileId: 'p1' })}>
            {inner}
          </ProfileGateContext.Provider>
        )}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const mount = async (props: Partial<Parameters<typeof RsvpBlock>[0]> = {}) => {
  const view = render(tree(props));
  await screen.findByTestId('rsvp-block');
  return view;
};

/** Waits until the tile has stopped loading (people read, own going read). */
const settled = () =>
  waitFor(() => {
    expect(screen.getByTestId('rsvp-block').getAttribute('data-state')).not.toBe('loading');
    expect(screen.queryByTestId('going-people') ?? screen.queryByTestId('rsvp-people-error')).toBeTruthy();
  });

const callsOf = (fn: string) => h.rpc.mock.calls.filter(([name]) => name === fn);
const btn = () => screen.getByTestId('rsvp-going') as HTMLButtonElement;
const message = () => screen.queryByTestId('rsvp-going-message')?.textContent ?? null;

const NAMES = ['Ana', 'Leo', 'Mia', 'Sam', 'Kai', 'Zoe', 'Raf', 'Bea'];
const people = (n: number, over: Partial<GoingPerson> = {}): GoingPerson[] =>
  Array.from({ length: Math.min(n, 8) }, (_, i) => ({ dancer_profile_id: `d${i}`, first_name: NAMES[i], photo_url: null, ...over }));

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  h.user = { id: 'u1' };
  gate = { status: 'complete' };
  nights = { going_count: 0, people: [] };
  myGoing = false;
  setReply = async ({ p_going }) => {
    myGoing = p_going;
    nights = { going_count: nights.going_count + (p_going ? 1 : -1), people: nights.people };
    return { data: { occurrence_id: OCC, going: p_going, changed: true, going_count: nights.going_count }, error: null };
  };
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (fn, args) => {
    if (fn === 'dancer_area_gate_v1') return { data: { open: true, allowed: true }, error: null };
    if (fn === 'get_nights_going_v1') {
      const ids = (args?.p_occurrence_ids as string[]) ?? [];
      return { data: ids.map((id) => ({ occurrence_id: id, ...nights })), error: null };
    }
    if (fn === 'get_my_going_v1') {
      return { data: { upcoming: myGoing ? [{ occurrence_id: OCC, is_cancelled: false }] : [], past: [] }, error: null };
    }
    if (fn === 'set_my_going_v1') return setReply(args as { p_going: boolean });
    return { data: null, error: null };
  });
});
afterEach(cleanup);

describe('the tile x night shape', () => {
  it('live night: title, the night in full, "No one going yet", the invitation and the button', async () => {
    await mount();
    await settled();
    expect(screen.getByRole('heading').textContent).toBe(GOING_COPY.tileTitle);
    expect(screen.getByTestId('rsvp-night').textContent).toBe('Thursday 29 Oct \u00b7 9 PM');
    expect(screen.getByTestId('going-count').textContent).toBe('No one going yet');
    expect(btn().textContent).toBe(GOING_COPY.go);
    expect(btn().disabled).toBe(false);
    expect(message()).toBe(GOING_COPY.beFirst);
  });

  it.each([
    ['ended, with an end time', { startsAt: PAST, endsAt: '2020-01-03 02:00:00' }, 'live', 'night_ended'],
    ['ended, no end time (past 04:00 next morning)', { startsAt: PAST, endsAt: null }, 'live', 'night_ended'],
    ['cancelled', { isCancelled: true }, 'live', 'night_cancelled'],
    ['event paused', {}, 'paused', 'event_not_live'],
    ['event ended, future night', {}, 'ended', 'event_not_live'],
  ] as const)('%s: disabled with the reason', async (_n, over, lifecycle, state) => {
    nights = { going_count: 5, people: people(5) };
    await mount({ occurrence: occ(over), seriesLifecycle: lifecycle });
    await waitFor(() => expect(screen.getByTestId('rsvp-block').getAttribute('data-state')).toBe(state));
    expect(btn().disabled).toBe(true);
    expect(message()).toBeTruthy();
    if (state === 'night_ended') {
      expect(screen.getByRole('heading').textContent).toBe(GOING_COPY.tileTitlePast);
      await waitFor(() => expect(screen.getByTestId('going-count').textContent).toBe('5 went'));
    }
    expect(callsOf('set_my_going_v1')).toHaveLength(0);
  });

  it('a "time to be confirmed" night shows the date alone', async () => {
    await mount({ occurrence: occ({ hasTimedSession: false }) });
    expect(screen.getByTestId('rsvp-night').textContent).toBe('Thursday 29 Oct');
  });

  it('going on a cancelled night: can take the name off', async () => {
    myGoing = true;
    nights = { going_count: 1, people: people(1) };
    await mount({ occurrence: occ({ isCancelled: true }) });
    await waitFor(() => expect(btn().textContent).toBe(GOING_COPY.going));
    expect(btn().disabled).toBe(false);
    expect(message()).toBe(GOING_COPY.cancelledGoing);
  });
});

describe('the tile x going count x person shape', () => {
  it.each([
    [0, 'No one going yet', 0, null],
    [1, '1 going', 1, null],
    [3, '3 going', 3, null],
    [8, '8 going', 8, null],
    [9, '9 going', 8, '+1'],
    [200, '200 going', 8, '+192'],
  ] as const)('%i going', async (count, text, shown, more) => {
    nights = { going_count: count, people: people(count) };
    await mount();
    await settled();
    expect(screen.getByTestId('going-count').textContent).toBe(text);
    expect(screen.queryAllByTestId('going-person-link')).toHaveLength(shown);
    if (more) expect(screen.getByTestId('going-more').textContent).toContain(more);
    else expect(screen.queryByTestId('going-more')).toBeNull();
    // The invitation only when nobody is going.
    expect(message()).toBe(count === 0 ? GOING_COPY.beFirst : null);
  });

  it('photo / no photo / null id (hidden public page = name only, no link)', async () => {
    nights = {
      going_count: 3,
      people: [
        { dancer_profile_id: 'd1', first_name: 'Ana', photo_url: 'https://cdn.example/a.jpg' },
        { dancer_profile_id: 'd2', first_name: 'Leo', photo_url: null },
        { dancer_profile_id: null, first_name: 'Mia', photo_url: null },
      ],
    };
    await mount();
    await settled();
    expect(screen.getAllByTestId('going-photo')).toHaveLength(1);
    expect(screen.getAllByTestId('going-initial').map((e) => e.textContent)).toEqual(['L', 'M']);
    expect(screen.getAllByTestId('going-person-link').map((a) => a.getAttribute('href'))).toEqual(['/dancers/d1', '/dancers/d2']);
    expect(screen.getByTestId('going-person').textContent).toContain('Mia');
  });

  it('reads the night with ONE batched request of the exact shape; anonymous readers too', async () => {
    h.user = null;
    gate = null;
    await mount();
    await settled();
    expect(callsOf('get_nights_going_v1')).toEqual([['get_nights_going_v1', { p_occurrence_ids: [OCC], p_limit: 8 }]]);
    expect(callsOf('get_my_going_v1')).toHaveLength(0); // signed out: no own-list read
  });

  it('people read fails: says so and offers a retry', async () => {
    h.rpc.mockImplementation(async (fn) =>
      fn === 'get_nights_going_v1' ? { data: null, error: { message: 'boom' } } : { data: { upcoming: [], past: [] }, error: null },
    );
    await mount();
    expect((await screen.findByTestId('rsvp-people-error')).textContent).toContain(GOING_COPY.peopleLoadFailed);
    const retry = screen.getByRole('button', { name: GOING_COPY.retry });
    expect(retry.className).toMatch(/min-h-\[44px\]/);
  });

  it('a save in flight: the count moves, the viewer is never shown as "+1 more"', async () => {
    nights = { going_count: 3, people: people(3) };
    setReply = () => new Promise(() => {});
    await mount();
    await settled();
    await waitFor(() => expect(btn().disabled).toBe(false));
    fireEvent.click(btn());
    await waitFor(() => expect(screen.getByTestId('going-count').textContent).toBe('4 going'));
    expect(screen.queryByTestId('going-more')).toBeNull();
  });

  it.each([
    ['people read fails', { data: null, error: { message: 'boom' } }],
    ['the database dropped the id', { data: [], error: null }],
  ] as const)('%s: claims no count (no "Be the first", no "No one going yet"), offers a retry, the button still works', async (_n, reply) => {
    h.rpc.mockImplementation(async (fn) => (fn === 'get_nights_going_v1' ? reply : { data: { upcoming: [], past: [] }, error: null }));
    await mount();
    await screen.findByTestId('rsvp-people-error');
    await waitFor(() => expect(screen.getByTestId('rsvp-block').getAttribute('data-state')).toBe('can_tap'));
    expect(message()).toBeNull();
    expect(screen.getByTestId('rsvp-block').textContent).not.toContain(GOING_COPY.beFirst);
    expect(screen.getByTestId('rsvp-block').textContent).not.toContain(goingCountText(0));
    expect(btn().disabled).toBe(false);
  });
});

describe('the tile x viewer', () => {
  it.each([
    ['signed out', null],
    ['anonymous', { id: 'anon', is_anonymous: true }],
  ] as const)('%s: "Sign in to say you\u2019re going" opens the sign-in prompt, never the RPC', async (_n, user) => {
    h.user = user as typeof h.user;
    gate = null;
    await mount();
    await waitFor(() => expect(btn().textContent).toBe(GOING_COPY.signIn));
    fireEvent.click(btn());
    expect((await screen.findByTestId('auth-prompt')).textContent).toBe(`${GOING_COPY.signInTitle} | ${GOING_COPY.signInBody}`);
    expect(callsOf('set_my_going_v1')).toHaveLength(0);
    expect(callsOf('get_my_going_v1')).toHaveLength(0);
  });

  it.each([
    [['first_name'], 'first name'],
    [['based_city_id'], 'city'],
    [['dance_role'], 'dance role'],
    [['avatar_url'], 'photo'],
    [['dance_role', 'avatar_url'], 'dance role and photo'],
  ] as const)('unfinished (%j): names it, links to the Finish screen (which comes back here), button off', async (missing, words) => {
    gate = { status: 'incomplete', missing: [...missing] };
    await mount();
    await waitFor(() =>
      expect(screen.getByTestId('rsvp-going-link').getAttribute('href')).toBe(
        `/finish-profile?returnTo=${encodeURIComponent('/event/some-night?occurrenceId=' + OCC)}`,
      ),
    );
    expect(message()).toContain(`Add your ${words} to say you\u2019re going.`);
    expect(btn().disabled).toBe(true);
  });

  it('finished, going: "You\u2019re going \u00b7 Undo" and how to undo', async () => {
    myGoing = true;
    nights = { going_count: 1, people: people(1) };
    await mount();
    await waitFor(() => expect(btn().textContent).toBe(GOING_COPY.going));
    expect(btn().getAttribute('aria-pressed')).toBe('true');
    expect(message()).toBe(GOING_COPY.goingUndoHint);
  });

  it('tap sets going with the exact payload, optimistically; tap again undoes', async () => {
    let release: () => void = () => {};
    const real = setReply;
    setReply = (a) => new Promise((res) => (release = () => void real(a).then(res)));
    await mount();
    await settled();
    fireEvent.click(btn());
    await waitFor(() => expect(screen.getByTestId('going-count').textContent).toBe('1 going'));
    expect(btn().disabled).toBe(true); // in flight
    expect(message()).toBe(GOING_COPY.saving);
    expect(callsOf('set_my_going_v1')).toEqual([['set_my_going_v1', { p_occurrence_id: OCC, p_going: true }]]);
    await act(async () => release());
    await waitFor(() => expect(btn().textContent).toBe(GOING_COPY.going));
    await waitFor(() => expect(btn().disabled).toBe(false));

    setReply = real;
    fireEvent.click(btn());
    await waitFor(() => expect(btn().textContent).toBe(GOING_COPY.go));
    expect(callsOf('set_my_going_v1')[1]).toEqual(['set_my_going_v1', { p_occurrence_id: OCC, p_going: false }]);
    await waitFor(() => expect(screen.getByTestId('going-count').textContent).toBe('No one going yet'));
  });

  it.each([
    ['rate_limited', GOING_COPY.rateLimited, 'rate_limited'],
    ['night_ended', GOING_COPY.ended, 'night_ended'],
    ['profile_incomplete', GOING_COPY.unfinishedGeneral, 'profile_unfinished'],
  ] as const)('refused with %s: rolls the count back and shows that state', async (code, words, state) => {
    nights = { going_count: 2, people: people(2) };
    setReply = async () => ({ data: null, error: { message: code } });
    await mount();
    await settled();
    fireEvent.click(btn());
    await waitFor(() => expect(screen.getByTestId('rsvp-block').getAttribute('data-state')).toBe(state));
    expect(message()?.startsWith(words)).toBe(true);
    expect(screen.getByTestId('going-count').textContent).toBe('2 going');
    expect(btn().getAttribute('aria-pressed')).toBe('false');
  });

  it('network error: rolls back, says check your connection, button still usable', async () => {
    setReply = async () => {
      throw new TypeError('Failed to fetch');
    };
    await mount();
    await settled();
    fireEvent.click(btn());
    await waitFor(() => expect(message()).toBe(GOING_COPY.network));
    expect(btn().disabled).toBe(false);
    expect(screen.getByTestId('going-count').textContent).toBe('No one going yet');
  });

  it('a tap after the night ends on an open page turns into "Who went" instead of writing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.setSystemTime(new Date('2026-10-29T22:00:00Z'));
      await mount({ occurrence: occ({ startsAt: '2026-10-29 21:00:00', endsAt: '2026-10-29 23:00:00' }) });
      await settled();
      expect(btn().disabled).toBe(false);
      vi.setSystemTime(new Date('2026-10-29T23:30:00Z'));
      fireEvent.click(btn());
      await waitFor(() => expect(screen.getByTestId('rsvp-block').getAttribute('data-state')).toBe('night_ended'));
      expect(callsOf('set_my_going_v1')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the placeholder', () => {
  it('shows a disabled stand-in until the lazy chunk lands', async () => {
    render(tree({}, makeLazy()));
    const ph = screen.getByTestId('rsvp-placeholder');
    expect(ph.querySelector('button')?.disabled).toBe(true);
    await screen.findByTestId('rsvp-block');
    expect(screen.queryByTestId('rsvp-placeholder')).toBeNull();
  });

  it('is the tile copied: same classes and the same words as GOING_COPY', () => {
    expect(Placeholder.PLACEHOLDER_TITLE_CLASS).toBe(Block.TILE_TITLE_CLASS);
    expect(Placeholder.PLACEHOLDER_BODY_CLASS).toBe(Block.TILE_BODY_CLASS);
    expect(Placeholder.PLACEHOLDER_NIGHT_CLASS).toBe(Block.TILE_NIGHT_CLASS);
    expect(Placeholder.PLACEHOLDER_WORDS).toEqual({ title: GOING_COPY.tileTitle, label: GOING_COPY.tileLabel, go: GOING_COPY.go });
  });

  it('imports nothing but the switch (a shared import would split the event route chunk)', () => {
    const src = readFileSync(path.resolve(__dirname, '../../src/modules/event-page/bento/blocks/RsvpBlockPlaceholder.tsx'), 'utf8');
    const imports = [...src.matchAll(/^import .* from '([^']+)';/gm)].map((m) => m[1]);
    expect(imports).toEqual(['react', '@/lib/goingCheckin']);
  });

  it('the tile never offers "Interested"', async () => {
    await mount();
    await settled();
    expect(screen.getByTestId('rsvp-block').textContent).not.toMatch(/interested/i);
  });
});
