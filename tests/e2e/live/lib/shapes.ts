// Shape discovery for the Layer 1 matrix: which real production events have
// which shape TODAY. Read at run time, never pinned in a fixture, because the
// shapes drift daily (a live series runs out of dates; a paused one resumes).
//
// HOW IT READS. One SELECT through the Supabase Management API
// (`POST /v1/projects/<ref>/database/query`), sent with `read_only: true` AND
// wrapped in `set transaction read only`, so Postgres itself refuses any write
// the text might contain. The anon key cannot do this: event_series_p5 and
// event_occurrence_p5 return [] to anon (measured 2026-10-08), and paused /
// archived series are reachable by no anon route at all.
//
// WHAT IT RETURNS. Slugs and booleans/counts only -- no personal data. ZZ TEST
// rows are excluded: Layer 1 is about real shapes. Picks rotate daily
// (md5(slug || current_date)) so the matrix walks the whole population over
// time instead of the same two events forever; every run logs its picks.
//
// Needs SUPABASE_ACCESS_TOKEN. Without it the matrix SKIPS with that reason
// (it does not guess shapes).

export const PROJECT_REF = process.env.LIVE_QA_PROJECT_REF || 'stsdtacfauprzrdebmzg';

export type Shape = {
  slug: string;
  /** Every id a screen may put in an /event/<id> href (series, public event, legacy). */
  ids: string[];
  name: string;
  lifecycle: 'live' | 'ended' | 'paused' | 'archived' | 'draft' | string;
  format: string | null;
  /** Dates in total; "multi" when more than one. */
  n_dates: number;
  n_future_live: number;
  n_future_cancelled: number;
  n_past: number;
  /** Next date that is not cancelled, YYYY-MM-DD (London), or null. */
  next_live_date: string | null;
  has_ticket: boolean;
  has_desc: boolean;
  organiser_slugs: string[];
  /** lifecycle|single-or-multi|future-or-past_only|cancelled-or-not|ticket-or-not */
  shape_key: string;
};

export type EmptyOrganiser = { slug: string };

export const SHAPES_SQL = `
with today as (select (now() at time zone 'Europe/London')::date d),
occ as (
  select series_id,
    count(*) n,
    count(*) filter (where occurrence_date >= (select d from today) and lifecycle_status <> 'cancelled') n_future_live,
    count(*) filter (where occurrence_date >= (select d from today) and lifecycle_status = 'cancelled') n_future_cancelled,
    count(*) filter (where occurrence_date < (select d from today)) n_past,
    count(*) filter (where lifecycle_status = 'cancelled') n_cancelled,
    min(occurrence_date) filter (where occurrence_date >= (select d from today) and lifecycle_status <> 'cancelled') next_live_date
  from event_occurrence_p5 group by 1),
orgs as (
  select so.series_id, array_agg(op.slug order by so.is_primary desc nulls last, so.ord nulls last) slugs
  from event_series_organiser_p5 so join organiser_profiles op on op.id = so.organiser_id
  where op.slug is not null and op.lifecycle_status = 'live' and coalesce(op.is_active, true)
  group by 1),
s as (
  select s.slug, s.name, s.lifecycle_status lifecycle, s.format,
    array_remove(array[s.id, s.public_event_id, s.legacy_event_id, s.v3_series_id]::text[], null) ids,
    coalesce(o.n, 0)::int n_dates,
    coalesce(o.n_future_live, 0)::int n_future_live,
    coalesce(o.n_future_cancelled, 0)::int n_future_cancelled,
    coalesce(o.n_past, 0)::int n_past,
    o.next_live_date::text next_live_date,
    coalesce(s.ticket_url, s.default_ticket_url) is not null has_ticket,
    coalesce(btrim(s.default_description), '') <> '' has_desc,
    coalesce(g.slugs, '{}') organiser_slugs,
    concat_ws('|', s.lifecycle_status,
      case when coalesce(o.n, 0) > 1 then 'multi' else 'single' end,
      case when coalesce(o.n_future_live, 0) + coalesce(o.n_future_cancelled, 0) > 0 then 'future' else 'past_only' end,
      case when coalesce(o.n_cancelled, 0) > 0 then 'cancelled' else 'no_cancel' end,
      case when coalesce(s.ticket_url, s.default_ticket_url) is not null then 'ticket' else 'no_ticket' end) shape_key,
    row_number() over (
      partition by s.lifecycle_status,
        coalesce(o.n, 0) > 1,
        coalesce(o.n_future_live, 0) + coalesce(o.n_future_cancelled, 0) > 0,
        coalesce(o.n_cancelled, 0) > 0,
        coalesce(s.ticket_url, s.default_ticket_url) is not null
      order by md5(s.slug || (select d from today)::text)) rn
  from event_series_p5 s
  left join occ o on o.series_id = s.id
  left join orgs g on g.series_id = s.id
  where not coalesce(s.is_template, false) and s.slug is not null
    and s.name !~* '^\\s*zz' and s.slug !~* '^zz')
select json_build_object(
  'shapes', coalesce((select json_agg(row_to_json(x) order by x.shape_key, x.slug) from (
    select slug, ids, name, lifecycle, format, n_dates, n_future_live, n_future_cancelled, n_past, next_live_date,
      has_ticket, has_desc, organiser_slugs, shape_key from s where rn <= 1
    union all
    -- The longest live series, when it is over the 100-row API page: lists
    -- that page at 100 have truncated it before.
    select * from (select slug, ids, name, lifecycle, format, n_dates, n_future_live, n_future_cancelled, n_past, next_live_date,
      has_ticket, has_desc, organiser_slugs, shape_key || '|over100' as shape_key from s
      where lifecycle = 'live' and n_dates > 100 order by n_dates desc limit 1) big) x), '[]'::json),
  'empty_organisers', coalesce((select json_agg(json_build_object('slug', op.slug) order by op.slug) from organiser_profiles op
    where op.slug is not null and op.slug !~* '^zz' and op.lifecycle_status = 'live' and coalesce(op.is_active, true)
      and not exists (select 1 from event_series_organiser_p5 so join event_series_p5 es on es.id = so.series_id
        where so.organiser_id = op.id and es.lifecycle_status in ('live', 'ended', 'paused'))), '[]'::json)
) result`;

export type Survey = { shapes: Shape[]; empty_organisers: EmptyOrganiser[] };

export async function survey(): Promise<Survey | { skip: string }> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) return { skip: 'SUPABASE_ACCESS_TOKEN is not set: the shape matrix needs a read-only survey of prod and does not guess shapes.' };
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `set transaction read only; ${SHAPES_SQL}`, read_only: true }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`shape survey failed: HTTP ${res.status} ${text.slice(0, 300)}`);
  const rows = JSON.parse(text) as { result: Survey }[];
  if (!Array.isArray(rows) || !rows[0]?.result) throw new Error(`shape survey returned no result: ${text.slice(0, 300)}`);
  return rows[0].result;
}
