-- ============================================================================
-- GTA VI Interactive Map — schéma initial
-- Compatible Supabase (PostgreSQL 15+). À appliquer via `supabase db push`
-- ou dans le SQL Editor du dashboard.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ───────────────────────────── Types ─────────────────────────────

do $$ begin
  create type public.category_group as enum ('landmark', 'gameplay');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.confirmation_status as enum ('confirmed', 'unconfirmed', 'unknown');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.location_source as enum ('gta6map', 'gtamaplib-vc', 'manual');
exception when duplicate_object then null; end $$;

-- ───────────────────────────── Helpers ─────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────────────── categories ─────────────────────────────

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name        text not null,
  description text,
  "group"     public.category_group not null default 'landmark',
  icon        text not null default 'MapPin',          -- nom d'icône Lucide
  color       text not null default '#94a3b8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order  integer not null default 0,
  trackable   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists categories_group_sort_idx on public.categories ("group", sort_order);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- ───────────────────────────── locations ─────────────────────────────

create table if not exists public.locations (
  id           uuid primary key default gen_random_uuid(),
  legacy_id    text not null unique,                    -- b12, x389, L264…
  slug         text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name         text not null,
  name_status  public.confirmation_status not null default 'confirmed',
  area         text,
  category_id  uuid not null references public.categories(id) on delete restrict,

  -- Coordonnées monde (mètres RAGE, origine au centre, Y vers le nord)
  x            double precision not null check (x between -16384 and 16384),
  y            double precision not null check (y between -16384 and 16384),
  z            double precision,                         -- altitude si connue
  height       double precision,                         -- hauteur bâtiment si connue

  -- Coordonnées Leaflet dérivées : CRS custom ⇒ lat = y, lng = x (colonnes générées)
  lat          double precision generated always as (y) stored,
  lng          double precision generated always as (x) stored,

  description  text,
  tags         text[] not null default '{}',
  color        text not null default '#94a3b8' check (color ~ '^#[0-9a-fA-F]{6}$'),
  photo_ig     text,                                     -- chemin relatif à PHOTOS_BASE_URL
  photo_irl    text,

  -- Correspondance monde réel
  irl_name     text,
  irl_address  text,
  irl_lat      double precision check (irl_lat between -90 and 90),
  irl_lng      double precision check (irl_lng between -180 and 180),
  irl_status   public.confirmation_status not null default 'unknown',

  source       public.location_source not null default 'manual',
  metadata     jsonb not null default '{}'::jsonb,

  -- Recherche plein texte (nom + zone + nom IRL + tags)
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(area, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(irl_name, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(tags, ' ')), 'C')
  ) stored,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists locations_category_idx on public.locations (category_id);
create index if not exists locations_area_idx on public.locations (area);
create index if not exists locations_xy_idx on public.locations (x, y);
create index if not exists locations_search_idx on public.locations using gin (search_vector);
create index if not exists locations_name_trgm_idx on public.locations using gin (name gin_trgm_ops);

drop trigger if exists locations_set_updated_at on public.locations;
create trigger locations_set_updated_at before update on public.locations
  for each row execute function public.set_updated_at();

-- ───────────────────────────── user_progress ─────────────────────────────

create table if not exists public.user_progress (
  user_id     uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  found       boolean not null default true,
  found_at    timestamptz,
  note        text check (char_length(note) <= 2000),
  updated_at  timestamptz not null default now(),
  primary key (user_id, location_id)
);

create index if not exists user_progress_user_idx on public.user_progress (user_id, updated_at desc);

drop trigger if exists user_progress_set_updated_at on public.user_progress;
create trigger user_progress_set_updated_at before update on public.user_progress
  for each row execute function public.set_updated_at();

-- ───────────────────────────── user_custom_markers ─────────────────────────────

create table if not exists public.user_custom_markers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 2000),
  x           double precision not null check (x between -16384 and 16384),
  y           double precision not null check (y between -16384 and 16384),
  color       text not null default '#f43f5e' check (color ~ '^#[0-9a-fA-F]{6}$'),
  icon        text not null default 'Pin',
  category_id uuid references public.categories(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists user_custom_markers_user_idx on public.user_custom_markers (user_id);

drop trigger if exists user_custom_markers_set_updated_at on public.user_custom_markers;
create trigger user_custom_markers_set_updated_at before update on public.user_custom_markers
  for each row execute function public.set_updated_at();

-- ───────────────────────────── Vues & fonctions ─────────────────────────────

-- Lieux « aplatis » avec le slug de catégorie (forme consommée par l'app).
create or replace view public.locations_view as
select
  l.id, l.legacy_id, l.slug, l.name, l.name_status, l.area,
  c.slug as category_slug,
  l.x, l.y, l.z, l.height, l.lat, l.lng,
  l.description, l.tags, l.color, l.photo_ig, l.photo_irl,
  l.irl_name, l.irl_address, l.irl_lat, l.irl_lng, l.irl_status,
  l.source, l.updated_at
from public.locations l
join public.categories c on c.id = l.category_id;

-- Compteurs par catégorie.
create or replace view public.categories_with_counts as
select c.*, count(l.id)::integer as total
from public.categories c
left join public.locations l on l.category_id = c.id
group by c.id;

-- Résumé de progression de l'utilisateur courant (global + par catégorie).
create or replace function public.progress_summary()
returns table (category_slug text, total integer, found integer)
language sql security invoker stable as $$
  select
    c.slug,
    count(l.id)::integer as total,
    count(p.location_id) filter (where p.found)::integer as found
  from public.categories c
  left join public.locations l on l.category_id = c.id
  left join public.user_progress p on p.location_id = l.id and p.user_id = auth.uid()
  where c.trackable
  group by c.slug, c.sort_order
  order by c.sort_order;
$$;

-- Recherche plein texte (utilisée par /api/locations?q=).
create or replace function public.search_locations(query text, max_results integer default 10)
returns setof public.locations_view
language sql security invoker stable as $$
  select v.*
  from public.locations_view v
  join public.locations l on l.id = v.id
  where l.search_vector @@ plainto_tsquery('simple', query)
     or l.name ilike '%' || query || '%'
  order by ts_rank(l.search_vector, plainto_tsquery('simple', query)) desc, similarity(l.name, query) desc
  limit max_results;
$$;

-- ───────────────────────────── RLS ─────────────────────────────

alter table public.categories enable row level security;
alter table public.locations enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_custom_markers enable row level security;

-- Lecture publique du référentiel ; écriture réservée au service role (seed).
drop policy if exists "categories are public" on public.categories;
create policy "categories are public" on public.categories for select using (true);

drop policy if exists "locations are public" on public.locations;
create policy "locations are public" on public.locations for select using (true);

-- Progression : chaque utilisateur ne voit/modifie que la sienne.
drop policy if exists "own progress select" on public.user_progress;
create policy "own progress select" on public.user_progress for select using (auth.uid() = user_id);
drop policy if exists "own progress insert" on public.user_progress;
create policy "own progress insert" on public.user_progress for insert with check (auth.uid() = user_id);
drop policy if exists "own progress update" on public.user_progress;
create policy "own progress update" on public.user_progress for update using (auth.uid() = user_id);
drop policy if exists "own progress delete" on public.user_progress;
create policy "own progress delete" on public.user_progress for delete using (auth.uid() = user_id);

-- Marqueurs personnalisés : idem.
drop policy if exists "own markers select" on public.user_custom_markers;
create policy "own markers select" on public.user_custom_markers for select using (auth.uid() = user_id);
drop policy if exists "own markers insert" on public.user_custom_markers;
create policy "own markers insert" on public.user_custom_markers for insert with check (auth.uid() = user_id);
drop policy if exists "own markers update" on public.user_custom_markers;
create policy "own markers update" on public.user_custom_markers for update using (auth.uid() = user_id);
drop policy if exists "own markers delete" on public.user_custom_markers;
create policy "own markers delete" on public.user_custom_markers for delete using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.locations, public.locations_view, public.categories_with_counts to anon, authenticated;
grant select, insert, update, delete on public.user_progress, public.user_custom_markers to authenticated;
grant execute on function public.progress_summary() to authenticated;
grant execute on function public.search_locations(text, integer) to anon, authenticated;
