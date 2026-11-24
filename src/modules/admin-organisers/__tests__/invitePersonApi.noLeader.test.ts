/**
 * Organiser onboarding S3e prerequisite: the Leader idea is gone, so no query or select string in the
 * invite flow may name organiser_team_members.is_leader (the column is dropped later).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const h = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock('@/integrations/supabase/client', () => {
  const chain = (table: string): Record<string, unknown> => {
    const c: Record<string, unknown> = {};
    const rec = (name: string) => (...a: unknown[]) => {
      h.calls.push(`${table}.${name}(${a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(',')})`);
      return c;
    };
    for (const m of ['select', 'eq', 'in', 'is', 'order']) c[m] = rec(m);
    c.limit = (n: number) => {
      h.calls.push(`${table}.limit(${n})`);
      return Promise.resolve({ data: table === 'organiser_team_members' ? [{ member_profile_id: 'p1' }] : [{ id: 'p1', first_name: 'Rosa', surname: 'Lima', display_name: null }], error: null });
    };
    c.then = (res: (v: unknown) => unknown) => res({ data: [{ id: 'p1', first_name: 'Rosa', surname: 'Lima', display_name: null }], error: null });
    return c;
  };
  return { supabase: { from: (t: string) => chain(t) } };
});

import { fetchPageTeam } from '../invitePersonApi';

beforeEach(() => {
  h.calls = [];
});

describe('the invite flow does not read is_leader', () => {
  it('fetchPageTeam: no query or select string contains is_leader, and the rows carry no isLeader', async () => {
    const team = await fetchPageTeam('o1');
    expect(h.calls.length).toBeGreaterThan(0);
    expect(h.calls.filter((c) => c.includes('is_leader'))).toEqual([]);
    expect(team).toEqual([{ id: 'p1', name: 'Rosa Lima', firstName: 'Rosa' }]);
  });

  it('no source file in admin-organisers names is_leader', () => {
    const dir = join(__dirname, '..');
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '__tests__' ? [] : walk(join(d, e.name))) : [join(d, e.name)]));
    const hits = walk(dir).filter((f) => /\.tsx?$/.test(f) && /is_leader/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
