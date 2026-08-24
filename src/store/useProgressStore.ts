import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CustomMarker, ProgressEntry } from "@/types/progress";

/**
 * Progression utilisateur.
 *  - Persistée en localStorage (`gta6map:progress`) → fonctionne hors connexion.
 *  - `dirty` liste les ids modifiés localement non encore poussés vers Supabase ;
 *    `useProgressSync` les envoie quand l'utilisateur est connecté.
 *  - Fusion distante : « dernier écrit gagne » sur `updatedAt`.
 */
interface ProgressState {
  entries: Record<string, ProgressEntry>;
  dirty: string[];
  customMarkers: Record<string, CustomMarker>;
  dirtyMarkers: string[];
  deletedMarkers: string[];

  isFound: (locationId: string) => boolean;
  setFound: (locationId: string, found: boolean) => void;
  toggleFound: (locationId: string) => void;
  setNote: (locationId: string, note: string | null) => void;
  resetAll: () => void;

  /** Fusionne des entrées distantes (Supabase) dans l'état local. */
  mergeRemote: (remote: ProgressEntry[]) => void;
  markSynced: (locationIds: string[]) => void;

  addCustomMarker: (marker: Omit<CustomMarker, "id" | "createdAt" | "updatedAt">) => CustomMarker;
  updateCustomMarker: (id: string, patch: Partial<Pick<CustomMarker, "name" | "description" | "color" | "icon" | "x" | "y">>) => void;
  removeCustomMarker: (id: string) => void;
  mergeRemoteMarkers: (remote: CustomMarker[]) => void;
  markMarkersSynced: (ids: string[], deletedIds: string[]) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
      entries: {},
      dirty: [],
      customMarkers: {},
      dirtyMarkers: [],
      deletedMarkers: [],

      isFound: (id) => get().entries[id]?.found ?? false,

      setFound: (id, found) =>
        set((s) => ({
          entries: {
            ...s.entries,
            [id]: { locationId: id, found, updatedAt: nowIso(), note: s.entries[id]?.note ?? null },
          },
          dirty: s.dirty.includes(id) ? s.dirty : [...s.dirty, id],
        })),

      toggleFound: (id) => get().setFound(id, !get().isFound(id)),

      setNote: (id, note) =>
        set((s) => ({
          entries: {
            ...s.entries,
            [id]: { locationId: id, found: s.entries[id]?.found ?? false, updatedAt: nowIso(), note },
          },
          dirty: s.dirty.includes(id) ? s.dirty : [...s.dirty, id],
        })),

      resetAll: () =>
        set((s) => {
          const entries: Record<string, ProgressEntry> = {};
          const dirty: string[] = [];
          for (const e of Object.values(s.entries)) {
            entries[e.locationId] = { ...e, found: false, updatedAt: nowIso() };
            dirty.push(e.locationId);
          }
          return { entries, dirty };
        }),

      mergeRemote: (remote) =>
        set((s) => {
          const entries = { ...s.entries };
          const dirty = new Set(s.dirty);
          for (const r of remote) {
            const local = entries[r.locationId];
            if (!local || local.updatedAt < r.updatedAt) {
              entries[r.locationId] = r;
              dirty.delete(r.locationId);
            } else if (local.updatedAt > r.updatedAt) {
              dirty.add(r.locationId);
            } else {
              dirty.delete(r.locationId);
            }
          }
          return { entries, dirty: [...dirty] };
        }),

      markSynced: (ids) => set((s) => ({ dirty: s.dirty.filter((id) => !ids.includes(id)) })),

      addCustomMarker: (input) => {
        const marker: CustomMarker = { ...input, id: newId(), createdAt: nowIso(), updatedAt: nowIso() };
        set((s) => ({
          customMarkers: { ...s.customMarkers, [marker.id]: marker },
          dirtyMarkers: [...s.dirtyMarkers, marker.id],
        }));
        return marker;
      },

      updateCustomMarker: (id, patch) =>
        set((s) => {
          const current = s.customMarkers[id];
          if (!current) return s;
          return {
            customMarkers: { ...s.customMarkers, [id]: { ...current, ...patch, updatedAt: nowIso() } },
            dirtyMarkers: s.dirtyMarkers.includes(id) ? s.dirtyMarkers : [...s.dirtyMarkers, id],
          };
        }),

      removeCustomMarker: (id) =>
        set((s) => {
          const customMarkers = { ...s.customMarkers };
          delete customMarkers[id];
          return {
            customMarkers,
            dirtyMarkers: s.dirtyMarkers.filter((m) => m !== id),
            deletedMarkers: [...s.deletedMarkers, id],
          };
        }),

      mergeRemoteMarkers: (remote) =>
        set((s) => {
          const customMarkers = { ...s.customMarkers };
          for (const r of remote) {
            if (s.deletedMarkers.includes(r.id)) continue;
            const local = customMarkers[r.id];
            if (!local || local.updatedAt < r.updatedAt) customMarkers[r.id] = r;
          }
          return { customMarkers };
        }),

      markMarkersSynced: (ids, deletedIds) =>
        set((s) => ({
          dirtyMarkers: s.dirtyMarkers.filter((id) => !ids.includes(id)),
          deletedMarkers: s.deletedMarkers.filter((id) => !deletedIds.includes(id)),
        })),
    }),
    { name: "gta6map:progress", version: 1 },
  ),
);

/** Sélecteur : nombre d'ids trouvés parmi une liste (mémoïsable côté composant). */
export function countFound(entries: Record<string, ProgressEntry>, ids: readonly string[]): number {
  let n = 0;
  for (const id of ids) if (entries[id]?.found) n += 1;
  return n;
}
