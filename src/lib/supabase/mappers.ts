import type { Category, Location, LocationMedia, LocationWiki } from "@/types";
import { worldToLatLng } from "@/lib/map/coords";
import type { CategoryRow, LocationViewRow } from "./database.types";

/** Ligne `locations_view` → modèle applicatif `Location`. */
export function mapLocationRow(row: LocationViewRow): Location {
  return {
    id: row.id,
    legacyId: row.legacy_id,
    slug: row.slug,
    kind: row.kind ?? "landmark",
    name: row.name,
    nameStatus: row.name_status,
    area: row.area,
    categorySlug: row.category_slug,
    x: row.x,
    y: row.y,
    z: row.z,
    height: row.height,
    latLng: worldToLatLng(row.x, row.y),
    description: row.description,
    tags: row.tags ?? [],
    flags: row.flags ?? [],
    color: row.color,
    photos: { ig: row.photo_ig, irl: row.photo_irl },
    media: (row.media as unknown as LocationMedia | null) ?? null,
    wiki: (row.wiki as unknown as LocationWiki | null) ?? null,
    areaWiki: (row.area_wiki as unknown as LocationWiki | null) ?? null,
    realWorld: {
      name: row.irl_name,
      address: row.irl_address,
      lat: row.irl_lat,
      lng: row.irl_lng,
      status: row.irl_status,
    },
    source: row.source,
    updatedAt: row.updated_at,
  };
}

export function mapCategoryRow(row: CategoryRow): Category {
  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    group: row.group,
    icon: row.icon,
    color: row.color,
    sortOrder: row.sort_order,
    trackable: row.trackable,
  };
}
