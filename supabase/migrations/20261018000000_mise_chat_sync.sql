create table if not exists public.mise_chat_messages (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null check (char_length(id) between 1 and 120),
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  created_at timestamptz not null,
  primary key (user_id, id)
);

create index if not exists mise_chat_messages_user_created_idx
  on public.mise_chat_messages (user_id, created_at desc);

alter table public.mise_chat_messages enable row level security;

drop policy if exists "Users manage their own Mise chat" on public.mise_chat_messages;
create policy "Users manage their own Mise chat" on public.mise_chat_messages
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.mise_chat_messages to authenticated;
