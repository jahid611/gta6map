"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { canHover } from "@/lib/utils";
import { SafeImage } from "@/components/ui/safe-image";

interface LinkPreviewProps {
  href: string;
  /** Visuel de l'aperçu. Sans lui, le composant se réduit au lien nu. */
  image: string | null;
  title: string;
  /** Deux lignes de contexte sous le titre. */
  description?: string | null;
  className?: string;
  /** Lien interne : navigation côté client, et pas de nom d hôte affiché. */
  internal?: boolean;
  children: React.ReactNode;
}

const CARD_W = 300;
const CARD_H = 232;

/**
 * Lien avec aperçu au survol, d'après `manuarora700/link-preview` (21st.dev).
 *
 * L'original passe par microlink.io, qui va photographier la page à la volée.
 * Nous n'en avons pas besoin : les vignettes et les résumés du wiki sont déjà
 * en base, servis depuis notre propre miroir. C'est le mode `isStatic` du
 * composant d'origine, et c'est le seul que nous employons — pas de service
 * tiers, pas d'URL de nos visiteurs envoyée à un inconnu, et l'aperçu s'affiche
 * sans attendre un aller-retour réseau.
 *
 * Trois dépendances écartées avec lui : `framer-motion` pour l'entrée en
 * ressort, `@radix-ui/react-hover-card` pour le survol, et `qss` qui ne servait
 * qu'à composer l'adresse microlink. Le motif du portail flottant existe déjà
 * dans le chat (`UserHandle`), il est repris ici.
 *
 * Réservé aux pointeurs fins : au doigt, un appui vaut un clic, et l'aperçu
 * s'ouvrirait par-dessus la page qu'on est en train de quitter.
 */
export function LinkPreview({ href, image, title, description, className, internal = false, children }: LinkPreviewProps) {
  const [pos, setPos] = useState<{ top: number; left: number; origin: "top" | "bottom" } | null>(null);
  /** Décalage horizontal suivant le curseur — l'aperçu accompagne la souris. */
  const [shift, setShift] = useState(0);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 10;
    const above = r.top - margin - CARD_H >= margin;
    setPos({
      top: above ? r.top - margin - CARD_H : Math.min(r.bottom + margin, window.innerHeight - CARD_H - margin),
      left: Math.min(Math.max(margin, r.left + r.width / 2 - CARD_W / 2), window.innerWidth - CARD_W - margin),
      origin: above ? "bottom" : "top",
    });
  };

  const show = () => {
    if (!canHover() || !image) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(place, 280);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPos(null), 120);
  };

  // Le décalage est divisé par quatre : à l'échelle 1, l'aperçu poursuivait la
  // souris au point d'en devenir agité.
  const follow = (e: React.MouseEvent) => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    setShift((e.clientX - (r.left + r.width / 2)) / 4);
  };

  // Un défilement ou un redimensionnement referme : la position ne serait plus juste.
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  return (
    <span ref={anchorRef} className="contents" onMouseEnter={show} onMouseLeave={hide} onMouseMove={follow}>
      {internal ? (
        <Link href={href} className={className} onFocus={show} onBlur={hide}>
          {children}
        </Link>
      ) : (
        <a href={href} target="_blank" rel="noopener noreferrer" className={className} onFocus={show} onBlur={hide}>
          {children}
        </a>
      )}

      {pos &&
        image &&
        createPortal(
          <div
            aria-hidden
            className="rs-menu pointer-events-none fixed z-[1400] overflow-hidden rounded-2xl animate-fade-in"
            style={{
              top: pos.top,
              left: pos.left,
              width: CARD_W,
              transform: `translateX(${shift}px)`,
              transformOrigin: pos.origin,
            }}
          >
            { }
            <SafeImage src={image} className="h-36 w-full object-cover" />
            <div className="p-3">
              <p className="truncate text-sm font-semibold text-foreground">{title}</p>
              {description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{description}</p>}
              {!internal && <p className="mt-1.5 truncate text-[10px] text-muted-2">{hostOf(href)}</p>}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}

function hostOf(href: string): string {
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return href;
  }
}
