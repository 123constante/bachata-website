import { beforeEach, describe, expect, it, vi } from 'vitest';

const notCalls = vi.hoisted(() => [] as unknown[][]);
const row = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('@/integrations/supabase/client', () => {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.not = (...a: unknown[]) => {
    notCalls.push(a);
    return builder;
  };
  // Behaves like the database: a row the filters exclude is not returned.
  builder.maybeSingle = async () => {
    const r = row.current;
    const hidden = notCalls.some(([col, , val]) => col === 'lifecycle_status' && String(val).includes(String(r?.lifecycle_status)));
    return { data: hidden ? null : r, error: null };
  };
  return { supabase: { from: () => builder } };
});

import { fetchOrganiserEntity, fetchOwnOrganiserEntity } from '../organiserPublicProfile';

beforeEach(() => {
  notCalls.length = 0;
});

describe('organiser public page visibility', () => {
  it.each([
    ['live', true],
    ['archived', false],
    ['rejected', false],
  ])('a %s page with is_active NULL is public: %s', async (lifecycle_status, visible) => {
    row.current = { id: 'o1', name: 'X', is_active: null, lifecycle_status, city_id: null };
    const got = await fetchOrganiserEntity('o1');
    expect(got !== null).toBe(visible);
  });

  it('the owner read has no lifecycle filter', async () => {
    row.current = { id: 'o1', name: 'X', is_active: null, lifecycle_status: 'draft', city_id: null };
    expect(await fetchOwnOrganiserEntity('o1')).not.toBeNull();
    expect(notCalls).toHaveLength(0);
  });
});
