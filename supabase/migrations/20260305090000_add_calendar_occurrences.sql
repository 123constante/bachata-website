-- Calendar occurrences + time blocks for deterministic tabs and recurrence

create type event_block_type as enum ('class', 'party');

create table if not exists event_time_blocks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  block_type event_block_type not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists event_occurrences (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  local_date date not null,
  timezone text not null default 'UTC',
  is_cancelled boolean not null default false,
  is_override boolean not null default false,
  has_class boolean not null default false,
  has_party boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_occurrences_time_order check (ends_at >= starts_at)
);

create unique index if not exists event_occurrences_event_start_idx on event_occurrences (event_id, starts_at);
create index if not exists event_occurrences_starts_at_idx on event_occurrences (starts_at);
create index if not exists event_occurrences_local_date_idx on event_occurrences (local_date);
create index if not exists event_occurrences_event_id_idx on event_occurrences (event_id);

create table if not exists event_occurrence_blocks (
  id uuid primary key default gen_random_uuid(),
  occurrence_id uuid not null references event_occurrences(id) on delete cascade,
  block_type event_block_type not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  constraint event_occurrence_blocks_time_order check (ends_at >= starts_at)
);

create index if not exists event_occurrence_blocks_occurrence_id_idx on event_occurrence_blocks (occurrence_id);

-- Backfill default time blocks from legacy key_times JSON (if present)
insert into event_time_blocks (event_id, block_type, start_time, end_time)
select
  e.id,
  'class'::event_block_type,
  nullif(e.key_times->'classes'->>'start', '')::time,
  nullif(e.key_times->'classes'->>'end', '')::time
from events e
where e.key_times ? 'classes'
  and nullif(e.key_times->'classes'->>'start', '') is not null
  and nullif(e.key_times->'classes'->>'end', '') is not null
on conflict do nothing;

insert into event_time_blocks (event_id, block_type, start_time, end_time)
select
  e.id,
  'party'::event_block_type,
  nullif(e.key_times->'party'->>'start', '')::time,
  nullif(e.key_times->'party'->>'end', '')::time
from events e
where e.key_times ? 'party'
  and nullif(e.key_times->'party'->>'start', '') is not null
  and nullif(e.key_times->'party'->>'end', '') is not null
on conflict do nothing;

-- Materialize occurrences for non-recurring + weekly recurrence.
-- Recurrence JSON contract expected:
-- {
--   "freq": "weekly",
--   "interval": 1,
--   "byweekday": [0,1,2,3,4,5,6],
--   "until": "2026-12-31",
--   "count": 40
-- }
create or replace function calendar_refresh_occurrences(range_start timestamptz, range_end timestamptz)
returns void
language plpgsql
as $$
declare
begin
  -- Non-recurring events
  insert into event_occurrences (
    event_id,
    starts_at,
    ends_at,
    local_date,
    timezone,
    has_class,
    has_party
  )
  select
    e.id,
    e.start_time,
    coalesce(e.end_time, e.start_time),
    (e.start_time at time zone coalesce(e.timezone, 'UTC'))::date,
    coalesce(e.timezone, 'UTC'),
    exists (select 1 from event_time_blocks b where b.event_id = e.id and b.block_type = 'class'),
    exists (select 1 from event_time_blocks b where b.event_id = e.id and b.block_type = 'party')
  from events e
  where e.start_time is not null
    and (e.recurrence is null or e.recurrence = '{}'::jsonb)
    and e.start_time >= range_start
    and e.start_time <= range_end
  on conflict (event_id, starts_at)
  do update set
    ends_at = excluded.ends_at,
    local_date = excluded.local_date,
    timezone = excluded.timezone,
    has_class = excluded.has_class,
    has_party = excluded.has_party,
    updated_at = now();

  -- Weekly recurring events
  insert into event_occurrences (
    event_id,
    starts_at,
    ends_at,
    local_date,
    timezone,
    has_class,
    has_party
  )
  select
    e.id,
    make_timestamptz(
      extract(year from d)::int,
      extract(month from d)::int,
      extract(day from d)::int,
      extract(hour from local_start)::int,
      extract(minute from local_start)::int,
      floor(extract(second from local_start))::int,
      tz
    ) as starts_at,
    make_timestamptz(
      extract(year from d)::int,
      extract(month from d)::int,
      extract(day from d)::int,
      extract(hour from local_start)::int,
      extract(minute from local_start)::int,
      floor(extract(second from local_start))::int,
      tz
    ) + duration as ends_at,
    d as local_date,
    tz,
    exists (select 1 from event_time_blocks b where b.event_id = e.id and b.block_type = 'class'),
    exists (select 1 from event_time_blocks b where b.event_id = e.id and b.block_type = 'party')
  from (
    select
      e.*, 
      coalesce(e.timezone, 'UTC') as tz,
      (e.start_time at time zone coalesce(e.timezone, 'UTC')) as local_start,
      (coalesce(e.end_time, e.start_time) - e.start_time) as duration,
      nullif(e.recurrence->>'interval', '')::int as interval_value,
      nullif(e.recurrence->>'count', '')::int as count_value,
      nullif(e.recurrence->>'until', '')::date as until_date,
      e.recurrence->'byweekday' as byweekday
    from events e
    where e.start_time is not null
      and e.recurrence->>'freq' = 'weekly'
  ) e
  cross join lateral (
    select d::date as d
    from generate_series(
      (range_start at time zone e.tz)::date,
      (range_end at time zone e.tz)::date,
      interval '1 day'
    ) d
  ) g
  where (
      e.until_date is null or g.d <= e.until_date
    )
    and (
      e.interval_value is null
      or ((g.d - (e.local_start::date)) % (e.interval_value * 7) = 0)
    )
    and (
      e.byweekday is null
      or extract(dow from g.d) in (
        select value::int from jsonb_array_elements_text(e.byweekday)
      )
    )
    and (
      make_timestamptz(
        extract(year from g.d)::int,
        extract(month from g.d)::int,
        extract(day from g.d)::int,
        extract(hour from e.local_start)::int,
        extract(minute from e.local_start)::int,
        floor(extract(second from e.local_start))::int,
        e.tz
      ) between range_start and range_end
    )
  on conflict (event_id, starts_at)
  do update set
    ends_at = excluded.ends_at,
    local_date = excluded.local_date,
    timezone = excluded.timezone,
    has_class = excluded.has_class,
    has_party = excluded.has_party,
    updated_at = now();

  -- Refresh occurrence blocks for the range
  delete from event_occurrence_blocks b
  using event_occurrences o
  where o.id = b.occurrence_id
    and o.starts_at >= range_start
    and o.starts_at <= range_end;

  insert into event_occurrence_blocks (
    occurrence_id,
    block_type,
    starts_at,
    ends_at
  )
  select
    o.id,
    b.block_type,
    make_timestamptz(
      extract(year from o.local_date)::int,
      extract(month from o.local_date)::int,
      extract(day from o.local_date)::int,
      extract(hour from b.start_time)::int,
      extract(minute from b.start_time)::int,
      floor(extract(second from b.start_time))::int,
      o.timezone
    ) as starts_at,
    make_timestamptz(
      extract(year from o.local_date)::int,
      extract(month from o.local_date)::int,
      extract(day from o.local_date)::int,
      extract(hour from b.end_time)::int,
      extract(minute from b.end_time)::int,
      floor(extract(second from b.end_time))::int,
      o.timezone
    ) as ends_at
  from event_occurrences o
  join event_time_blocks b on b.event_id = o.event_id
  where o.starts_at >= range_start
    and o.starts_at <= range_end;
end;
$$;

create or replace view calendar_occurrences as
select
  o.id as occurrence_id,
  o.event_id,
  e.name,
  o.starts_at,
  o.ends_at,
  o.local_date,
  o.timezone,
  o.has_class,
  o.has_party,
  o.is_cancelled,
  e.type,
  e.location,
  e.venue_id,
  v.name as venue_name,
  coalesce(c.slug, e.city_slug) as city_slug,
  e.photo_url,
  e.cover_image_url
from event_occurrences o
join events e on e.id = o.event_id
left join venues v on v.id = e.venue_id
left join cities c on c.id = v.city_id;
