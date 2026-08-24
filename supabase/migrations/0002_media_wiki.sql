-- ============================================================================
-- 0002 — caméras officielles (trailers / screenshots), fiches wiki, drapeaux,
--        sections de carte, nouveau groupe de catégories `media`.
-- ============================================================================

alter type public.category_group add value if not exists 'media';
alter type public.location_source add value if not exists 'gtadb';
alter type public.location_source add value if not exists 'gtamaplib';

do $$ begin
  create type public.location_kind as enum ('landmark', 'camera');
exception when duplicate_object then null; end $$;

alter table public.locations
  add column if not exists kind  public.location_kind not null default 'landmark',
  add column if not exists flags text[] not null default '{}',
  -- { frame, thumb, sourceLabel, source, frameIndex, yaw, pitch, hfov, width, height }
  add column if not exists media jsonb,
  -- { title, url, extract, image }
  add column if not exists wiki  jsonb,
  -- fiche wiki de la zone / du quartier
  add column if not exists area_wiki jsonb;

create index if not exists locations_kind_idx on public.locations (kind);
create index if not exists locations_flags_idx on public.locations using gin (flags);

-- Sections nommées de la carte (bbox monde) — issues de gtamaplib `map_sections`.
create table if not exists public.map_sections (
  slug       text primary key,
  name       text not null,
  x_min      double precision not null,
  y_min      double precision not null,
  x_max      double precision not null,
  y_max      double precision not null,
  wiki       jsonb,
  updated_at timestamptz not null default now()
);
alter table public.map_sections enable row level security;
drop policy if exists "sections are public" on public.map_sections;
create policy "sections are public" on public.map_sections for select using (true);
grant select on public.map_sections to anon, authenticated;

-- Vue aplatie mise à jour.
create or replace view public.locations_view as
select
  l.id, l.legacy_id, l.slug, l.kind, l.name, l.name_status, l.area,
  c.slug as category_slug,
  l.x, l.y, l.z, l.height, l.lat, l.lng,
  l.description, l.tags, l.flags, l.color, l.photo_ig, l.photo_irl, l.media, l.wiki, l.area_wiki,
  l.irl_name, l.irl_address, l.irl_lat, l.irl_lng, l.irl_status,
  l.source, l.updated_at
from public.locations l
join public.categories c on c.id = l.category_id;

grant select on public.locations_view to anon, authenticated;
