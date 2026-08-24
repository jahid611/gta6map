/**
 * Types de la base Supabase (miroir de `supabase/migrations/0001_init.sql`).
 * Régénérable avec : `supabase gen types typescript --local > src/lib/supabase/database.types.ts`
 */
export type CategoryGroupDb = "media" | "landmark" | "gameplay";
export type ConfirmationStatusDb = "confirmed" | "unconfirmed" | "unknown";
export type LocationSourceDb = "gtadb" | "gta6map" | "gtamaplib" | "gtamaplib-vc" | "manual";

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  group: CategoryGroupDb;
  icon: string;
  color: string;
  sort_order: number;
  trackable: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationRow {
  id: string;
  legacy_id: string;
  slug: string;
  kind: "landmark" | "camera";
  flags: string[];
  media: Record<string, unknown> | null;
  wiki: Record<string, unknown> | null;
  area_wiki: Record<string, unknown> | null;
  name: string;
  name_status: ConfirmationStatusDb;
  area: string | null;
  category_id: string;
  x: number;
  y: number;
  z: number | null;
  height: number | null;
  lat: number;
  lng: number;
  description: string | null;
  tags: string[];
  color: string;
  photo_ig: string | null;
  photo_irl: string | null;
  irl_name: string | null;
  irl_address: string | null;
  irl_lat: number | null;
  irl_lng: number | null;
  irl_status: ConfirmationStatusDb;
  source: LocationSourceDb;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Ligne de la vue `locations_view` (lieu + slug de catégorie). */
export type LocationViewRow = Omit<LocationRow, "category_id" | "metadata" | "created_at"> & {
  category_slug: string;
};

export interface UserProgressRow {
  user_id: string;
  location_id: string;
  found: boolean;
  found_at: string | null;
  note: string | null;
  updated_at: string;
}

export interface UserCustomMarkerRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  x: number;
  y: number;
  color: string;
  icon: string;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

type Insertable<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

export interface Database {
  public: {
    Tables: {
      categories: {
        Row: CategoryRow;
        Insert: Insertable<CategoryRow, "id" | "created_at" | "updated_at" | "description" | "icon" | "color" | "sort_order" | "trackable" | "group">;
        Update: Partial<CategoryRow>;
        Relationships: [];
      };
      locations: {
        Row: LocationRow;
        Insert: Insertable<
          LocationRow,
          | "id" | "created_at" | "updated_at" | "lat" | "lng" | "metadata" | "description" | "tags"
          | "color" | "photo_ig" | "photo_irl" | "irl_name" | "irl_address" | "irl_lat" | "irl_lng"
          | "irl_status" | "source" | "z" | "height" | "area" | "name_status"
        >;
        Update: Partial<LocationRow>;
        Relationships: [];
      };
      user_progress: {
        Row: UserProgressRow;
        Insert: Insertable<UserProgressRow, "found" | "found_at" | "note" | "updated_at">;
        Update: Partial<UserProgressRow>;
        Relationships: [];
      };
      user_custom_markers: {
        Row: UserCustomMarkerRow;
        Insert: Insertable<UserCustomMarkerRow, "id" | "created_at" | "updated_at" | "description" | "color" | "icon" | "category_id">;
        Update: Partial<UserCustomMarkerRow>;
        Relationships: [];
      };
    };
    Views: {
      locations_view: { Row: LocationViewRow; Relationships: [] };
      categories_with_counts: { Row: CategoryRow & { total: number }; Relationships: [] };
    };
    Functions: {
      progress_summary: {
        Args: Record<string, never>;
        Returns: { category_slug: string; total: number; found: number }[];
      };
      search_locations: {
        Args: { query: string; max_results?: number };
        Returns: LocationViewRow[];
      };
    };
    Enums: {
      category_group: CategoryGroupDb;
      confirmation_status: ConfirmationStatusDb;
      location_source: LocationSourceDb;
    };
    CompositeTypes: Record<string, never>;
  };
}
