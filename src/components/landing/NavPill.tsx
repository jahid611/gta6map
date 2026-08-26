"use client";

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

/** A-t-on défilé de plus de `threshold` pixels ? Abonnement plutôt qu'effet :
 *  poser l'état depuis un effet est refusé par `react-hooks/set-state-in-effect`,
 *  et l'abonnement donne en prime la bonne valeur dès le premier rendu client. */
function useScrolled(threshold: number): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("scroll", cb, { passive: true });
      return () => window.removeEventListener("scroll", cb);
    },
    () => window.scrollY > threshold,
    () => false,
  );
}

interface NavPillItem {
  href: string;
  label: string;
}

const ITEMS: NavPillItem[] = [
  { href: "/", label: "Accueil" },
  { href: "/galerie", label: "Galerie" },
  { href: "/community", label: "Communauté" },
  { href: "/map", label: "La carte" },
];

/**
 * Galet de navigation en relief, d'après `omrohilla6/3d-adaptive-navigation-bar`
 * (21st.dev). Le modelé est repris ; la matière, elle, est refaite en anthracite
 * dans `.rs-nav3d` — le galet blanc laqué de l'original jurerait sur un site
 * sombre.
 *
 * Deux écarts assumés avec l'original :
 *
 *  1. Il démarre **ouvert** et ne se referme qu'une fois la page défilée. Réduit
 *     d'emblée au nom de la rubrique courante, il cacherait toute la navigation
 *     à qui arrive sur le site : la trouvaille est jolie sur une page unique à
 *     ancres, elle est hostile sur un site à plusieurs pages.
 *  2. Il ne se referme jamais au doigt. Sans survol, rien ne le rouvrirait —
 *     c'est déjà ce qui nous avait valu des aperçus ouverts au premier appui sur
 *     la carte.
 *
 * La largeur est animée en pixels mesurés plutôt qu'en ressort : `width: auto`
 * ne se transitionne pas, et les deux états sont mesurés une fois pour toutes
 * (puis à chaque redimensionnement ou changement de rubrique).
 */
export function NavPill({ className }: { className?: string }) {
  const pathname = usePathname();
  const [hovering, setHovering] = useState(false);
  const scrolled = useScrolled(24);
  const coarse = useMediaQuery("(pointer: coarse)");
  const [widths, setWidths] = useState<{ open: number; shut: number } | null>(null);

  const listRef = useRef<HTMLUListElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  const active = ITEMS.find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href))) ?? ITEMS[0];

  // Ouvert tant qu'on n'a pas défilé, au survol, au clavier, et au doigt.
  const open = coarse || !scrolled || hovering;

  // Mesure hors flux : les deux contenus sont toujours rendus (l'un masqué),
  // c'est ce qui permet de connaître les deux largeurs sans double rendu.
  const measure = useCallback(() => {
    const list = listRef.current;
    const label = labelRef.current;
    if (!list || !label) return;
    const open = Math.ceil(list.scrollWidth);
    const shut = Math.ceil(label.scrollWidth);
    // Largeurs nulles = on mesure un élément encore masqué. On garde la largeur
    // automatique plutôt que de figer un galet de 24 px.
    if (!open || !shut) return;
    setWidths({ open: open + 24, shut: shut + 56 });
  }, []);

  // `ResizeObserver` plutôt qu'une mesure unique doublée d'un écouteur `resize` :
  // la barre masque le galet sous `md`, et l'observateur se déclenche aussi au
  // passage de `display: none` à visible — la mesure ponctuelle, elle, tombait
  // pendant que l'élément était encore masqué et figeait un galet minuscule.
  // Il couvre au passage l'arrivée des polices d'affichage, qui changent la
  // largeur du texte après le premier rendu.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    if (labelRef.current) observer.observe(labelRef.current);
    return () => observer.disconnect();
  }, [measure, active.label]);

  return (
    <nav
      aria-label="Navigation principale"
      className={cn("rs-nav3d flex h-12 items-center justify-center overflow-hidden", className)}
      style={widths ? { width: open ? widths.open : widths.shut } : undefined}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Nom de la rubrique courante, montré une fois le galet refermé. */}
      <span
        aria-hidden={open}
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center text-sm font-semibold tracking-wide text-foreground transition-opacity duration-200",
          open ? "opacity-0" : "opacity-100 delay-100",
        )}
      >
        <span ref={labelRef}>{active.label}</span>
      </span>

      <ul
        ref={listRef}
        // `w-max` : sans elle, la liste prend la largeur du galet, et mesurer
        // sa largeur pour fixer celle du galet devient circulaire — le galet
        // s'étirait jusqu'au bord de la barre.
        className={cn(
          "relative flex h-full w-max items-center gap-1 px-3 transition-opacity duration-200",
          open ? "opacity-100 delay-100" : "pointer-events-none opacity-0",
        )}
      >
        {ITEMS.map((item) => {
          const isActive = item === active;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                tabIndex={open ? undefined : -1}
                className={cn(
                  "flex h-9 items-center whitespace-nowrap rounded-full px-3.5 text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                  isActive
                    ? "font-semibold text-foreground [text-shadow:0_1px_0_rgba(0,0,0,0.6)]"
                    : "font-medium text-muted hover:text-foreground",
                )}
              >
                {item.label}
                {/* Le point d'accent porte l'état courant à lui seul : un fond
                    de pastille sur un galet déjà en relief ferait une carte
                    dans une carte. */}
                {isActive && (
                  <span aria-hidden className="ml-2 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
