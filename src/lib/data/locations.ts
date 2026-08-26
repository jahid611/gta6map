import "server-only";

import { cache } from "react";
import type { AreaInfo, Category, Location, MapSection } from "@/types";
import { CATEGORY_DEFINITIONS } from "./categories";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { mapCategoryRow, mapLocationRow } from "@/lib/supabase/mappers";
import type { CategoryRow, LocationViewRow } from "@/lib/supabase/database.types";

import generatedLocations from "@/data/generated/locations.json";
import generatedCategories from "@/data/generated/categories.json";
import generatedSections from "@/data/generated/sections.json";
import generatedAreas from "@/data/generated/areas.json";

const STATIC_AREAS = generatedAreas as unknown as AreaInfo[];

/** Zones / quartiers (centre médian + fiche wiki) — statique uniquement (dérivé des lieux). */
export const getAreas = cache(async (): Promise<AreaInfo[]> => STATIC_AREAS);

/**
 * Chargement des données côté serveur.
 *  1. Supabase configuré → `locations_view` / `categories` / `map_sections`.
 *  2. Sinon (ou erreur) → JSON statiques générés par le seed (build sans DB possible).
 * `cache()` dédoublonne les appels dans un même rendu (page + metadata + sitemap).
 */
const STATIC_LOCATIONS = generatedLocations as unknown as Location[];
const STATIC_CATEGORIES = (generatedCategories as unknown as Category[]).length
  ? (generatedCategories as unknown as Category[])
  : CATEGORY_DEFINITIONS;
const STATIC_SECTIONS = generatedSections as unknown as MapSection[];

export const getCategories = cache(async (): Promise<Category[]> => {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [...STATIC_CATEGORIES];
  const { data, error } = await supabase.from("categories").select("*").order("sort_order");
  if (error || !data?.length) return [...STATIC_CATEGORIES];
  return (data as CategoryRow[]).map(mapCategoryRow);
});

/**
 * PostgREST plafonne chaque réponse à 1 000 lignes (`max-rows`). Sans pagination,
 * 540 lieux — dont TOUTES les caméras, dont le slug commence par `s`/`t` et qui
 * tombaient donc après la 1000e ligne — n'arrivaient jamais : carte amputée et
 * compteur « 0 plan géolocalisé » sur la page d'accueil.
 */
const PAGE_SIZE = 1000;

export const getLocations = cache(async (): Promise<Location[]> => {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return STATIC_LOCATIONS;
  const rows: LocationViewRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("locations_view")
      .select("*")
      .order("slug")
      .range(from, from + PAGE_SIZE - 1);
    if (error) return rows.length ? rows.map(mapLocationRow) : STATIC_LOCATIONS;
    const page = (data ?? []) as LocationViewRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows.length ? rows.map(mapLocationRow) : STATIC_LOCATIONS;
});

export const getSections = cache(async (): Promise<MapSection[]> => {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return STATIC_SECTIONS;
  const { data, error } = await supabase.from("map_sections").select("*");
  if (error || !data?.length) return STATIC_SECTIONS;
  return (data as { slug: string; name: string; x_min: number; y_min: number; x_max: number; y_max: number; wiki: MapSection["wiki"] }[]).map(
    (r) => ({ slug: r.slug, name: r.name, bounds: [r.x_min, r.y_min, r.x_max, r.y_max], wiki: r.wiki ?? null }),
  );
});

export const getLocationBySlug = cache(async (slug: string): Promise<Location | null> => {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const { data } = await supabase.from("locations_view").select("*").eq("slug", slug).maybeSingle();
    if (data) return mapLocationRow(data as LocationViewRow);
  }
  return STATIC_LOCATIONS.find((l) => l.slug === slug) ?? null;
});

export function getStaticLocationSlugs(): string[] {
  return STATIC_LOCATIONS.map((l) => l.slug);
}
