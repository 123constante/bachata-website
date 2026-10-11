/**
 * An in-memory stand-in for the Supabase client, shaped like the prod reads the
 * dancer home, the Finish screen and the rating card make (measured 2026-10-11,
 * see the PR's "Verified on real data"):
 *
 * - `_my_dancer_profile_id_v1` -> the persona id, or NULL (no dancer row);
 * - `profile_complete_v1`      -> the server's definition (all four non-empty after trim);
 * - `dancer_profiles` select   -> the persona's row (city embedded by name);
 * - `organiser_home_v1`, `list_organiser_access_requests_v1` ('mine');
 * - `save_my_dancer_profile_v1` -> '' leaves a column unchanged, like the live function;
 * - `series_level_summary_p5_v1`, `rate_series_level_p5_v1` (refuses 'profile_incomplete'
 *   while the profile is unfinished, like the live gate).
 *
 * Tests mock '@/integrations/supabase/client' with `{ supabase: backend.client }`.
 */

export type DancerRow = {
  first_name: string | null;
  based_city_id: string | null;
  dance_role: string | null;
  avatar_url: string | null;
  archived_at: string | null;
};

export const CITY = { id: 'city-london', name: 'London' };

export type BackendState = {
  /** null = the account has no dancer row at all. */
  row: DancerRow | null;
  organisers: number;
  requests: { status: string }[];
  organiserHomeFails?: boolean;
  requestsFail?: boolean;
  /** The dancer_profiles summary select fails (the completeness RPCs still answer). */
  summaryFails?: boolean;
};

const filled = (v: string | null) => typeof v === 'string' && v.trim().length > 0;

export const isComplete = (row: DancerRow | null) =>
  !!row && filled(row.first_name) && filled(row.based_city_id) && filled(row.dance_role) && filled(row.avatar_url);

export function makeBackend(initial: BackendState) {
  const state: BackendState = structuredClone(initial);
  const calls: { name: string; args: unknown }[] = [];
  const ok = (data: unknown) => Promise.resolve({ data, error: null });
  const fail = (message: string) => Promise.resolve({ data: null, error: { message } });

  const rpc = (name: string, args?: Record<string, unknown>) => {
    calls.push({ name, args });
    switch (name) {
      case '_my_dancer_profile_id_v1':
        return ok(state.row ? 'persona-1' : null);
      case 'profile_complete_v1':
        return ok(isComplete(state.row));
      case 'organiser_home_v1':
        if (state.organiserHomeFails) return fail('statement timeout');
        return ok({
          today: '2026-10-11',
          organisers: Array.from({ length: state.organisers }, (_, i) => ({
            id: `org-${i}`, name: `Org ${i}`, slug: null, avatar_url: null, city_id: null,
            lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [],
          })),
        });
      case 'list_organiser_access_requests_v1':
        if (state.requestsFail) return fail('statement timeout');
        return ok(state.requests.map((r, i) => ({
          request_id: `req-${i}`, organiser_name: `Org ${i}`, status: r.status,
          created_at: '2026-10-01T10:00:00Z', resolved_at: r.status === 'open' ? null : '2026-10-02T10:00:00Z',
        })));
      case 'save_my_dancer_profile_v1': {
        if (!state.row) return fail('no dancer profile');
        const p = (args?.p_payload ?? args?.payload ?? args) as Record<string, unknown>;
        for (const key of ['first_name', 'based_city_id', 'dance_role', 'avatar_url'] as const) {
          const v = p?.[key];
          if (typeof v === 'string' && v !== '') state.row[key] = v;
        }
        return ok({ id: 'persona-1' });
      }
      case 'series_level_summary_p5_v1':
        return ok({ series_id: 'ev1', vote_count: 0, threshold: 7, counts: null, derived_level: null, my_level: null });
      case 'rate_series_level_p5_v1':
        return isComplete(state.row) ? ok(null) : fail('profile_incomplete');
      default:
        return ok([]);
    }
  };

  const from = (table: string) => {
    let columns = '';
    const builder = {
      select(cols: string) {
        columns = cols;
        return builder;
      },
      eq() {
        return builder;
      },
      ilike() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      maybeSingle() {
        calls.push({ name: `table:${table}`, args: columns });
        if (table !== 'dancer_profiles' || !state.row) return ok(null);
        const row: Record<string, unknown> = { id: 'persona-1', ...state.row };
        if (columns.includes('city:') && state.summaryFails) return fail('statement timeout');
        if (columns.includes('city:')) row.city = state.row.based_city_id === CITY.id ? { name: CITY.name } : null;
        return ok(row);
      },
      then(resolve: (v: unknown) => unknown) {
        return ok([]).then(resolve);
      },
    };
    return builder;
  };

  return { state, calls, client: { rpc, from, auth: {} } };
}

export type Backend = ReturnType<typeof makeBackend>;

const EMPTY: DancerRow = { first_name: null, based_city_id: null, dance_role: null, avatar_url: null, archived_at: null };
const FULL: DancerRow = { first_name: 'Ana', based_city_id: CITY.id, dance_role: 'Follower', avatar_url: 'https://img.example/ana.jpg', archived_at: null };

/**
 * The prod shapes (counts 2026-10-11): 166 dancer rows -- 52 no first name, 73 no
 * city, 153 no dance role, 68 no photo, 30 every field empty, 12 complete, 15
 * archived; 16 accounts, 2 with no dancer row; 4 users run an organiser; 1 open
 * access request, held by a user with no organiser.
 */
export const DANCER_SHAPES: { name: string; state: BackendState }[] = [
  { name: 'brand-new account, no dancer row', state: { row: null, organisers: 0, requests: [] } },
  { name: 'stub, every field empty', state: { row: { ...EMPTY }, organisers: 0, requests: [] } },
  { name: 'whitespace-only name (trim)', state: { row: { ...EMPTY, first_name: '   ' }, organisers: 0, requests: [] } },
  { name: 'partly filled: name + city', state: { row: { ...EMPTY, first_name: 'Ana', based_city_id: CITY.id }, organisers: 0, requests: [] } },
  { name: 'only the dance role missing (most common gap)', state: { row: { ...FULL, dance_role: null }, organisers: 0, requests: [] } },
  { name: 'complete', state: { row: { ...FULL }, organisers: 0, requests: [] } },
  { name: 'complete, role stored as "Lead and Follow"', state: { row: { ...FULL, dance_role: 'Lead and Follow' }, organisers: 0, requests: [] } },
  { name: 'archived, partly filled', state: { row: { ...EMPTY, first_name: 'Ana', archived_at: '2026-09-01T00:00:00Z' }, organisers: 0, requests: [] } },
  { name: 'declined access request only', state: { row: { ...FULL }, organisers: 0, requests: [{ status: 'declined' }] } },
  { name: 'organiser read failed', state: { row: { ...EMPTY, first_name: 'Ana' }, organisers: 0, requests: [], organiserHomeFails: true } },
  { name: 'access-request read failed', state: { row: { ...FULL }, organisers: 0, requests: [], requestsFail: true } },
];

export const ORGANISER_SHAPES: { name: string; state: BackendState }[] = [
  { name: 'runs one organiser', state: { row: { ...FULL }, organisers: 1, requests: [] } },
  { name: 'runs two organisers, profile empty', state: { row: { ...EMPTY }, organisers: 2, requests: [] } },
  { name: 'no organiser, open access request', state: { row: { ...EMPTY }, organisers: 0, requests: [{ status: 'open' }] } },
  { name: 'no dancer row, runs an organiser', state: { row: null, organisers: 1, requests: [] } },
];
