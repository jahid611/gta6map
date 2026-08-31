"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameTransform, StreetMode, StreetWorld, StreetZoneSummary, WorldSpot } from "@/types/street";
import { REAL, VI } from "@/lib/street/ambiance";
import { applyGameTransform } from "@/lib/street/build";
import type { StreetEngine, StreetFrame } from "@/lib/street/engine";
import { photoUrl } from "@/lib/media";
import { ArrowLeft, Compass, MapPin, X } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StreetMinimap } from "./StreetMinimap";

interface StreetViewProps {
  world: StreetWorld;
  zones: StreetZoneSummary[];
  transform: GameTransform | null;
  /** Lieu où déposer le joueur à l'arrivée (`?l=slug`). */
  initialSlug: string | null;
}

/** Grain de pellicule — un bruit fixe, appliqué en surimpression. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")";

const M_PER_DEG_LAT = 111_320;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Vue piéton.
 *
 * Le moteur three.js vit hors de React : il tourne à soixante images par
 * seconde, et faire passer chaque image par un `setState` ferait rendre l'arbre
 * React soixante fois par seconde pour afficher deux nombres. Le composant ne
 * garde donc en état que ce que l'interface montre vraiment — le lieu proche, le
 * mode, la position arrondie — et le reste vit dans des références.
 */
export function StreetView({ world, zones, transform, initialSlug }: StreetViewProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StreetEngine | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<StreetMode>("real");
  const [openSpot, setOpenSpot] = useState<WorldSpot | null>(null);
  const [hud, setHud] = useState<{
    fps: number;
    x: number;
    z: number;
    heading: number;
    blend: number;
    near: WorldSpot | null;
    nearDistance: number;
  }>({ fps: 0, x: world.spawn.x, z: world.spawn.z, heading: world.spawn.heading, blend: 0, near: null, nearDistance: Infinity });

  // Le HUD est rafraîchi à ~12 Hz : au-delà, l'œil ne suit pas et React travaille
  // pour rien.
  const lastHud = useRef(0);

  const onFrame = useCallback((frame: StreetFrame) => {
    const now = performance.now();
    if (now - lastHud.current < 80) return;
    lastHud.current = now;
    setHud({
      fps: frame.fps,
      x: frame.x,
      z: frame.z,
      heading: frame.heading,
      blend: frame.blend,
      near: frame.near,
      nearDistance: frame.nearDistance,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: StreetEngine | null = null;
    let cancelled = false;

    // Le moteur pèse ~600 Ko avec three.js : il n'est chargé qu'ici, et jamais
    // sur les autres pages du site.
    void import("@/lib/street/engine")
      .then(({ StreetEngine }) => {
        if (cancelled) return;
        engine = new StreetEngine({
          world,
          canvas,
          photoSrc: (file) => `/api/photo?f=${encodeURIComponent(file)}`,
          onFrame,
          onLockChange: setLocked,
          onOpenSpot: (spot) => {
            document.exitPointerLock();
            setOpenSpot(spot);
          },
          onModeChange: setMode,
        });
        engineRef.current = engine;
        if (initialSlug) engine.goToSpot(initialSlug);
        setReady(true);
      })
      .catch((cause) => {
        console.error(cause);
        if (!cancelled) setError("Le rendu 3D n'a pas pu démarrer sur cet appareil.");
      });

    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, [world, onFrame, initialSlug]);

  const toggleMode = useCallback(() => engineRef.current?.toggleMode(), []);

  // ── Coordonnées ───────────────────────────────────────────────────────────

  const coords = useMemo(() => {
    const lat = world.origin[0] - hud.z / M_PER_DEG_LAT;
    const lng =
      world.origin[1] + hud.x / (M_PER_DEG_LAT * Math.cos((world.origin[0] * Math.PI) / 180));
    const game = transform ? applyGameTransform(transform, hud.x, hud.z) : null;
    return { lat, lng, game };
  }, [world.origin, transform, hud.x, hud.z]);

  const grade = useMemo(() => {
    const t = hud.blend;
    return {
      tint: t < 0.5 ? REAL.grade.tint : VI.grade.tint,
      tintOpacity: lerp(REAL.grade.tintOpacity, VI.grade.tintOpacity, t),
      grain: lerp(REAL.grade.grain, VI.grade.grain, t),
      vignette: lerp(REAL.grade.vignette, VI.grade.vignette, t),
    };
  }, [hud.blend]);

  const near = hud.near;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" />

      {/* Étalonnage : voile de couleur, grain et vignette, superposés au rendu. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-soft-light transition-colors duration-500"
        style={{ backgroundColor: grade.tint, opacity: grade.tintOpacity }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: GRAIN, opacity: grade.grain, mixBlendMode: "overlay" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,${grade.vignette}) 100%)`,
        }}
      />

      {/* Réticule */}
      {locked && (
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="h-1.5 w-1.5 rounded-full bg-white/80 shadow-[0_0_6px_rgba(0,0,0,0.8)]" />
        </div>
      )}

      {/* ── Bandeau haut ─────────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Button asChild variant="outline" size="icon-sm" aria-label="Retour à la carte">
            <Link href="/map">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="rounded-lg border border-border bg-surface/80 px-3 py-1.5 backdrop-blur">
            <p className="rs-title text-[13px] leading-none">{world.name}</p>
            <p className="mt-1 text-[11px] leading-none text-muted">
              {mode === "vi" ? VI.hint : REAL.hint}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {zones.length > 1 && (
            <select
              value={world.id}
              onChange={(event) => router.push(`/street?zone=${event.target.value}`)}
              className="h-8 rounded-lg border border-border bg-surface/80 px-2 text-xs backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-2"
              aria-label="Quartier"
            >
              {zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={toggleMode}
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-medium backdrop-blur transition-colors",
              mode === "vi"
                ? "border-accent/60 bg-accent/20 text-accent-pale"
                : "border-border bg-surface/80 text-foreground hover:bg-surface-2",
            )}
            aria-pressed={mode === "vi"}
          >
            <span
              aria-hidden
              className="h-2 w-2 rounded-full"
              style={{ background: mode === "vi" ? "var(--accent)" : "var(--accent-2)" }}
            />
            {mode === "vi" ? "GTA VI" : "Vraie vie"}
            <kbd className="rounded border border-border-strong px-1 text-[10px] text-muted">F</kbd>
          </button>
        </div>
      </div>

      {/* ── Minimap et coordonnées ───────────────────────────────────────── */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-end gap-3 sm:bottom-4 sm:left-4">
        <StreetMinimap
          world={world}
          x={hud.x}
          z={hud.z}
          heading={hud.heading}
          blend={hud.blend}
          size={132}
        />
        <div className="hidden rounded-lg border border-border bg-surface/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted backdrop-blur sm:block">
          <p>
            <span className="text-muted-2">réel</span> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </p>
          {coords.game && (
            <p>
              <span className="text-muted-2">jeu</span>{" "}
              <span className="text-accent-2">
                {Math.round(coords.game[0])}, {Math.round(coords.game[1])}
              </span>
            </p>
          )}
          <p className="flex items-center gap-1 text-muted-2">
            <Compass className="h-3 w-3" />
            {Math.round(hud.heading)}° · {hud.fps} i/s
          </p>
        </div>
      </div>

      {/* ── Lieu à portée ────────────────────────────────────────────────── */}
      {near && !openSpot && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center px-4 sm:bottom-8">
          <div className="pointer-events-auto flex max-w-[92vw] items-center gap-3 rounded-xl border border-border-strong bg-surface/90 px-4 py-2.5 backdrop-blur">
            <span
              aria-hidden
              className="h-8 w-1 rounded-full"
              style={{ background: near.color ?? "var(--accent)" }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{near.name}</p>
              <p className="truncate text-[11px] text-muted">
                {near.area ?? world.name} · {Math.round(hud.nearDistance)} m
                {near.address ? ` · ${near.address}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                document.exitPointerLock();
                setOpenSpot(near);
              }}
              className="ml-1 shrink-0 rounded-lg border border-border-strong px-2.5 py-1.5 text-[11px] font-medium hover:bg-surface-2"
            >
              Ouvrir <kbd className="ml-1 text-muted">E</kbd>
            </button>
          </div>
        </div>
      )}

      {/* ── Écran d'entrée ───────────────────────────────────────────────── */}
      {!locked && !openSpot && (
        <button
          type="button"
          onClick={() => canvasRef.current?.requestPointerLock()}
          className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-6 bg-black/55 px-6 text-center backdrop-blur-[2px]"
        >
          {error ? (
            <p className="max-w-sm text-sm text-red">{error}</p>
          ) : !ready ? (
            <p className="text-sm text-muted">Construction du quartier…</p>
          ) : (
            <>
              <div>
                <p className="rs-title text-2xl sm:text-4xl">Marcher dans {world.name}</p>
                <p className="mx-auto mt-3 max-w-md text-sm text-muted">
                  {world.spots.length} lieux répertoriés autour de vous. Approchez-en un pour voir sa
                  photo, et basculez entre le Miami d&apos;aujourd&apos;hui et Vice City.
                </p>
              </div>
              <p className="rounded-xl border border-accent/50 bg-accent/10 px-5 py-3 text-sm font-medium">
                Cliquez pour prendre les commandes
              </p>
              <ul className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-muted sm:grid-cols-4">
                <li>
                  <Key>Z Q S D</Key> marcher
                </li>
                <li>
                  <Key>Maj</Key> courir
                </li>
                <li>
                  <Key>F</Key> changer de monde
                </li>
                <li>
                  <Key>E</Key> ouvrir la fiche
                </li>
                <li className="col-span-2 sm:col-span-4">
                  <Key>Échap</Key> reprendre la souris · sur mobile, le pouce gauche marche et le
                  droit regarde
                </li>
              </ul>
            </>
          )}
        </button>
      )}

      {openSpot && <SpotCard spot={openSpot} onClose={() => setOpenSpot(null)} />}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mr-1.5 rounded border border-border-strong bg-surface px-1.5 py-0.5 font-sans text-[10px] text-foreground">
      {children}
    </kbd>
  );
}

/**
 * Fiche d'un lieu, ouverte depuis la rue : la capture in-game et la photo
 * réelle côte à côte. C'est la comparaison que le mode piéton met en scène,
 * montrée ici à plat.
 */
function SpotCard({ spot, onClose }: { spot: WorldSpot; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const game = photoUrl(spot.ig);
  const real = photoUrl(spot.irl);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-2xl border border-border-strong bg-surface">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-lg">{spot.name}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
              <MapPin className="h-3 w-3 shrink-0" />
              {spot.address ?? spot.area ?? "Leonida"}
            </p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Figure src={game} label="Dans GTA VI" tone="accent" />
          <Figure src={real} label="Dans la réalité" tone="accent-2" />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border p-4">
          <Button asChild size="sm">
            <Link href={`/location/${spot.slug}`}>Fiche complète</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/map?l=${spot.slug}`}>Voir sur la carte</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Retour dans la rue
          </Button>
        </div>
      </div>
    </div>
  );
}

function Figure({ src, label, tone }: { src: string | null; label: string; tone: "accent" | "accent-2" }) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-surface-2">
      <div className="aspect-[4/3] w-full bg-surface-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- source distante non redimensionnée, affichée telle quelle
          <img src={src} alt={label} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-2">
            Aucune image
          </div>
        )}
      </div>
      <figcaption
        className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide"
        style={{ color: `var(--${tone})` }}
      >
        {label}
      </figcaption>
    </figure>
  );
}
