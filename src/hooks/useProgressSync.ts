"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useProgressStore } from "@/store/useProgressStore";
import type { CustomMarker, ProgressEntry } from "@/types/progress";
import type { UserCustomMarkerRow, UserProgressRow } from "@/lib/supabase/database.types";

const PUSH_DEBOUNCE_MS = 1200;

/**
 * Synchronisation bidirectionnelle progression ↔ Supabase pour un utilisateur connecté.
 *
 *  - Au login : pull des lignes distantes → `mergeRemote` (dernier écrit gagne),
 *    puis push des entrées locales encore « dirty ».
 *  - Ensuite : chaque modification locale est poussée (debounce) en upsert.
 *  - Marqueurs personnalisés : même mécanisme + suppression des ids `deletedMarkers`.
 *
 * Sans utilisateur (ou sans Supabase), le hook est inerte : localStorage seul.
 */
export function useProgressSync(userId: string | null): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulled = useRef<string | null>(null);

  // ── Pull initial ──
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId || pulled.current === userId) return;
    pulled.current = userId;
    let cancelled = false;

    (async () => {
      const [{ data: progress }, { data: markers }] = await Promise.all([
        supabase.from("user_progress").select("*").eq("user_id", userId),
        supabase.from("user_custom_markers").select("*").eq("user_id", userId),
      ]);
      if (cancelled) return;
      if (progress) {
        const remote: ProgressEntry[] = (progress as UserProgressRow[]).map((r) => ({
          locationId: r.location_id,
          found: r.found,
          updatedAt: r.updated_at,
          note: r.note,
        }));
        useProgressStore.getState().mergeRemote(remote);
      }
      if (markers) {
        const remote: CustomMarker[] = (markers as UserCustomMarkerRow[]).map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          x: r.x,
          y: r.y,
          color: r.color,
          icon: r.icon,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        useProgressStore.getState().mergeRemoteMarkers(remote);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Push (debounce) à chaque changement de `dirty` ──
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) return;

    const push = async () => {
      const state = useProgressStore.getState();
      const dirtyIds = [...state.dirty];
      const dirtyMarkerIds = [...state.dirtyMarkers];
      const deletedIds = [...state.deletedMarkers];

      if (dirtyIds.length) {
        const rows = dirtyIds
          .map((id) => state.entries[id])
          .filter((e): e is ProgressEntry => !!e)
          .map((e) => ({
            user_id: userId,
            location_id: e.locationId,
            found: e.found,
            found_at: e.found ? e.updatedAt : null,
            note: e.note,
            updated_at: e.updatedAt,
          }));
        const { error } = await supabase.from("user_progress").upsert(rows, { onConflict: "user_id,location_id" });
        if (!error) state.markSynced(dirtyIds);
      }

      if (dirtyMarkerIds.length || deletedIds.length) {
        const rows = dirtyMarkerIds
          .map((id) => state.customMarkers[id])
          .filter((m): m is CustomMarker => !!m)
          .map((m) => ({
            id: m.id,
            user_id: userId,
            name: m.name,
            description: m.description,
            x: m.x,
            y: m.y,
            color: m.color,
            icon: m.icon,
            updated_at: m.updatedAt,
          }));
        const [{ error: upErr }, { error: delErr }] = await Promise.all([
          rows.length ? supabase.from("user_custom_markers").upsert(rows) : Promise.resolve({ error: null }),
          deletedIds.length
            ? supabase.from("user_custom_markers").delete().in("id", deletedIds)
            : Promise.resolve({ error: null }),
        ]);
        state.markMarkersSynced(upErr ? [] : dirtyMarkerIds, delErr ? [] : deletedIds);
      }
    };

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(push, PUSH_DEBOUNCE_MS);
    };

    const unsubscribe = useProgressStore.subscribe((s, prev) => {
      if (s.dirty !== prev.dirty || s.dirtyMarkers !== prev.dirtyMarkers || s.deletedMarkers !== prev.deletedMarkers) {
        schedule();
      }
    });
    schedule();

    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [userId]);
}
