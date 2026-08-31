"use client";

import { useEffect, useMemo, useRef } from "react";
import type { StreetWorld } from "@/types/street";

interface StreetMinimapProps {
  world: StreetWorld;
  x: number;
  z: number;
  heading: number;
  /** 0 = vraie vie, 1 = GTA VI. */
  blend: number;
  size: number;
}

/** Rayon couvert par la minimap, en mètres. */
const RANGE = 190;

/**
 * Minimap tournante, façon GTA : le nord tourne, le joueur reste en haut.
 *
 * Le plan des rues est dessiné une seule fois, en entier, dans un canvas hors
 * écran ; chaque image ne fait que le recadrer et le pivoter. Redessiner
 * 4 900 segments soixante fois par seconde coûterait plus cher que toute la
 * scène 3D.
 */
export function StreetMinimap({ world, x, z, heading, blend, size }: StreetMinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** Plan complet du quartier, à 1 px = 1 m, dans les deux ambiances. */
  const plans = useMemo(() => {
    if (typeof document === "undefined") return null;

    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    for (const road of world.roads) {
      for (let i = 0; i < road.p.length; i += 2) {
        minX = Math.min(minX, road.p[i]);
        maxX = Math.max(maxX, road.p[i]);
        minZ = Math.min(minZ, road.p[i + 1]);
        maxZ = Math.max(maxZ, road.p[i + 1]);
      }
    }
    if (!Number.isFinite(minX)) return null;

    const pad = 60;
    const width = Math.ceil(maxX - minX + pad * 2);
    const height = Math.ceil(maxZ - minZ + pad * 2);
    const originX = minX - pad;
    const originZ = minZ - pad;

    const draw = (ground: string, road: string, water: string, block: string) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const g = canvas.getContext("2d");
      if (!g) return canvas;

      g.fillStyle = ground;
      g.fillRect(0, 0, width, height);

      g.fillStyle = water;
      for (const ring of world.water) {
        g.beginPath();
        g.moveTo(ring[0] - originX, ring[1] - originZ);
        for (let i = 2; i < ring.length; i += 2) g.lineTo(ring[i] - originX, ring[i + 1] - originZ);
        g.closePath();
        g.fill();
      }
      // La mer, du même côté du trait de côte qu'en 3D — un trait très épais
      // décalé d'une demi-largeur suffit à l'échelle de la minimap.
      g.strokeStyle = water;
      g.lineWidth = 600;
      g.lineCap = "butt";
      for (const line of world.coast) {
        g.beginPath();
        for (let i = 0; i < line.length - 2; i += 2) {
          const dx = line[i + 2] - line[i];
          const dz = line[i + 3] - line[i + 1];
          const length = Math.hypot(dx, dz);
          if (length < 0.5) continue;
          // Décalage vers la mer : (−dz, dx), comme dans `buildGround`.
          const ox = (-dz / length) * 300;
          const oz = (dx / length) * 300;
          g.moveTo(line[i] - originX + ox, line[i + 1] - originZ + oz);
          g.lineTo(line[i + 2] - originX + ox, line[i + 3] - originZ + oz);
        }
        g.stroke();
      }

      g.strokeStyle = road;
      g.lineCap = "round";
      for (const r of world.roads) {
        g.lineWidth = Math.max(r.w * 0.75, 2);
        g.beginPath();
        g.moveTo(r.p[0] - originX, r.p[1] - originZ);
        for (let i = 2; i < r.p.length; i += 2) g.lineTo(r.p[i] - originX, r.p[i + 1] - originZ);
        g.stroke();
      }

      g.fillStyle = block;
      for (const b of world.buildings) {
        if (b.p.length < 6) continue;
        g.beginPath();
        g.moveTo(b.p[0] - originX, b.p[1] - originZ);
        for (let i = 2; i < b.p.length; i += 2) g.lineTo(b.p[i] - originX, b.p[i + 1] - originZ);
        g.closePath();
        g.fill();
      }

      // Les lieux répertoriés, à leur couleur de catégorie.
      for (const spot of world.spots) {
        g.fillStyle = spot.color ?? "#f976b0";
        g.beginPath();
        g.arc(spot.x - originX, spot.z - originZ, 3.2, 0, Math.PI * 2);
        g.fill();
      }

      return canvas;
    };

    return {
      real: draw("#1a1d22", "#5c6169", "#16394d", "#2b2f36"),
      vi: draw("#17121f", "#5d4569", "#231b52", "#2a2038"),
      originX,
      originZ,
    };
  }, [world]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext("2d");
    if (!canvas || !g || !plans) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    if (canvas.width !== size * dpr) {
      canvas.width = canvas.height = size * dpr;
    }
    const half = size / 2;
    const scale = half / RANGE;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size, size);

    g.save();
    g.beginPath();
    g.arc(half, half, half - 1, 0, Math.PI * 2);
    g.clip();

    // Le joueur est au centre, et la carte tourne avec lui.
    g.translate(half, half);
    g.rotate((heading * Math.PI) / 180);
    g.scale(scale, scale);
    g.translate(-(x - plans.originX), -(z - plans.originZ));

    g.globalAlpha = 1;
    g.drawImage(plans.real, 0, 0);
    if (blend > 0.001) {
      g.globalAlpha = blend;
      g.drawImage(plans.vi, 0, 0);
      g.globalAlpha = 1;
    }
    g.restore();

    // Cône de vision, puis le joueur.
    g.save();
    g.translate(half, half);
    g.fillStyle = "rgba(255,255,255,0.14)";
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, half * 0.7, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
    g.closePath();
    g.fill();

    g.fillStyle = "#ffffff";
    g.strokeStyle = "#111117";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 6);
    g.lineTo(0, 3);
    g.lineTo(-5, 6);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }, [plans, x, z, heading, blend, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="rounded-full border border-border-strong bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      aria-hidden
    />
  );
}
