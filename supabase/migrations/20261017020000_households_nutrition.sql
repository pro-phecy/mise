alter table public.pantry_items add column if not exists product_details jsonb;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(encode(extensions.gen_random_bytes(8), 'hex')),
  owner_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

create table if not exists public.household_pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  normalized_name text not null check (char_length(normalized_name) between 1 and 80),
  category text not null default 'Other' check (category in ('Produce', 'Protein', 'Dairy', 'Pantry', 'Other')),
  quantity text,
  expires_at date,
  is_selected boolean not null default true,
  product_details jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, normalized_name)
);

create table if not exists public.household_shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  normalized_name text not null check (char_length(normalized_name) between 1 and 80),
  quantity text,
  is_checked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (household_id, normalized_name)
);

create or replace function public.is_household_member(target_household uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = target_household and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.my_household()
returns table (household_id uuid, household_name text, invite_code text, member_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, h.name, h.invite_code,
    (select count(*)::integer from public.household_members members where members.household_id = h.id)
  from public.households h
  join public.household_members mine on mine.household_id = h.id
  where mine.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.create_household(p_name text)
returns table (household_id uuid, household_name text, invite_code text, member_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household uuid;
  clean_name text := left(trim(coalesce(p_name, '')), 60);
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if char_length(clean_name) < 1 then raise exception 'Give your household a name.'; end if;
  if exists (select 1 from public.household_members m where m.user_id = (select auth.uid())) then
    raise exception 'Leave your current household before creating another.';
  end if;
  insert into public.households (name, owner_id) values (clean_name, (select auth.uid())) returning id into new_household;
  insert into public.household_members (household_id, user_id, role) values (new_household, (select auth.uid()), 'owner');
  return query select h.id, h.name, h.invite_code, 1 from public.households h where h.id = new_household;
end;
$$;

create or replace function public.join_household(p_invite_code text)
returns table (household_id uuid, household_name text, invite_code text, member_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if exists (select 1 from public.household_members m where m.user_id = (select auth.uid())) then
    raise exception 'Leave your current household before joining another.';
  end if;
  select h.id into target_id from public.households h
    where h.invite_code = upper(trim(coalesce(p_invite_code, '')));
  if target_id is null then raise exception 'That invite code was not found.'; end if;
  insert into public.household_members (household_id, user_id, role) values (target_id, (select auth.uid()), 'member');
  return query select h.id, h.name, h.invite_code,
    (select count(*)::integer from public.household_members m where m.household_id = h.id)
    from public.households h where h.id = target_id;
end;
$$;

create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_household uuid;
  current_role text;
begin
  select m.household_id, m.role into current_household, current_role
    from public.household_members m where m.user_id = (select auth.uid());
  if current_household is null then return; end if;
  if current_role = 'owner' and exists (
    select 1 from public.household_members m where m.household_id = current_household and m.user_id <> (select auth.uid())
  ) then raise exception 'The owner cannot leave while others remain. Ask members to leave first.'; end if;
  delete from public.household_members m where m.household_id = current_household and m.user_id = (select auth.uid());
  if current_role = 'owner' then delete from public.households h where h.id = current_household; end if;
end;
$$;

create or replace function public.transfer_household_owner_on_user_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_household record;
  next_owner uuid;
begin
  for affected_household in select h.id from public.households h where h.owner_id = old.id loop
    select m.user_id into next_owner from public.household_members m
      where m.household_id = affected_household.id and m.user_id <> old.id
      order by m.joined_at asc limit 1;
    if next_owner is not null then
      update public.households h set owner_id = next_owner where h.id = affected_household.id;
      update public.household_members m set role = case when m.user_id = next_owner then 'owner' else 'member' end
        where m.household_id = affected_household.id;
    end if;
    next_owner := null;
  end loop;
  return old;
end;
$$;

drop trigger if exists transfer_household_owner_before_user_delete on auth.users;
create trigger transfer_household_owner_before_user_delete
  before delete on auth.users
  for each row execute procedure public.transfer_household_owner_on_user_delete();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_pantry_items enable row level security;
alter table public.household_shopping_list_items enable row level security;

drop policy if exists "Members can read their household" on public.households;
create policy "Members can read their household" on public.households for select to authenticated using (public.is_household_member(id));
drop policy if exists "Owners can update their household" on public.households;
create policy "Owners can update their household" on public.households for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "Members can read household membership" on public.household_members;
create policy "Members can read household membership" on public.household_members for select to authenticated using (
  user_id = (select auth.uid()) or public.is_household_member(household_id)
);

drop policy if exists "Members manage household pantry" on public.household_pantry_items;
create policy "Members manage household pantry" on public.household_pantry_items for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
drop policy if exists "Members manage household shopping list" on public.household_shopping_list_items;
create policy "Members manage household shopping list" on public.household_shopping_list_items for all to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));

revoke all on function public.is_household_member(uuid) from public;
revoke all on function public.my_household() from public;
revoke all on function public.create_household(text) from public;
revoke all on function public.join_household(text) from public;
revoke all on function public.leave_household() from public;
revoke all on function public.transfer_household_owner_on_user_delete() from public;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.my_household() to authenticated;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text) to authenticated;
grant execute on function public.leave_household() to authenticated;
grant select, insert, update, delete on public.households, public.household_members to authenticated;
grant select, insert, update, delete on public.household_pantry_items, public.household_shopping_list_items to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'household_pantry_items') then
      execute 'alter publication supabase_realtime add table public.household_pantry_items';
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'household_shopping_list_items') then
      execute 'alter publication supabase_realtime add table public.household_shopping_list_items';
    end if;
  end if;
end;
$$;
