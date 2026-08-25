-- ============================================================================
-- 0005 — Hub communautaire : chat global, réactions, sondages, profils publics.
-- ============================================================================

-- ───────────── Profils : lecture publique (pseudo, avatar, bannière) ─────────────
drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);
grant select on public.profiles to anon, authenticated;

-- ───────────── Messages ─────────────
do $$ begin
  create type public.chat_kind as enum ('text', 'location', 'poll');
exception when duplicate_object then null; end $$;

create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          public.chat_kind not null default 'text',
  content       text not null default '' check (char_length(content) <= 1000),
  -- Lieu partagé (slug de `locations`) pour kind = 'location'
  location_slug text,
  -- Réponse à un autre message (citation)
  reply_to      uuid references public.chat_messages(id) on delete set null,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index if not exists chat_messages_created_idx on public.chat_messages (created_at desc);
create index if not exists chat_messages_user_idx on public.chat_messages (user_id);

-- Anti-spam : 1 message toutes les 2 secondes, 1000 caractères max (contrainte).
create or replace function public.chat_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.chat_messages
    where user_id = new.user_id and created_at > now() - interval '2 seconds'
  ) then
    raise exception 'Trop rapide : attendez 2 secondes entre deux messages.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists chat_messages_rate_limit on public.chat_messages;
create trigger chat_messages_rate_limit before insert on public.chat_messages
  for each row execute function public.chat_rate_limit();

-- ───────────── Réactions ─────────────
create table if not exists public.chat_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
create index if not exists chat_reactions_message_idx on public.chat_reactions (message_id);

-- ───────────── Sondages ─────────────
create table if not exists public.chat_polls (
  message_id uuid primary key references public.chat_messages(id) on delete cascade,
  question   text not null check (char_length(question) between 1 and 200),
  -- [{ "id": "a", "label": "…" }, …] — 2 à 6 options
  options    jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  ends_at    timestamptz not null,
  created_by uuid not null references auth.users(id) on delete cascade
);

create table if not exists public.chat_poll_votes (
  poll_id    uuid not null references public.chat_polls(message_id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  option_id  text not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
create index if not exists chat_poll_votes_poll_idx on public.chat_poll_votes (poll_id);

-- Un vote n'est accepté que tant que le sondage est ouvert.
create or replace function public.chat_poll_vote_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare ends timestamptz;
begin
  select ends_at into ends from public.chat_polls where message_id = new.poll_id;
  if ends is null then raise exception 'Sondage inconnu.'; end if;
  if ends < now() then raise exception 'Ce sondage est terminé.' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists chat_poll_votes_guard on public.chat_poll_votes;
create trigger chat_poll_votes_guard before insert or update on public.chat_poll_votes
  for each row execute function public.chat_poll_vote_guard();

-- ───────────── Profil public + statistiques (contourne la RLS de user_progress) ─────────────
create or replace function public.public_profile(uid uuid)
returns table (
  id uuid,
  display_name text,
  avatar_url text,
  banner_url text,
  member_since timestamptz,
  found_count integer,
  custom_markers integer,
  messages_count integer,
  by_group jsonb
)
language sql security definer stable set search_path = public as $$
  select
    p.id,
    p.display_name,
    p.avatar_url,
    p.banner_url,
    p.created_at as member_since,
    (select count(*)::integer from public.user_progress up where up.user_id = p.id and up.found) as found_count,
    (select count(*)::integer from public.user_custom_markers m where m.user_id = p.id) as custom_markers,
    (select count(*)::integer from public.chat_messages cm where cm.user_id = p.id and cm.deleted_at is null) as messages_count,
    coalesce((
      select jsonb_object_agg(g.grp, g.n) from (
        select c."group"::text as grp, count(*)::integer as n
        from public.user_progress up
        join public.locations l on l.id = up.location_id
        join public.categories c on c.id = l.category_id
        where up.user_id = p.id and up.found
        group by c."group"
      ) g
    ), '{}'::jsonb) as by_group
  from public.profiles p
  where p.id = uid;
$$;
grant execute on function public.public_profile(uuid) to anon, authenticated;

-- ───────────── RLS ─────────────
alter table public.chat_messages enable row level security;
alter table public.chat_reactions enable row level security;
alter table public.chat_polls enable row level security;
alter table public.chat_poll_votes enable row level security;

drop policy if exists "chat read" on public.chat_messages;
create policy "chat read" on public.chat_messages for select using (true);
drop policy if exists "chat insert own" on public.chat_messages;
create policy "chat insert own" on public.chat_messages for insert with check (auth.uid() = user_id);
drop policy if exists "chat update own" on public.chat_messages;
create policy "chat update own" on public.chat_messages for update using (auth.uid() = user_id);

drop policy if exists "reactions read" on public.chat_reactions;
create policy "reactions read" on public.chat_reactions for select using (true);
drop policy if exists "reactions insert own" on public.chat_reactions;
create policy "reactions insert own" on public.chat_reactions for insert with check (auth.uid() = user_id);
drop policy if exists "reactions delete own" on public.chat_reactions;
create policy "reactions delete own" on public.chat_reactions for delete using (auth.uid() = user_id);

drop policy if exists "polls read" on public.chat_polls;
create policy "polls read" on public.chat_polls for select using (true);
drop policy if exists "polls insert own" on public.chat_polls;
create policy "polls insert own" on public.chat_polls for insert with check (auth.uid() = created_by);

drop policy if exists "votes read" on public.chat_poll_votes;
create policy "votes read" on public.chat_poll_votes for select using (true);
drop policy if exists "votes upsert own" on public.chat_poll_votes;
create policy "votes upsert own" on public.chat_poll_votes for insert with check (auth.uid() = user_id);
drop policy if exists "votes update own" on public.chat_poll_votes;
create policy "votes update own" on public.chat_poll_votes for update using (auth.uid() = user_id);

grant select on public.chat_messages, public.chat_reactions, public.chat_polls, public.chat_poll_votes to anon, authenticated;
grant insert, update on public.chat_messages to authenticated;
grant insert, delete on public.chat_reactions to authenticated;
grant insert on public.chat_polls to authenticated;
grant insert, update on public.chat_poll_votes to authenticated;

-- ───────────── Realtime ─────────────
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.chat_reactions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.chat_poll_votes;
exception when duplicate_object then null; end $$;
-- Les DELETE doivent remonter l'ancienne ligne (réactions retirées).
alter table public.chat_reactions replica identity full;
