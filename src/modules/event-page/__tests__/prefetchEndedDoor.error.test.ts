// Review S1 (PR #913): a FAILED door fetch must not be dehydrated into the
// edge-cached /event HTML as an empty success, or every visitor gets no door
// until the cache expires. Errored queries are not dehydrated, so the client
// fetches the door itself.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, dehydrate } from '@tanstack/react-query';

const rpc = vi.fn();
const orgResult = vi.fn();

vi.mock('@/integrations/supabase/client', () => {
  const chain = {
    select: () => chain,
    in: () => chain,
    not: () => Promise.resolve(orgResult()),
  };
  return { supabase: { rpc: (...a: unknown[]) => rpc(...a), from: () => chain } };
});

import { prefetchEndedDoor } from '../sections/MoreEventsSection';

const OTHER_ORG = 'more-events:other-organisers';
const failure = { message: 'boom', code: '500' };

const dehydratedKeys = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await prefetchEndedDoor(qc, { currentEventId: 'ev-1', organiserId: null, citySlug: 'london' });
  return dehydrate(qc).queries.map((q) => q.queryKey[0]);
};

describe('prefetchEndedDoor: the other-organisers door', () => {
  beforeEach(() => {
    rpc.mockReset();
    orgResult.mockReset();
  });

  it('dehydrates nothing when get_organiser_event_counts errors', async () => {
    rpc.mockResolvedValue({ data: null, error: failure });
    expect(await dehydratedKeys()).not.toContain(OTHER_ORG);
  });

  it('dehydrates nothing when the organiser_profiles select errors', async () => {
    rpc.mockResolvedValue({ data: [{ entity_id: 'org-2', event_count: 3 }], error: null });
    orgResult.mockReturnValue({ data: null, error: failure });
    expect(await dehydratedKeys()).not.toContain(OTHER_ORG);
  });

  it('still dehydrates the door when both reads succeed', async () => {
    rpc.mockResolvedValue({ data: [{ entity_id: 'org-2', event_count: 3 }], error: null });
    orgResult.mockReturnValue({ data: [{ id: 'org-2', name: 'Org Two', avatar_url: null }], error: null });
    expect(await dehydratedKeys()).toContain(OTHER_ORG);
  });
});
