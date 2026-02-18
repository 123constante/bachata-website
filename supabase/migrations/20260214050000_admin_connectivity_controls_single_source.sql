-- 20260213_admin_connectivity_controls_single_source.sql
-- Single source of truth: public.event_profile_connections
-- Idempotent + rerunnable

create extension if not exists pgcrypto;

-- =========================================================
-- 0) Admin manager + audit tables (if missing)
-- =========================================================
create table if not exists public.admin_link_managers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'manager' check (role in ('admin', 'manager')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  notes text
);

create table if not exists public.event_profile_link_audit (
  id uuid primary key default gen_random_uuid(),
  link_id uuid,
  event_id uuid,
  profile_id uuid,
  profile_type text,
  role text,
  action text not null check (action in ('create', 'update', 'archive', 'approve_suggestion', 'reject_suggestion')),
  actor_id uuid,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_profile_link_audit_event_id
  on public.event_profile_link_audit(event_id);
create index if not exists idx_event_profile_link_audit_actor_id
  on public.event_profile_link_audit(actor_id);
create index if not exists idx_event_profile_link_audit_created_at
  on public.event_profile_link_audit(created_at desc);

-- =========================================================
-- 1) Helper functions
-- =========================================================
create or replace function public.admin_link_managers_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_admin_link_managers_updated_at on public.admin_link_managers;
create trigger trg_admin_link_managers_updated_at
before update on public.admin_link_managers
for each row
execute function public.admin_link_managers_set_updated_at();

create or replace function public.admin_normalize_name(p_name text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(lower(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

create or replace function public.admin_row_city_matches(
  p_row jsonb,
  p_city_id uuid default null,
  p_city_slug text default null,
  p_city text default null
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_city_id_text text := nullif(coalesce(p_row ->> 'city_id', ''), '');
  v_city_slug text := lower(coalesce(p_row ->> 'city_slug', ''));
  v_city_text text := lower(coalesce(p_row ->> 'city', ''));
begin
  -- city_id-first
  if p_city_id is not null then
    return v_city_id_text = p_city_id::text;
  end if;

  -- legacy fallback by slug
  if p_city_slug is not null and btrim(p_city_slug) <> '' then
    return v_city_slug = lower(p_city_slug) or v_city_text = lower(p_city_slug);
  end if;

  -- legacy fallback by city text
  if p_city is not null and btrim(p_city) <> '' then
    return v_city_text = lower(p_city);
  end if;

  return true;
end;
$$;

create or replace function public.admin_profile_exists(
  p_profile_type text,
  p_profile_id uuid
)
returns boolean
language plpgsql
stable
as $$
begin
  case p_profile_type
    when 'organiser' then
      return exists (select 1 from public.organisers o where o.id = p_profile_id);
    when 'teacher' then
      return exists (select 1 from public.teacher_profiles t where t.id = p_profile_id);
    when 'dj' then
      return exists (select 1 from public.dj_profiles d where d.id = p_profile_id);
    when 'vendor' then
      return exists (select 1 from public.vendors v where v.id = p_profile_id);
    when 'videographer' then
      return exists (select 1 from public.videographers vg where vg.id = p_profile_id);
    when 'dancer' then
      return exists (select 1 from public.dancers da where da.id = p_profile_id);
    when 'venue' then
      return exists (select 1 from public.venues ve where ve.id = p_profile_id);
    else
      return false;
  end case;
end;
$$;

create or replace function public.can_manage_connectivity()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_claim_role text;
  v_claim_app_role text;
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') then
    return true;
  end if;

  if auth.role() = 'service_role' then
    return true;
  end if;

  if v_uid is null then
    return false;
  end if;

  v_claim_role := coalesce(auth.jwt() ->> 'role', '');
  v_claim_app_role := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');

  if lower(v_claim_role) in ('admin', 'manager')
     or lower(v_claim_app_role) in ('admin', 'manager') then
    return true;
  end if;

  return exists (
    select 1
    from public.admin_link_managers m
    where m.user_id = v_uid
      and m.is_active = true
  );
end;
$$;

create or replace function public.admin_log_link_action(
  p_link_id uuid,
  p_event_id uuid,
  p_profile_id uuid,
  p_profile_type text,
  p_role text,
  p_action text,
  p_reason text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_profile_link_audit (
    link_id, event_id, profile_id, profile_type, role, action, actor_id, reason, payload
  )
  values (
    p_link_id, p_event_id, p_profile_id, p_profile_type, p_role, p_action, auth.uid(), p_reason, coalesce(p_payload, '{}'::jsonb)
  );
end;
$$;

-- =========================================================
-- 2) Optional audit trigger on event_profile_connections
--    (create only if required columns exist)
-- =========================================================
create or replace function public.admin_audit_event_profile_connections_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_action text;
  v_link_id uuid;
  v_event_id uuid;
  v_profile_id uuid;
  v_profile_type text;
  v_role text;
  v_reason text;
  v_uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$';
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_action := 'create';
  elsif tg_op = 'UPDATE' then
    v_new := to_jsonb(new);
    v_old := to_jsonb(old);
    if lower(coalesce(v_new ->> 'status', 'active')) = 'archived'
       and lower(coalesce(v_old ->> 'status', 'active')) <> 'archived' then
      v_action := 'archive';
    else
      v_action := 'update';
    end if;
  else
    v_old := to_jsonb(old);
    v_action := 'archive';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if coalesce(v_new ->> 'id', '') ~* v_uuid_pattern then v_link_id := (v_new ->> 'id')::uuid; end if;
    if coalesce(v_new ->> 'event_id', '') ~* v_uuid_pattern then v_event_id := (v_new ->> 'event_id')::uuid; end if;
    if coalesce(v_new ->> 'profile_id', '') ~* v_uuid_pattern then v_profile_id := (v_new ->> 'profile_id')::uuid; end if;
    v_profile_type := lower(coalesce(nullif(v_new ->> 'profile_type', ''), nullif(v_new ->> 'role', '')));
    v_role := lower(coalesce(nullif(v_new ->> 'role', ''), nullif(v_new ->> 'profile_type', '')));
    v_reason := nullif(v_new ->> 'reason', '');
  else
    if coalesce(v_old ->> 'id', '') ~* v_uuid_pattern then v_link_id := (v_old ->> 'id')::uuid; end if;
    if coalesce(v_old ->> 'event_id', '') ~* v_uuid_pattern then v_event_id := (v_old ->> 'event_id')::uuid; end if;
    if coalesce(v_old ->> 'profile_id', '') ~* v_uuid_pattern then v_profile_id := (v_old ->> 'profile_id')::uuid; end if;
    v_profile_type := lower(coalesce(nullif(v_old ->> 'profile_type', ''), nullif(v_old ->> 'role', '')));
    v_role := lower(coalesce(nullif(v_old ->> 'role', ''), nullif(v_old ->> 'profile_type', '')));
    v_reason := nullif(v_old ->> 'reason', '');
  end if;

  perform public.admin_log_link_action(
    v_link_id,
    v_event_id,
    v_profile_id,
    v_profile_type,
    v_role,
    v_action,
    v_reason,
    case
      when tg_op = 'INSERT' then v_new
      when tg_op = 'UPDATE' then jsonb_build_object('old', v_old, 'new', v_new)
      else v_old
    end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  v_table_exists boolean;
  v_required_count integer;
begin
  select to_regclass('public.event_profile_connections') is not null into v_table_exists;

  if v_table_exists then
    select count(*) into v_required_count
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'event_profile_connections'
      and c.column_name in ('id', 'event_id', 'profile_id');

    if v_required_count = 3 then
      execute 'drop trigger if exists trg_admin_audit_event_profile_connections_changes on public.event_profile_connections';
      execute 'create trigger trg_admin_audit_event_profile_connections_changes
               after insert or update or delete on public.event_profile_connections
               for each row
               execute function public.admin_audit_event_profile_connections_changes()';
    end if;
  end if;
end $$;

-- =========================================================
-- 3) Admin RPCs (single source: event_profile_connections)
-- =========================================================
drop function if exists public.admin_get_connectivity_health_metrics(uuid, text, text);
drop function if exists public.admin_get_unlinked_events_queue(uuid, text, text, integer);
drop function if exists public.admin_get_unlinked_profiles_queue(uuid, text, text, integer);
drop function if exists public.admin_get_broken_reference_queue(integer);
drop function if exists public.admin_get_suspected_duplicate_profiles(uuid, text, text, integer);

create function public.admin_get_connectivity_health_metrics(
  p_city_id uuid default null,
  p_city_slug text default null,
  p_city text default null
)
returns table (
  published_events_with_organiser_pct numeric,
  published_events_with_venue_pct numeric,
  profiles_linked_to_at_least_one_event_pct numeric,
  unlinked_events_count bigint,
  unlinked_profiles_count bigint,
  unresolved_city_mappings_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_connectivity() then
    raise exception 'Not authorized to read connectivity health metrics';
  end if;

  return query
  with filtered_events as (
    select
      e.id as event_id,
      to_jsonb(e) as row_json
    from public.events e
    where public.admin_row_city_matches(to_jsonb(e), p_city_id, p_city_slug, p_city)
  ),
  published_events as (
    select fe.event_id
    from filtered_events fe
    where
      lower(coalesce(fe.row_json ->> 'lifecycle_status', '')) = 'published'
      or lower(coalesce(fe.row_json ->> 'is_active', 'false')) in ('true','t','1','yes','y')
  ),
  active_connections as (
    select
      nullif(rc.row_json ->> 'event_id', '') as event_id_text,
      nullif(rc.row_json ->> 'profile_id', '') as profile_id_text,
      lower(coalesce(nullif(rc.row_json ->> 'role', ''), nullif(rc.row_json ->> 'profile_type', ''))) as role_text,
      lower(coalesce(nullif(rc.row_json ->> 'profile_type', ''), nullif(rc.row_json ->> 'role', ''))) as profile_type_text
    from (
      select to_jsonb(c) as row_json
      from public.event_profile_connections c
    ) rc
    where lower(coalesce(nullif(rc.row_json ->> 'status', ''), 'active')) = 'active'
      and nullif(rc.row_json ->> 'archived_at', '') is null
  ),
  event_roles as (
    select
      pe.event_id,
      exists (
        select 1
        from active_connections ac
        where ac.event_id_text = pe.event_id::text
          and ac.role_text = 'organiser'
      ) as has_organiser,
      exists (
        select 1
        from active_connections ac
        where ac.event_id_text = pe.event_id::text
          and ac.role_text = 'venue'
      ) as has_venue
    from published_events pe
  ),
  profile_universe as (
    select 'teacher'::text as profile_type, t.id as profile_id, to_jsonb(t) as row_json from public.teacher_profiles t
    union all select 'dj'::text, d.id, to_jsonb(d) from public.dj_profiles d
    union all select 'organiser'::text, o.id, to_jsonb(o) from public.organisers o
    union all select 'vendor'::text, v.id, to_jsonb(v) from public.vendors v
    union all select 'videographer'::text, vg.id, to_jsonb(vg) from public.videographers vg
    union all select 'dancer'::text, da.id, to_jsonb(da) from public.dancers da
    union all select 'venue'::text, ve.id, to_jsonb(ve) from public.venues ve
  ),
  filtered_profiles as (
    select pu.profile_type, pu.profile_id
    from profile_universe pu
    where public.admin_row_city_matches(pu.row_json, p_city_id, p_city_slug, p_city)
  ),
  linked_profiles as (
    select distinct
      ac.profile_type_text as profile_type,
      ac.profile_id_text as profile_id_text
    from active_connections ac
    join filtered_events fe
      on fe.event_id::text = ac.event_id_text
  ),
  unresolved_city as (
    with source_rows as (
      select to_jsonb(e) as row_json from public.events e
      union all select to_jsonb(t) from public.teacher_profiles t
      union all select to_jsonb(d) from public.dj_profiles d
      union all select to_jsonb(o) from public.organisers o
      union all select to_jsonb(v) from public.vendors v
      union all select to_jsonb(vg) from public.videographers vg
      union all select to_jsonb(da) from public.dancers da
      union all select to_jsonb(ve) from public.venues ve
    )
    select count(*) as total
    from source_rows sr
    where (
      (nullif(coalesce(sr.row_json ->> 'city_id', ''), '') is null and nullif(coalesce(sr.row_json ->> 'city_slug', sr.row_json ->> 'city', ''), '') is not null)
      or
      (nullif(coalesce(sr.row_json ->> 'city_id', ''), '') is not null and not exists (
        select 1 from public.cities c where c.id::text = (sr.row_json ->> 'city_id')
      ))
    )
    and public.admin_row_city_matches(sr.row_json, p_city_id, p_city_slug, p_city)
  )
  select
    coalesce(round((count(*) filter (where er.has_organiser)::numeric / nullif(count(*), 0)::numeric) * 100, 2), 0) as published_events_with_organiser_pct,
    coalesce(round((count(*) filter (where er.has_venue)::numeric / nullif(count(*), 0)::numeric) * 100, 2), 0) as published_events_with_venue_pct,
    coalesce(
      round(
        (
          (
            select count(*)::numeric
            from filtered_profiles fp
            where exists (
              select 1
              from linked_profiles lp
              where lp.profile_type = fp.profile_type
                and lp.profile_id_text = fp.profile_id::text
            )
          )
          /
          nullif((select count(*)::numeric from filtered_profiles), 0)
        ) * 100,
      2),
    0) as profiles_linked_to_at_least_one_event_pct,
    coalesce((select count(*) from event_roles x where not x.has_organiser or not x.has_venue), 0) as unlinked_events_count,
    coalesce((
      select count(*)
      from filtered_profiles fp
      where not exists (
        select 1
        from linked_profiles lp
        where lp.profile_type = fp.profile_type
          and lp.profile_id_text = fp.profile_id::text
      )
    ), 0) as unlinked_profiles_count,
    coalesce((select total from unresolved_city), 0) as unresolved_city_mappings_count
  from event_roles er;
end;
$$;

create function public.admin_get_unlinked_events_queue(
  p_city_id uuid default null,
  p_city_slug text default null,
  p_city text default null,
  p_limit integer default 100
)
returns table (
  event_id uuid,
  event_name text,
  start_time timestamptz,
  city_id_text text,
  city_slug text,
  city text,
  missing_organiser boolean,
  missing_venue boolean,
  reason text
)
language sql
security definer
set search_path = public
as $$
  with filtered_events as (
    select
      e.id as event_id,
      coalesce(nullif(to_jsonb(e) ->> 'name', ''), 'Party ' || e.id::text) as event_name,
      case
        when nullif(to_jsonb(e) ->> 'start_time', '') is null then null
        else (to_jsonb(e) ->> 'start_time')::timestamptz
      end as start_time,
      to_jsonb(e) ->> 'city_id' as city_id_text,
      to_jsonb(e) ->> 'city_slug' as city_slug,
      to_jsonb(e) ->> 'city' as city,
      to_jsonb(e) as row_json
    from public.events e
    where public.admin_row_city_matches(to_jsonb(e), p_city_id, p_city_slug, p_city)
      and (
        lower(coalesce(to_jsonb(e) ->> 'lifecycle_status', '')) = 'published'
        or lower(coalesce(to_jsonb(e) ->> 'is_active', 'false')) in ('true','t','1','yes','y')
      )
  ),
  active_connections as (
    select
      nullif(rc.row_json ->> 'event_id', '') as event_id_text,
      lower(coalesce(nullif(rc.row_json ->> 'role', ''), nullif(rc.row_json ->> 'profile_type', ''))) as role_text
    from (
      select to_jsonb(c) as row_json
      from public.event_profile_connections c
    ) rc
    where lower(coalesce(nullif(rc.row_json ->> 'status', ''), 'active')) = 'active'
      and nullif(rc.row_json ->> 'archived_at', '') is null
  ),
  flags as (
    select
      fe.event_id,
      fe.event_name,
      fe.start_time,
      fe.city_id_text,
      fe.city_slug,
      fe.city,
      not exists (
        select 1
        from active_connections ac
        where ac.event_id_text = fe.event_id::text
          and ac.role_text = 'organiser'
      ) as missing_organiser,
      not exists (
        select 1
        from active_connections ac
        where ac.event_id_text = fe.event_id::text
          and ac.role_text = 'venue'
      ) as missing_venue
    from filtered_events fe
  )
  select
    f.event_id,
    f.event_name,
    f.start_time,
    f.city_id_text,
    f.city_slug,
    f.city,
    f.missing_organiser,
    f.missing_venue,
    case
      when f.missing_organiser and f.missing_venue then 'missing_organiser_and_venue'
      when f.missing_organiser then 'missing_organiser'
      when f.missing_venue then 'missing_venue'
      else 'ok'
    end as reason
  from flags f
  where f.missing_organiser or f.missing_venue
  order by f.start_time nulls last, f.event_id
  limit greatest(coalesce(p_limit, 100), 1);
$$;

create function public.admin_get_unlinked_profiles_queue(
  p_city_id uuid default null,
  p_city_slug text default null,
  p_city text default null,
  p_limit integer default 200
)
returns table (
  profile_type text,
  profile_id uuid,
  display_name text,
  city_id_text text,
  city_slug text,
  city text
)
language sql
security definer
set search_path = public
as $$
  with profile_universe as (
    select
      'teacher'::text as profile_type,
      t.id as profile_id,
      to_jsonb(t) as row_json,
      coalesce(
        nullif(trim(coalesce(to_jsonb(t) ->> 'first_name', '') || ' ' || coalesce(to_jsonb(t) ->> 'surname', '')), ''),
        'Teacher ' || t.id::text
      ) as display_name
    from public.teacher_profiles t

    union all
    select
      'dj'::text,
      d.id,
      to_jsonb(d),
      coalesce(
        nullif(to_jsonb(d) ->> 'dj_name', ''),
        nullif(trim(coalesce(to_jsonb(d) ->> 'first_name', '') || ' ' || coalesce(to_jsonb(d) ->> 'surname', '')), ''),
        'DJ ' || d.id::text
      )
    from public.dj_profiles d

    union all
    select
      'organiser'::text,
      o.id,
      to_jsonb(o),
      coalesce(
        nullif(to_jsonb(o) ->> 'organisation_name', ''),
        nullif(trim(coalesce(to_jsonb(o) ->> 'first_name', '') || ' ' || coalesce(to_jsonb(o) ->> 'surname', '')), ''),
        'Organiser ' || o.id::text
      )
    from public.organisers o

    union all
    select
      'vendor'::text,
      v.id,
      to_jsonb(v),
      coalesce(nullif(to_jsonb(v) ->> 'business_name', ''), 'Vendor ' || v.id::text)
    from public.vendors v

    union all
    select
      'videographer'::text,
      vg.id,
      to_jsonb(vg),
      coalesce(nullif(to_jsonb(vg) ->> 'business_name', ''), 'Videographer ' || vg.id::text)
    from public.videographers vg

    union all
    select
      'dancer'::text,
      da.id,
      to_jsonb(da),
      coalesce(
        nullif(trim(coalesce(to_jsonb(da) ->> 'first_name', '') || ' ' || coalesce(to_jsonb(da) ->> 'surname', '')), ''),
        'Dancer ' || da.id::text
      )
    from public.dancers da

    union all
    select
      'venue'::text,
      ve.id,
      to_jsonb(ve),
      coalesce(nullif(to_jsonb(ve) ->> 'name', ''), 'Venue ' || ve.id::text)
    from public.venues ve
  ),
  filtered_profiles as (
    select
      pu.profile_type,
      pu.profile_id,
      pu.display_name,
      pu.row_json
    from profile_universe pu
    where public.admin_row_city_matches(pu.row_json, p_city_id, p_city_slug, p_city)
  ),
  active_connections as (
    select
      nullif(rc.row_json ->> 'profile_id', '') as profile_id_text,
      lower(coalesce(nullif(rc.row_json ->> 'profile_type', ''), nullif(rc.row_json ->> 'role', ''))) as profile_type_text
    from (
      select to_jsonb(c) as row_json
      from public.event_profile_connections c
    ) rc
    where lower(coalesce(nullif(rc.row_json ->> 'status', ''), 'active')) = 'active'
      and nullif(rc.row_json ->> 'archived_at', '') is null
  )
  select
    fp.profile_type,
    fp.profile_id,
    fp.display_name,
    fp.row_json ->> 'city_id' as city_id_text,
    fp.row_json ->> 'city_slug' as city_slug,
    fp.row_json ->> 'city' as city
  from filtered_profiles fp
  where not exists (
    select 1
    from active_connections ac
    where ac.profile_type_text = fp.profile_type
      and ac.profile_id_text = fp.profile_id::text
  )
  order by fp.profile_type, fp.display_name
  limit greatest(coalesce(p_limit, 200), 1);
$$;

create function public.admin_get_broken_reference_queue(
  p_limit integer default 200
)
returns table (
  event_id uuid,
  role text,
  broken_profile_id text,
  source text,
  detail text
)
language sql
security definer
set search_path = public
as $$
  with connections as (
    select
      nullif(rc.row_json ->> 'event_id', '') as event_id_text,
      nullif(rc.row_json ->> 'profile_id', '') as profile_id_text,
      lower(coalesce(nullif(rc.row_json ->> 'role', ''), nullif(rc.row_json ->> 'profile_type', ''))) as role_text,
      lower(coalesce(nullif(rc.row_json ->> 'profile_type', ''), nullif(rc.row_json ->> 'role', ''))) as profile_type_text,
      lower(coalesce(nullif(rc.row_json ->> 'status', ''), 'active')) as status_text,
      nullif(rc.row_json ->> 'archived_at', '') as archived_at_text
    from (
      select to_jsonb(c) as row_json
      from public.event_profile_connections c
    ) rc
  ),
  active_connections as (
    select
      c.event_id_text,
      c.profile_id_text,
      c.role_text,
      c.profile_type_text
    from connections c
    where c.status_text = 'active'
      and c.archived_at_text is null
  ),
  broken as (
    select
      case
        when ac.event_id_text ~* '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
          then ac.event_id_text::uuid
        else null
      end as event_id,
      ac.role_text as role,
      ac.profile_id_text as broken_profile_id,
      'event_profile_connections'::text as source,
      case
        when ac.event_id_text is null or ac.event_id_text !~* '^[0-9a-fA-F-]{36}$' then 'invalid event_id format'
        when not exists (select 1 from public.events e where e.id::text = ac.event_id_text) then 'missing event record'
        when ac.profile_id_text is null or ac.profile_id_text !~* '^[0-9a-fA-F-]{36}$' then 'invalid profile_id format'
        when ac.profile_type_text is null or ac.profile_type_text = '' then 'missing profile_type/role'
        when not public.admin_profile_exists(ac.profile_type_text, ac.profile_id_text::uuid) then 'missing profile record'
        else 'ok'
      end as detail
    from active_connections ac
  )
  select
    b.event_id,
    b.role,
    b.broken_profile_id,
    b.source,
    b.detail
  from broken b
  where b.detail <> 'ok'
  order by b.event_id nulls first
  limit greatest(coalesce(p_limit, 200), 1);
$$;

create function public.admin_get_suspected_duplicate_profiles(
  p_city_id uuid default null,
  p_city_slug text default null,
  p_city text default null,
  p_limit integer default 200
)
returns table (
  profile_type text,
  normalized_name text,
  city_key text,
  candidate_count bigint,
  profile_ids uuid[]
)
language sql
security definer
set search_path = public
as $$
  with profile_universe as (
    select
      'teacher'::text as profile_type,
      t.id as profile_id,
      to_jsonb(t) as row_json,
      public.admin_normalize_name(trim(coalesce(to_jsonb(t) ->> 'first_name', '') || ' ' || coalesce(to_jsonb(t) ->> 'surname', ''))) as normalized_name
    from public.teacher_profiles t

    union all
    select
      'dj'::text,
      d.id,
      to_jsonb(d),
      public.admin_normalize_name(coalesce(nullif(to_jsonb(d) ->> 'dj_name', ''), trim(coalesce(to_jsonb(d) ->> 'first_name', '') || ' ' || coalesce(to_jsonb(d) ->> 'surname', ''))))
    from public.dj_profiles d

    union all
    select
      'organiser'::text,
      o.id,
      to_jsonb(o),
      public.admin_normalize_name(coalesce(nullif(to_jsonb(o) ->> 'organisation_name', ''), trim(coalesce(to_jsonb(o) ->> 'first_name', '') || ' ' || coalesce(to_jsonb(o) ->> 'surname', ''))))
    from public.organisers o

    union all
    select
      'vendor'::text,
      v.id,
      to_jsonb(v),
      public.admin_normalize_name(to_jsonb(v) ->> 'business_name')
    from public.vendors v

    union all
    select
      'videographer'::text,
      vg.id,
      to_jsonb(vg),
      public.admin_normalize_name(to_jsonb(vg) ->> 'business_name')
    from public.videographers vg

    union all
    select
      'dancer'::text,
      da.id,
      to_jsonb(da),
      public.admin_normalize_name(trim(coalesce(to_jsonb(da) ->> 'first_name', '') || ' ' || coalesce(to_jsonb(da) ->> 'surname', '')))
    from public.dancers da

    union all
    select
      'venue'::text,
      ve.id,
      to_jsonb(ve),
      public.admin_normalize_name(to_jsonb(ve) ->> 'name')
    from public.venues ve
  ),
  filtered as (
    select
      pu.profile_type,
      pu.profile_id,
      pu.normalized_name,
      coalesce(
        nullif(pu.row_json ->> 'city_id', ''),
        nullif(pu.row_json ->> 'city_slug', ''),
        nullif(pu.row_json ->> 'city', ''),
        '__no_city__'
      ) as city_key
    from profile_universe pu
    where pu.normalized_name <> ''
      and public.admin_row_city_matches(pu.row_json, p_city_id, p_city_slug, p_city)
  )
  select
    f.profile_type,
    f.normalized_name,
    f.city_key,
    count(*) as candidate_count,
    array_agg(f.profile_id order by f.profile_id) as profile_ids
  from filtered f
  group by f.profile_type, f.normalized_name, f.city_key
  having count(*) > 1
  order by candidate_count desc, f.profile_type, f.normalized_name
  limit greatest(coalesce(p_limit, 200), 1);
$$;

-- =========================================================
-- 4) RLS and minimal grants
--    (only tables created/managed here)
-- =========================================================
alter table public.admin_link_managers enable row level security;
alter table public.event_profile_link_audit enable row level security;

drop policy if exists admin_link_managers_self_read on public.admin_link_managers;
create policy admin_link_managers_self_read
on public.admin_link_managers
for select
to authenticated
using (user_id = auth.uid() or public.can_manage_connectivity());

drop policy if exists admin_link_managers_manage on public.admin_link_managers;
create policy admin_link_managers_manage
on public.admin_link_managers
for all
to authenticated
using (public.can_manage_connectivity())
with check (public.can_manage_connectivity());

drop policy if exists event_profile_link_audit_manager_read on public.event_profile_link_audit;
create policy event_profile_link_audit_manager_read
on public.event_profile_link_audit
for select
to authenticated
using (public.can_manage_connectivity());

drop policy if exists event_profile_link_audit_manager_insert on public.event_profile_link_audit;
create policy event_profile_link_audit_manager_insert
on public.event_profile_link_audit
for insert
to authenticated
with check (public.can_manage_connectivity());

grant execute on function public.can_manage_connectivity() to authenticated, service_role;
grant execute on function public.admin_normalize_name(text) to authenticated, service_role;
grant execute on function public.admin_row_city_matches(jsonb, uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_profile_exists(text, uuid) to authenticated, service_role;

grant execute on function public.admin_get_connectivity_health_metrics(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_get_unlinked_events_queue(uuid, text, text, integer) to authenticated, service_role;
grant execute on function public.admin_get_unlinked_profiles_queue(uuid, text, text, integer) to authenticated, service_role;
grant execute on function public.admin_get_broken_reference_queue(integer) to authenticated, service_role;
grant execute on function public.admin_get_suspected_duplicate_profiles(uuid, text, text, integer) to authenticated, service_role;

grant select on public.admin_link_managers to authenticated, service_role;
grant select, insert on public.event_profile_link_audit to authenticated, service_role;
