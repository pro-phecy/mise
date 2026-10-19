alter table public.profiles
  add column if not exists allergies text[] not null default '{}',
  add column if not exists default_servings smallint not null default 2 check (default_servings between 1 and 8),
  add column if not exists max_cook_minutes smallint check (max_cook_minutes is null or max_cook_minutes between 10 and 180),
  add column if not exists budget_level text not null default 'balanced' check (budget_level in ('budget', 'balanced', 'treat')),
  add column if not exists equipment text[] not null default '{}';

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  planned_for date not null,
  recipe_id text not null,
  recipe jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, planned_for, recipe_id)
);

create index if not exists meal_plans_user_date_idx on public.meal_plans (user_id, planned_for);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  normalized_name text not null check (char_length(normalized_name) between 1 and 80),
  quantity text,
  is_checked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, normalized_name)
);

create index if not exists shopping_list_user_idx on public.shopping_list_items (user_id, created_at);

alter table public.meal_plans enable row level security;
alter table public.shopping_list_items enable row level security;

drop policy if exists "Users manage their own meal plans" on public.meal_plans;
create policy "Users manage their own meal plans" on public.meal_plans
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own shopping list" on public.shopping_list_items;
create policy "Users manage their own shopping list" on public.shopping_list_items
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.meal_plans to authenticated;
grant select, insert, update, delete on public.shopping_list_items to authenticated;
grant update on public.profiles to authenticated;
