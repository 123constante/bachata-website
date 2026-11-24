/**
 * Part A: the page team read never touches is_leader (select or order).
 */
import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  leaders: [] as { member_profile_id: string }[],
  limits: [] as number[],
  selects: [] as string[],
  orders: [] as string[],
  profile: null as null | { id: string; first_name: string | null; surname: string | null; display_name: string | null },
}));

vi.mock('@/integrations/supabase/client', () => {
  const team: Record<string, unknown> = {};
  team.select = (s: string) => {
    h.selects.push(s);
    return team;
  };
  team.eq = () => team;
  team.order = (c: string) => {
    h.orders.push(c);
    return team;
  };
  team.limit = (n: number) => {
    h.limits.push(n);
    return Promise.resolve({ data: h.leaders.slice(0, n), error: null });
  };
  const people: Record<string, unknown> = {};
  people.select = () => people;
  people.eq = () => people;
  people.maybeSingle = async () => ({ data: h.profile, error: null });
  return { supabase: { from: (t: string) => (t === 'organiser_team_members' ? team : people) } };
});

import { fetchPageTeam } from '../invitePersonApi';

describe('fetchPageTeam', () => {
  it('never reads is_leader (select or order)', async () => {
    h.selects = [];
    h.orders = [];
    h.leaders = [];
    expect(await fetchPageTeam('o1')).toEqual([]);
    expect(h.selects).toEqual(['member_profile_id']);
    expect(h.selects.join(' ') + h.orders.join(' ')).not.toContain('is_leader');
  });
});
