create table if not exists public.recipe_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create unique index if not exists recipe_collections_user_name_idx
  on public.recipe_collections (user_id, lower(btrim(name)));

create index if not exists recipe_collections_user_idx
  on public.recipe_collections (user_id, created_at);

alter table public.recipe_collections enable row level security;

drop policy if exists "Users manage their own recipe collections" on public.recipe_collections;
create policy "Users manage their own recipe collections" on public.recipe_collections
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.recipe_collections to authenticated;

alter table public.saved_recipes
  add column if not exists collection_id uuid references public.recipe_collections (id) on delete set null;

create index if not exists saved_recipes_collection_idx
  on public.saved_recipes (user_id, collection_id);

create or replace function public.validate_saved_recipe_collection_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.collection_id is not null and not exists (
    select 1 from public.recipe_collections c
    where c.id = new.collection_id and c.user_id = new.user_id
  ) then
    raise exception 'Recipe folders must belong to the saved recipe owner.';
  end if;
  return new;
end;
$$;

drop trigger if exists saved_recipe_collection_owner on public.saved_recipes;
create trigger saved_recipe_collection_owner
  before insert or update of collection_id, user_id on public.saved_recipes
  for each row execute function public.validate_saved_recipe_collection_owner();

revoke all on function public.validate_saved_recipe_collection_owner() from public, anon, authenticated;
