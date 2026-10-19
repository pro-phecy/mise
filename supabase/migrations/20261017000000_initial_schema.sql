create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  dietary_preferences text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  normalized_name text not null check (char_length(normalized_name) between 1 and 80),
  category text not null default 'Other' check (category in ('Produce', 'Protein', 'Dairy', 'Pantry', 'Other')),
  quantity text,
  expires_at date,
  is_selected boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create index if not exists pantry_items_user_idx on public.pantry_items (user_id, created_at);

create table if not exists public.saved_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null,
  recipe jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, recipe_id)
);

create index if not exists saved_recipes_user_idx on public.saved_recipes (user_id, created_at desc);

create table if not exists public.meal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id text not null,
  recipe jsonb not null,
  cooked_at timestamptz not null default now()
);

create index if not exists meal_history_user_idx on public.meal_history (user_id, cooked_at desc);

alter table public.profiles enable row level security;
alter table public.pantry_items enable row level security;
alter table public.saved_recipes enable row level security;
alter table public.meal_history enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users manage their own pantry" on public.pantry_items;
create policy "Users manage their own pantry" on public.pantry_items
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own saved recipes" on public.saved_recipes;
create policy "Users manage their own saved recipes" on public.saved_recipes
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own meal history" on public.meal_history;
create policy "Users manage their own meal history" on public.meal_history
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.pantry_items to authenticated;
grant select, insert, update, delete on public.saved_recipes to authenticated;
grant select, insert, update, delete on public.meal_history to authenticated;
