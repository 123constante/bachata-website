/**
 * An in-memory stand-in for the Supabase client, shaped like the prod reads the
 * dancer home, the Finish screen and the rating card make (measured 2026-10-11,
 * see the PR's "Verified on real data"):
 *
 * - `_my_dancer_profile_id_v1` -> the persona id, or NULL (no dancer row, or an archived one);
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
  /** The surname switch (absent = the column cannot be read). Written only by a boolean in the save payload, like the live function. */
  hide_surname_publicly?: boolean;
  /** Absent/null = no surname (prod: set on 56 of 166 rows). */
  surname?: string | null;
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
        // Like _dancer_profile_id_for_account_v1 (admin 20261110070000): an ARCHIVED row never resolves.
        return ok(state.row && !state.row.archived_at ? 'persona-1' : null);
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
        // Like the live COALESCE(NULLIF(x,''), old): a null or empty surname leaves the column alone.
        if (typeof p?.surname === 'string' && p.surname !== '') state.row.surname = p.surname;
        if (typeof p?.hide_surname_publicly === 'boolean') state.row.hide_surname_publicly = p.hide_surname_publicly;
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
export const FULL: DancerRow = { first_name: 'Ana', based_city_id: CITY.id, dance_role: 'Follower', avatar_url: 'https://img.example/ana.jpg', archived_at: null, hide_surname_publicly: false };

/**
 * The dancer-row shapes (prod counts 2026-10-11, re-surveyed for the PR): 166
 * rows -- 52 no first name, 73 no city, 153 no dance role, 68 no photo, 30 every
 * field empty, 12 complete, 15 archived, 5 claimed. 16 accounts: 2 no dancer
 * row, 5 stubs, 5 partly filled, 4 complete; 3 of them claim an organiser.
 */
export const ROW_SHAPES: { name: string; row: DancerRow | null }[] = [
  { name: 'no dancer row at all', row: null },
  { name: 'stub, every field empty', row: { ...EMPTY } },
  { name: 'partly filled (name + city; role and photo missing)', row: { ...EMPTY, first_name: 'Ana', based_city_id: CITY.id } },
  { name: 'complete', row: { ...FULL } },
  { name: 'archived (partly filled)', row: { ...EMPTY, first_name: 'Ana', archived_at: '2026-09-01T00:00:00Z' } },
];

/** The role shapes: organisers owned/managed and access requests. */
export const ROLE_SHAPES: { name: string; organisers: number; requests: { status: string }[] }[] = [
  { name: 'no organiser', organisers: 0, requests: [] },
  { name: 'organiser', organisers: 1, requests: [] },
  { name: 'open access request', organisers: 0, requests: [{ status: 'open' }] },
];
