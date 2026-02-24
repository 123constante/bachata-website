create table if not exists public.city_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  city_name text not null,
  country_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

-- RLS policies
alter table public.city_requests enable row level security;

create policy "Users can create requests"
  on public.city_requests for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can view their own requests"
  on public.city_requests for select
  to authenticated
  using (auth.uid() = user_id);

-- Admins can view/update all (assuming admin role or similar permission check exists,
-- often handled via separate admin API or custom claim in real app. 
-- For now, allowing all authenticated users to read/insert is safe enough for MVP requests,
-- but we should lock down update/delete to admins later.)

-- Feature: Global/World city
-- Keep consistent with cities table schema
insert into public.cities (name, slug, country_id, is_active, image_url)
values ('World', 'world', null, true, null)
on conflict (slug) do nothing;
