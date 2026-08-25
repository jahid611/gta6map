"use client";

import { useState } from "react";
import { Pin } from "@/components/ui/icons";
import { useUIStore } from "@/store/useUIStore";
import { useProgressStore } from "@/store/useProgressStore";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const COLORS = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#22d3ee"];

/** Création d'un marqueur personnalisé (déclenchée par clic droit / appui long sur la carte). */
export function CustomMarkerDialog() {
  const pending = useUIStore((s) => s.pendingCustomMarker);
  const setPending = useUIStore((s) => s.setPendingCustomMarker);
  if (!pending) return null;

  return (
    <Sheet open onOpenChange={(open) => !open && setPending(null)}>
      <SheetContent side="bottom" title="Nouveau marqueur" className="mx-auto max-w-md lg:rounded-2xl lg:bottom-6">
        {/* `key` ⇒ formulaire réinitialisé à chaque nouveau point */}
        <CustomMarkerForm key={`${pending.x},${pending.y}`} x={pending.x} y={pending.y} onClose={() => setPending(null)} />
      </SheetContent>
    </Sheet>
  );
}

function CustomMarkerForm({ x, y, onClose }: { x: number; y: number; onClose: () => void }) {
  const addCustomMarker = useProgressStore((s) => s.addCustomMarker);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  return (
    <form
      className="flex flex-col gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        addCustomMarker({ name: name.trim(), description: description.trim() || null, x, y, color, icon: "Pin" });
        onClose();
      }}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Pin className="h-4 w-4" style={{ color }} /> Nouveau marqueur
      </h2>
      <p className="font-mono text-xs text-muted">
        {x}, {y} m
      </p>
      <Input autoFocus placeholder="Nom" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      <Input
        placeholder="Description (optionnel)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
      />
      <div className="flex gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className="h-7 w-7 rounded-full border-2 cursor-pointer"
            style={{ background: c, borderColor: color === c ? "#fff" : "transparent" }}
            aria-label={`Couleur ${c}`}
            aria-pressed={color === c}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit">Ajouter</Button>
      </div>
    </form>
  );
}
