// @vitest-environment node
/**
 * Unit gate for the shared P5 event-identity resolver
 * (src/lib/seo/resolvePublicEventRef.ts) and the one behaviour it exists to make
 * uniform: events do NOT get a raw-uuid passthrough when the resolve misses.
 *
 * WHY THIS FILE. Before the M2 keystone, four call sites (app/detailLoader,
 * app/routes/event, useEntitySlugOrId, app/lib/ogCardRender) each hand-copied the
 * resolve_public_event_ref_v1 call AND its {id, slug} mapping. Two things are
 * load-bearing across that set and are asserted here:
 *
 *   1. The mapped VALUE. The server loader dehydrates
 *      ['entity-resolve','events','id',param] and the client hook reads the same
 *      key; if the two mappings drift by a byte, the client refetches on every
 *      event page (and, mid-drift, can hydrate a different id than the server
 *      rendered). So the cached value is pinned, not just the return value.
 *
 *   2. throw-vs-swallow. Server loaders MUST rethrow a transient DB error so it
 *      becomes a retryable 500; 404+noindex on a blip deindexes a live event. The
 *      client hook and the OG renderer must NOT throw.
 *
 * And the resolver is also the VISIBILITY GATE -- it returns SQL NULL for a
 * hidden/archived/draft series, never RAISE -- which is why a null resolve for
 * `events` may not fall back to the raw uuid the URL carried. That would 200 an
 * archived event. Non-event tables defer not-found to their content query and
 * keep the passthrough; both halves are covered below.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const sb = vi.hoisted(() => {
  const rpc = vi.fn();
  const maybeSingle = vi.fn();
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }));
  return { rpc, from, maybeSingle };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: sb.rpc, from: sb.from },
}));

import { resolvePublicEventRef } from '@/lib/seo/resolvePublicEventRef';
import { resolveEntityInLoader } from '../app/detailLoader';

const UUID = '11111111-1111-4111-8111-111111111111';
const SERIES_ID = '22222222-2222-4222-8222-222222222222';

const ok = (row: unknown) => ({ data: row, error: null });
const fail = (message: string) => ({ data: null, error: { message } });

beforeEach(() => {
  sb.rpc.mockReset();
  sb.from.mockClear();
  sb.maybeSingle.mockReset();
  sb.maybeSingle.mockResolvedValue({ data: null, error: null });
});

const newQc = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('resolvePublicEventRef', () => {
  it('maps the RPC row to {id, slug} and passes the param as p_param', async () => {
    sb.rpc.mockResolvedValue(ok({ id: UUID, slug: 'sensual-fridays' }));
    await expect(resolvePublicEventRef('sensual-fridays', 'throw')).resolves.toEqual({
      id: UUID,
      slug: 'sensual-fridays',
    });
    expect(sb.rpc).toHaveBeenCalledTimes(1);
    expect(sb.rpc.mock.calls[0][0]).toBe('resolve_public_event_ref_v1');
    expect(sb.rpc.mock.calls[0][1]).toEqual({ p_param: 'sensual-fridays' });
  });

  it('resolves a pure-P5 series to its series id (id = COALESCE(legacy, series))', async () => {
    sb.rpc.mockResolvedValue(ok({ id: SERIES_ID, slug: 'p5-native-fest' }));
    await expect(resolvePublicEventRef('p5-native-fest', 'swallow')).resolves.toEqual({
      id: SERIES_ID,
      slug: 'p5-native-fest',
    });
  });

  it('returns null on a genuine miss (SQL NULL = absent OR hidden/archived)', async () => {
    sb.rpc.mockResolvedValue(ok(null));
    await expect(resolvePublicEventRef('gone', 'throw')).resolves.toBeNull();
    await expect(resolvePublicEventRef('gone', 'swallow')).resolves.toBeNull();
  });

  it('coerces absent id/slug fields to null rather than undefined', async () => {
    sb.rpc.mockResolvedValue(ok({}));
    await expect(resolvePublicEventRef(UUID, 'swallow')).resolves.toEqual({
      id: null,
      slug: null,
    });
  });

  it("onError 'throw' rethrows a transient DB error as an Error", async () => {
    sb.rpc.mockResolvedValue(fail('connection reset'));
    await expect(resolvePublicEventRef('sensual-fridays', 'throw')).rejects.toThrow(
      'connection reset',
    );
  });

  it("onError 'swallow' returns null on a transient DB error", async () => {
    sb.rpc.mockResolvedValue(fail('connection reset'));
    await expect(resolvePublicEventRef('sensual-fridays', 'swallow')).resolves.toBeNull();
  });
});

describe('resolveEntityInLoader: events get no raw-uuid passthrough', () => {
  it('returns id null when an events uuid does not resolve (archived must 404)', async () => {
    sb.rpc.mockResolvedValue(ok(null));
    const ref = await resolveEntityInLoader(newQc(), 'events', UUID);
    expect(ref).toEqual({ id: null, slug: null, arrivedViaUuid: true });
    expect(sb.from).not.toHaveBeenCalled();
  });

  it('keeps the uuid passthrough for NON-event tables (404 deferred to the content query)', async () => {
    const ref = await resolveEntityInLoader(newQc(), 'venues', UUID);
    expect(ref).toEqual({ id: UUID, slug: null, arrivedViaUuid: true });
    expect(sb.rpc).not.toHaveBeenCalled();
  });

  it('caches the resolver value verbatim under the hydration key', async () => {
    sb.rpc.mockResolvedValue(ok({ id: UUID, slug: 'sensual-fridays' }));
    const qc = newQc();
    const ref = await resolveEntityInLoader(qc, 'events', 'sensual-fridays');
    expect(ref).toEqual({ id: UUID, slug: 'sensual-fridays', arrivedViaUuid: false });
    // The exact entry the client hook reads after hydration: two keys, no extras.
    expect(qc.getQueryData(['entity-resolve', 'events', 'id', 'sensual-fridays'])).toEqual({
      id: UUID,
      slug: 'sensual-fridays',
    });
  });

  it('rethrows a transient events resolve error (retryable 500, not a 404)', async () => {
    sb.rpc.mockResolvedValue(fail('connection reset'));
    await expect(resolveEntityInLoader(newQc(), 'events', 'sensual-fridays')).rejects.toThrow(
      'connection reset',
    );
  });

  it('short-circuits a malformed uuid without touching the DB', async () => {
    const ref = await resolveEntityInLoader(newQc(), 'events', '11111111-1111-4111-8111-1234');
    expect(ref).toEqual({ id: null, slug: null, arrivedViaUuid: false });
    expect(sb.rpc).not.toHaveBeenCalled();
  });
});
