// @vitest-environment jsdom
/** Ambassador shared link (/join/a/:code): every viewer x every link shape, the join-tap rules,
 *  and the refusals. RPC shapes are the ones re-read on prod 2026-11-06 (admin PR #1277). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import AmbassadorLinkPage from '../AmbassadorLinkPage';
import { CALENDAR_HREF, COPY, inviteHeading, joinRefusal, landingView, parseLookup } from '../linkLandingModel';

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  user: null as null | { id: string; is_anonymous?: boolean },
  isLoading: false,
  cityReads: [] as { slug: unknown }[],
  cityFails: false,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (fn: string, args?: Record<string, unknown>) => h.rpc(fn, args),
    from: (table: string) => {
      const b = {
        select: () => b,
        eq: (_c: string, v: unknown) => (h.cityReads.push({ slug: v }), b),
        maybeSingle: async () => (table === 'cities' && !h.cityFails ? { data: { id: 'c-1', name: 'Testville' }, error: null } : { data: null, error: { message: 'no' } }),
      };
      return b;
    },
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user, isLoading: h.isLoading }) }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

const LOOKUP = {
  okNamed: { status: 'ok', first_name: 'Jan', city_name: 'Testville', city_slug: 'testville-gb', is_active: true },
  okNoName: { status: 'ok', first_name: null, city_name: 'Testville', city_slug: 'testville-gb', is_active: true },
  notFound: { status: 'not_found' },
  // A status the client does not know (e.g. an admin lock added later): plain not found, never a retry.
  locked: { status: 'locked' },
} as const;
type LookupCase = keyof typeof LOOKUP | 'rpcError';

function answer(lookup: LookupCase, join: unknown = { status: 'joined', city_name: 'Testville', city_slug: 'testville-gb' }) {
  h.rpc.mockImplementation(async (fn: string) => {
    if (fn === 'get_ambassador_link_public_v1') return lookup === 'rpcError' ? { data: null, error: { message: 'network' } } : { data: LOOKUP[lookup], error: null };
    if (fn === 'record_ambassador_link_join_v1') {
      if (typeof join === 'string') return { data: null, error: { message: join } };
      if (join && typeof join === 'object' && 'error' in join) return { data: null, error: (join as { error: unknown }).error };
      return { data: join, error: null };
    }
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
}
const joins = () => h.rpc.mock.calls.filter(([fn]) => fn === 'record_ambassador_link_join_v1');
const writes = () => h.rpc.mock.calls.filter(([fn]) => fn !== 'get_ambassador_link_public_v1');

function open(code = 'abc123def456') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/join/a/${code}`]}>
        <Routes><Route path="/join/a/:code" element={<AmbassadorLinkPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const state = () => screen.getByTestId('ambassador-link').getAttribute('data-state');
const settled = () => waitFor(() => expect(state()).not.toBe('loading'));
const buttons = () => screen.queryAllByRole('button').map((b) => b.textContent);
const links = () => screen.queryAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);

beforeEach(() => { h.rpc.mockReset(); h.user = null; h.isLoading = false; h.cityReads = []; h.cityFails = false; });
afterEach(() => cleanup());

type Viewer = 'signed-out' | 'signed-in' | 'already-joined';
const VIEWERS: Viewer[] = ['signed-out', 'signed-in', 'already-joined'];
const LOOKUPS: LookupCase[] = ['okNamed', 'okNoName', 'notFound', 'locked', 'rpcError'];

describe('viewer x link shape matrix', () => {
  for (const viewer of VIEWERS) for (const lookup of LOOKUPS) {
    it(`${viewer} x ${lookup}`, async () => {
      h.user = viewer === 'signed-out' ? null : { id: 'u-joiner' };
      answer(lookup, viewer === 'already-joined' ? { status: 'already_joined', city_name: 'Testville', city_slug: 'testville-gb' } : undefined);
      open();
      await settled();
      if (lookup === 'rpcError') {
        expect(state()).toBe('error');
        expect(screen.getByTestId('link-heading').textContent).toBe(COPY.errorHeading);
        expect(buttons()).toEqual(['Try again']);
        return;
      }
      if (lookup === 'notFound' || lookup === 'locked') {
        expect(state()).toBe('not_found');
        expect(screen.getByTestId('link-body').textContent).toBe('This link is switched off or wrong. Ask whoever sent it for a new one.');
        expect(links().map(([t]) => t)).toEqual(['Contact us']);
        expect(links()[0][1]).toMatch(/^https:\/\/wa\.me\//);
        expect(buttons()).toEqual([]);
        return;
      }
      const heading = lookup === 'okNamed' ? 'Jan invited you to Testville' : 'You are invited to Testville';
      expect(screen.getByTestId('link-heading').textContent).toBe(heading);
      await waitFor(() => expect(screen.getByTestId('link-city-chip').textContent).toBe('Testville'));
      if (viewer === 'signed-out') {
        expect(state()).toBe('signed-out');
        const ret = encodeURIComponent('/join/a/abc123def456');
        expect(links()).toEqual([['Create account', `/auth?mode=signup&returnTo=${ret}`], ['Sign in', `/auth?mode=signin&returnTo=${ret}`]]);
        expect(buttons()).toEqual([]);
        return;
      }
      expect(state()).toBe('invite');
      const btn = screen.getByTestId('link-join') as HTMLButtonElement;
      expect(btn.textContent).toBe('Join Testville');
      expect(btn.disabled).toBe(false);
      fireEvent.click(btn);
      await waitFor(() => expect(['joined', 'already_joined']).toContain(state()));
      expect(screen.getByTestId('link-heading').textContent).toBe(viewer === 'already-joined' ? 'You already joined Testville' : 'You joined Testville');
      expect(links()).toEqual([[COPY.next, '/app']]);
      expect(joins()).toHaveLength(1);
    });
  }
});

describe('join tap rules', () => {
  it('never writes on render: an untouched page sends no write', async () => {
    h.user = { id: 'u-joiner' };
    answer('okNamed');
    open();
    await settled();
    await new Promise((r) => setTimeout(r, 30));
    expect(writes()).toEqual([]);
  });

  it('fires exactly once per tap, even on a double tap; the button says why it is disabled meanwhile', async () => {
    h.user = { id: 'u-joiner' };
    let release!: () => void;
    h.rpc.mockImplementation(async (fn: string) => {
      if (fn === 'get_ambassador_link_public_v1') return { data: LOOKUP.okNamed, error: null };
      await new Promise<void>((r) => { release = r; });
      return { data: { status: 'joined', city_name: 'Testville', city_slug: 'testville-gb' }, error: null };
    });
    open();
    await settled();
    const btn = screen.getByTestId('link-join') as HTMLButtonElement;
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(btn.disabled).toBe(true));
    expect(screen.getByTestId('link-join-reason').textContent).toBe(COPY.joiningReason);
    expect(joins()).toHaveLength(1);
    expect(joins()[0][1]).toEqual({ p_code: 'abc123def456' });
    release();
    await waitFor(() => expect(state()).toBe('joined'));
    expect(joins()).toHaveLength(1);
  });

  it('a malformed (too long) code is never sent and shows not found', async () => {
    answer('okNamed');
    open('x'.repeat(65));
    await settled();
    expect(state()).toBe('not_found');
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('while sign-in is still resolving the Join button is disabled with a reason', async () => {
    h.isLoading = true;
    answer('okNamed');
    open();
    await settled();
    expect((screen.getByTestId('link-join') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('link-join-reason').textContent).toBe(COPY.resolvingReason);
  });

  it('reads the fixed chip from cities by the link slug', async () => {
    h.user = { id: 'u-joiner' };
    answer('okNamed');
    open();
    await waitFor(() => expect(h.cityReads).toEqual([{ slug: 'testville-gb' }]));
  });

  it('chip falls back to the RPC city name when the cities read fails', async () => {
    h.user = { id: 'u-joiner' };
    h.rpc.mockImplementation(async (fn: string) =>
      fn === 'get_ambassador_link_public_v1' ? { data: { ...LOOKUP.okNamed, city_name: 'Rpcville' }, error: null } : { data: null, error: { message: 'unexpected' } });
    // Control: with the read working, the chip shows the cities row name, so the fallback below is not vacuous.
    open();
    await waitFor(() => expect(screen.getByTestId('link-city-chip').textContent).toBe('Testville'));
    cleanup();
    h.cityFails = true;
    h.cityReads = [];
    open();
    await waitFor(() => expect(h.cityReads).toEqual([{ slug: 'testville-gb' }]));
    await settled();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId('link-city-chip').textContent).toBe('Rpcville');
    expect(screen.getByTestId('link-heading').textContent).toBe('Jan invited you to Rpcville');
  });
});

describe('refusals render one plain sentence, never a raw code', () => {
  const RAW = /authentication_required|own_link|link_not_found|P0001/;
  it('own link', async () => {
    h.user = { id: 'u-jan' };
    answer('okNamed', 'own_link');
    open();
    await settled();
    fireEvent.click(screen.getByTestId('link-join'));
    await waitFor(() => expect(screen.getByTestId('link-join-reason').textContent).toBe(COPY.ownLink));
    expect((screen.getByTestId('link-join') as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).not.toMatch(RAW);
  });
  it('anonymous session refused by the server', async () => {
    h.user = { id: 'u-anon' };
    answer('okNamed', 'authentication_required');
    open();
    await settled();
    fireEvent.click(screen.getByTestId('link-join'));
    await waitFor(() => expect(screen.getByTestId('link-notice').textContent).toBe(COPY.anonymous('Testville')));
    expect(state()).toBe('signed-out');
    expect(document.body.textContent).not.toMatch(RAW);
  });
  it('anonymous session known up front: sign-in buttons, one sentence, no Join', async () => {
    h.user = { id: 'u-anon', is_anonymous: true };
    answer('okNamed');
    open();
    await settled();
    expect(screen.getByTestId('link-notice').textContent).toBe(COPY.anonymous('Testville'));
    expect(screen.queryByTestId('link-join')).toBeNull();
    expect(writes()).toEqual([]);
  });
  it('link switched off between load and tap', async () => {
    h.user = { id: 'u-joiner' };
    answer('okNamed', 'link_not_found');
    open();
    await settled();
    fireEvent.click(screen.getByTestId('link-join'));
    await waitFor(() => expect(state()).toBe('not_found'));
    expect(screen.getByTestId('link-notice').textContent).toBe(COPY.linkGone);
    expect(document.body.textContent).not.toMatch(RAW);
  });
  for (const [label, join] of [
    ['an unknown RAISE (e.g. a profile the server requires)', { error: { message: 'dancer_profile_required', code: 'P0001', details: null, hint: null } }],
    ['a rate limit from the server', { error: { message: 'too many requests', code: 'PGRST000' } }],
    ['an unexpected success shape', { status: 'weird' }],
  ] as const) {
    it(`server refusal, ${label}: calm way out, no connection blame, no retry loop`, async () => {
      h.user = { id: 'u-joiner' };
      answer('okNamed', join);
      open();
      await settled();
      fireEvent.click(screen.getByTestId('link-join'));
      await waitFor(() => expect(state()).toBe('refused'));
      expect(screen.getByTestId('link-heading').textContent).toBe(COPY.refusedHeading('Testville'));
      expect(screen.getByTestId('link-body').textContent).toBe(COPY.refusedBody);
      expect(screen.queryByTestId('link-join')).toBeNull();
      expect(buttons()).toEqual([]);
      const l = links();
      expect(l.map(([t]) => t)).toEqual([COPY.contact, COPY.backToCalendar]);
      expect(l[0][1]).toMatch(/^https:\/\/wa\.me\//);
      expect(l[1][1]).toBe(CALENDAR_HREF);
      expect(document.body.textContent).not.toMatch(/connection/i);
      expect(document.body.textContent).not.toMatch(/dancer_profile_required|PGRST|P0001|unexpected_shape/);
      expect(joins()).toHaveLength(1);
    });
  }
  it('network failure (never reached the server): retryable sentence, Join stays enabled', async () => {
    h.user = { id: 'u-joiner' };
    answer('okNamed', 'Failed to fetch');
    open();
    await settled();
    fireEvent.click(screen.getByTestId('link-join'));
    await waitFor(() => expect(screen.getByTestId('link-notice').textContent).toBe(COPY.joinFailed));
    expect((screen.getByTestId('link-join') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('model', () => {
  it('heading falls back when first_name is blank', () => {
    expect(inviteHeading('  ', 'Bristol')).toBe('You are invited to Bristol');
    expect(parseLookup({ ...LOOKUP.okNamed, first_name: '' })).toMatchObject({ firstName: null });
  });
  it('an unknown lookup status is not found; a broken ok shape is an error, not a guess', () => {
    expect(parseLookup({ status: 'weird' })).toEqual({ status: 'not_found' });
    expect(parseLookup({ status: 'locked' })).toEqual({ status: 'not_found' });
    expect(() => parseLookup({ status: 'ok', first_name: 'Jan' })).toThrow();
    expect(() => parseLookup(null)).toThrow();
  });
  it('joinRefusal: three server codes, any other server error is refused, only a network error is failed', () => {
    const rows: [unknown, string][] = [
      [{ message: 'own_link', code: 'P0001' }, 'own_link'],
      [{ message: 'link_not_found', code: 'P0001' }, 'link_not_found'],
      [{ message: 'authentication_required' }, 'authentication_required'],
      [{ message: 'dancer_profile_required', code: 'P0001' }, 'refused'],
      [{ message: 'JWT expired', code: 'PGRST301' }, 'refused'],
      [new Error('ambassador_join_unexpected_shape'), 'refused'],
      [{ message: 'TypeError: Failed to fetch', code: '' }, 'failed'],
      [new TypeError('Failed to fetch'), 'failed'],
      [new Error('boom'), 'failed'],
      [null, 'failed'],
    ];
    for (const [err, want] of rows) expect(joinRefusal(err), JSON.stringify(err)).toBe(want);
  });
  it('every state with actions names what the person can do; every disabled button has a reason', () => {
    const sig = (r: string, m: string) => `${m}:${r}`;
    for (const viewer of ['resolving', 'signed-out', 'anonymous', 'signed-in'] as const)
      for (const lookup of ['error', { status: 'not_found' }, { status: 'ok', firstName: null, cityName: 'B', citySlug: 'b' }] as const)
        for (const join of [{ kind: 'idle' }, { kind: 'pending' }, { kind: 'refused', refusal: 'own_link' }, { kind: 'refused', refusal: 'refused' }, { kind: 'refused', refusal: 'failed' }] as const) {
          const v = landingView({ viewer, lookup, join, returnTo: '/x', signInHref: sig, contactHref: 'https://wa.me/1' });
          expect(v.actions.length, `${viewer}/${JSON.stringify(lookup)}/${join.kind}`).toBeGreaterThan(0);
          for (const a of v.actions) if (a.kind === 'join' && a.disabled) expect(a.reason).toBeTruthy();
        }
  });
});
