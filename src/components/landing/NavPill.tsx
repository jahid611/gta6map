"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "@/components/ui/icons";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

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
 * Il s'ouvre au survol et se referme dès que la souris le quitte. Un écart avec
 * l'original : au doigt, il reste ouvert en permanence — sans survol, rien ne le
 * rouvrirait, et c'est déjà ce qui nous avait valu des aperçus ouverts au
 * premier appui sur la carte.
 *
 * La largeur est animée en pixels mesurés plutôt qu'en ressort : `width: auto`
 * ne se transitionne pas, et les deux états sont mesurés une fois pour toutes
 * (puis à chaque redimensionnement ou changement de rubrique).
 */
export function NavPill({ className, trailing }: { className?: string; trailing?: React.ReactNode }) {
  const pathname = usePathname();
  const [hovering, setHovering] = useState(false);
  const [focused, setFocused] = useState(false);
  const coarse = useMediaQuery("(pointer: coarse)");
  const [widths, setWidths] = useState<{ open: number; shut: number } | null>(null);

  const listRef = useRef<HTMLUListElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  // Peut être introuvable : les pages légales, la fiche dun lieu ou un profil
  // ne sont aucune des quatre rubriques. On affiche alors « Menu » plutôt que de
  // désigner « Accueil » comme page courante, ce qui serait faux.
  const active = ITEMS.find((i) => (i.href === "/" ? pathname === "/" : pathname.startsWith(i.href)));

  // Ouvert au survol et pendant la navigation au clavier — et il se referme dès
  // que la souris le quitte, où qu'on en soit dans la page.
  //
  // Au doigt, il reste ouvert en permanence : sans survol, rien ne le rouvrirait.
  const open = coarse || hovering || focused;

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
  }, [measure, active?.label]);

  return (
    <nav
      aria-label="Navigation principale"
      className={cn(
        "rs-nav3d flex h-12 items-center justify-center overflow-hidden",
        // Replié, il signale qu'il s'ouvre : sans indice, rien ne distingue un
        // galet cliquable d'une simple étiquette de rubrique.
        !open && "rs-nav-hint-pill",
        className,
      )}
      style={widths ? { width: open ? widths.open : widths.shut } : undefined}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      {/* Nom de la rubrique courante, montré une fois le galet refermé. */}
      <span
        aria-hidden={open}
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center text-sm font-semibold tracking-wide text-foreground transition-opacity duration-200",
          open ? "opacity-0" : "opacity-100 delay-100",
        )}
      >
        {/* Le chevron est dans l'élément mesuré : la largeur repliée doit le
            comprendre, sinon il se fait rogner par `overflow-hidden`. */}
        <span ref={labelRef} className="flex items-center gap-1.5">
          {active?.label ?? "Menu"}
          <ChevronRight aria-hidden className="rs-nav-hint h-3.5 w-3.5 text-muted" />
        </span>
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
                // Les liens restent atteignables au clavier même repliés : c'est
                // la prise de focus qui ouvre le galet. Les rendre inatteignables
                // le refermait sur lui-même — plus rien à focaliser, donc plus
                // aucun moyen de l'ouvrir sans souris.
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

        {/* Le compte ferme le galet, détaché des rubriques par un simple filet :
            ce n'est pas une page de plus, c'est qui l'on est. */}
        {trailing && (
          <li className="flex items-center gap-1 pl-1">
            <span aria-hidden className="h-5 w-px shrink-0 bg-white/12" />
            {trailing}
          </li>
        )}
      </ul>
    </nav>
  );
}
