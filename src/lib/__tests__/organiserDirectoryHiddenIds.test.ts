// @vitest-environment node
/**
 * F1: self-started organiser pages that are not yet visible (D3: hidden until
 * a published event or Trusted) come back from the admin RPC
 * organiser_directory_hidden_ids_v1() and are subtracted from the THREE public
 * reads of organiser_profiles -- the /organisers list, the homepage organiser
 * count and the sitemap -- through ONE helper, called once per read.
 *
 * Prod returns {} today (0 self-started pages), so these hidden cases are
 * carried by the tests, not by live data.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { table: string; method: string; args: unknown[] };
type Row = { id: string; slug: string | null; name: string; updated_at: string; city_id: string | null };

const h = vi.hoisted(() => ({
  calls: [] as Call[],
  rpcCalls: [] as string[],
  hidden: [] as unknown,
  hiddenError: null as unknown,
  rows: [] as Row[],
}));

// Applies the recorded `.not('id', 'in', '(a,b)')` filters so a head-only count
// really excludes what the query asked it to exclude.
function applyIdNots(rows: Row[], calls: Call[]): Row[] {
  let out = rows;
  for (const c of calls) {
    if (c.method !== 'not' || c.args[0] !== 'id' || c.args[1] !== 'in') continue;
    const ids = String(c.args[2]).replace(/^\(|\)$/g, '').split(',');
    out = out.filter((r) => !ids.includes(r.id));
  }
  return out;
}

vi.mock('@/integrations/supabase/client', () => {
  const builder = (table: string): Record<string, unknown> => {
    const own: Call[] = [];
    let head = false;
    const b: Record<string, unknown> = {};
    for (const method of ['select', 'neq', 'order', 'limit', 'not', 'eq', 'in']) {
      b[method] = (...args: unknown[]) => {
        const call = { table, method, args };
        own.push(call);
        h.calls.push(call);
        if (method === 'select' && (args[1] as { head?: boolean } | undefined)?.head) head = true;
        return b;
      };
    }
    b.then = (resolve: (v: unknown) => unknown) => {
      const rows = table === 'organiser_profiles' ? applyIdNots(h.rows, own) : [];
      const result = head ? { data: null, count: rows.length, error: null } : { data: rows, error: null };
      return Promise.resolve(result).then(resolve);
    };
    return b;
  };
  const rpc = (fn: string) => {
    h.rpcCalls.push(fn);
    if (fn === 'organiser_directory_hidden_ids_v1') {
      return Promise.resolve({ data: h.hiddenError ? null : h.hidden, error: h.hiddenError });
    }
    return Promise.resolve({ data: [], error: null });
  };
  return { supabase: { from: (t: string) => builder(t), rpc } };
});
vi.mock('@/lib/featureFlags', () => ({
  flags: { teachersDirectory: true, organisersDirectory: true, venueDetail: true, organiserDetail: true, teacherDetail: true },
}));

import { fetchOrganiserDirectoryHiddenIds } from '@/lib/organiserDirectoryHiddenIds';
import { fetchDirectoryOrganisers } from '@/lib/organiserDirectoryList';
import { fetchOrganiserCount } from '@/hooks/useDirectoryCounts';

const ROWS: Row[] = [
  { id: 'a1', slug: 'alpha', name: 'Alpha', updated_at: '2026-10-01T00:00:00Z', city_id: null },
  { id: 'b2', slug: 'bravo', name: 'Bravo', updated_at: '2026-10-02T00:00:00Z', city_id: null },
  { id: 'c3', slug: 'charlie', name: 'Charlie', updated_at: '2026-10-03T00:00:00Z', city_id: null },
];

const HIDDEN_CASES: { label: string; hidden: string[] }[] = [
  { label: 'none hidden', hidden: [] },
  { label: 'one hidden', hidden: ['b2'] },
  { label: 'all hidden', hidden: ['a1', 'b2', 'c3'] },
];

const hiddenRpcCount = () => h.rpcCalls.filter((f) => f === 'organiser_directory_hidden_ids_v1').length;
const idNots = () => h.calls.filter((c) => c.table === 'organiser_profiles' && c.method === 'not' && c.args[0] === 'id');

beforeEach(() => {
  h.calls.length = 0;
  h.rpcCalls.length = 0;
  h.hidden = [];
  h.hiddenError = null;
  h.rows = ROWS;
});

describe('fetchOrganiserDirectoryHiddenIds', () => {
  const client = (data: unknown, error: unknown = null) =>
    ({ rpc: vi.fn(() => Promise.resolve({ data, error })) }) as never;

  it.each([
    { label: 'empty {}', data: [], want: [] },
    { label: 'one id', data: ['a1'], want: ['a1'] },
    { label: 'several ids', data: ['a1', 'b2', 'c3'], want: ['a1', 'b2', 'c3'] },
    { label: 'null data from a successful call is empty', data: null, want: [] },
  ])('$label', async ({ data, want }) => {
    const c = client(data);
    await expect(fetchOrganiserDirectoryHiddenIds(c)).resolves.toEqual(want);
    expect((c as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith('organiser_directory_hidden_ids_v1');
  });

  it('throws the RPC error rather than failing open', async () => {
    const err = { message: 'boom', code: 'XX000' };
    await expect(fetchOrganiserDirectoryHiddenIds(client(null, err))).rejects.toBe(err);
  });

  it('throws on a non-array payload', async () => {
    await expect(fetchOrganiserDirectoryHiddenIds(client({ nope: 1 }))).rejects.toThrow(/array/);
  });
});

describe.each(HIDDEN_CASES)('organiser reads with $label', ({ hidden }) => {
  const visible = ROWS.filter((r) => !hidden.includes(r.id));

  it('the /organisers directory list omits exactly the hidden rows (one RPC call)', async () => {
    h.hidden = hidden;
    const list = await fetchDirectoryOrganisers();
    expect(list.map((o) => o.id)).toEqual(visible.map((r) => r.id));
    expect(hiddenRpcCount()).toBe(1);
  });

  it('the homepage organiser count excludes exactly the hidden ids, head-only', async () => {
    h.hidden = hidden;
    await expect(fetchOrganiserCount()).resolves.toBe(visible.length);
    expect(hiddenRpcCount()).toBe(1);
    const select = h.calls.find((c) => c.table === 'organiser_profiles' && c.method === 'select');
    expect(select?.args[1]).toEqual({ count: 'exact', head: true });
    // An empty array adds no `.not('id', ...)` filter at all.
    expect(idNots()).toHaveLength(hidden.length === 0 ? 0 : 1);
  });

  it('the sitemap never lists a hidden organiser slug (one RPC call)', async () => {
    h.hidden = hidden;
    const { loader } = await import('../../../app/routes/sitemap');
    const res = (await loader()) as Response;
    const xml = await res.text();
    for (const r of ROWS) {
      const loc = `/organisers/${r.slug}<`;
      expect(xml.includes(loc), r.slug ?? r.id).toBe(!hidden.includes(r.id));
    }
    expect(hiddenRpcCount()).toBe(1);
  });
});

describe('RPC error propagates from every read', () => {
  it.each([
    ['directory list', () => fetchDirectoryOrganisers()],
    ['homepage count', () => fetchOrganiserCount()],
  ])('%s throws', async (_label, run) => {
    h.hiddenError = { message: 'boom' };
    await expect(run()).rejects.toEqual({ message: 'boom' });
  });

  it('sitemap answers 500 rather than submitting hidden URLs', async () => {
    h.hiddenError = { message: 'boom' };
    const { loader } = await import('../../../app/routes/sitemap');
    let status: number | undefined;
    try {
      status = ((await loader()) as Response).status;
    } catch (thrown) {
      status = (thrown as Response).status;
    }
    expect(status).toBe(500);
  });
});

describe('one rule, one helper', () => {
  it.each(['src/lib/organiserDirectoryList.ts', 'src/hooks/useDirectoryCounts.ts', 'app/routes/sitemap.tsx'])(
    '%s imports the shared helper and never names the RPC itself',
    (file) => {
      const src = readFileSync(file, 'utf8');
      expect(src).toMatch(/from ['"]@\/lib\/organiserDirectoryHiddenIds['"]/);
      expect(src).not.toMatch(/organiser_directory_hidden_ids_v1/);
    },
  );

  it('the /organisers page reads its list through fetchDirectoryOrganisers', () => {
    const src = readFileSync('src/pages/Organisers.tsx', 'utf8');
    expect(src).toMatch(/from ['"]@\/lib\/organiserDirectoryList['"]/);
    expect(src).not.toMatch(/\.from\(['"]organiser_profiles['"]\)/);
  });
});
