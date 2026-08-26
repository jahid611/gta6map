import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Supprime les diacritiques et met en minuscules (recherche insensible aux accents). */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function formatPercent(value: number): string {
  return `${Math.round(value)} %`;
}

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * `true` seulement pour une souris ou un stylet.
 *
 * Au doigt, un simple tap déclenche aussi `mouseover` / `mouseenter` : sans ce
 * garde-fou, les aperçus prévus pour le survol s'ouvraient par-dessus la fiche
 * que le tap venait d'ouvrir.
 */
export function canHover(): boolean {
  return isBrowser() && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}
