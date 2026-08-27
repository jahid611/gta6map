"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { SafeImage } from "@/components/ui/safe-image";
import { NavPill } from "./NavPill";

/**
 * Barre de navigation de la landing : transparente au-dessus du hero, elle prend
 * un fond opaque dès que la page défile (sinon le wordmark du hero passe dessous
 * et devient illisible).
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`pt-safe fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-border bg-background/85 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="GTA6MAP — accueil" className="-my-2 flex items-center gap-3 py-2">
          <Image
            src="/brand/gta-vi-logo.svg"
            alt=""
            width={980}
            height={744}
            unoptimized
            // Toujours au-dessus de la ligne de flottaison : Next le détectait
            // comme LCP et réclamait un chargement immédiat.
            priority
            className="h-7 w-auto"
          />
          {/* Repoussé à `lg` : le galet est centré sur la barre, ce libellé le
              faisait mordre sur le logo entre 640 et 900 px. */}
          <span className="vi-kicker hidden text-muted lg:block">GTA6MAP</span>
        </Link>

        {/* Centrage porté par ce conteneur et non par le galet : `.rs-nav3d` pose
            `position: relative` (son glacis en ::before en dépend), ce qui écrase
            l'`absolute` de Tailwind — le galet repartait alors dans le flux, calé
            à droite par le `justify-between`. Il change de largeur en s'ouvrant et
            doit grandir des deux côtés à la fois. */}
        <div className="pointer-events-none absolute inset-0 hidden items-center justify-center md:flex">
          <NavPill className="pointer-events-auto" trailing={<NavAccountLink inPill />} />
        </div>

        <div className="flex items-center gap-2">
          {/* Sous `md`, le galet est masqué : le compte et la carte gardent
              chacun leur propre accès dans la barre. */}
          <span className="md:hidden">
            <NavAccountLink />
          </span>
          <Link
            href="/map"
            className="rs-pill flex min-h-11 items-center px-5 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
          >
            La carte
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * Lien compte : « Connexion » ou avatar + pseudo → /compte. Rien si la base
 * n'est pas configurée.
 *
 * `inPill` : dans le galet, il s'aligne sur la hauteur des rubriques (36 px) et
 * le pseudo est toujours écrit. Hors du galet — sous `md` —, il reprend une
 * cible tactile de 44 px, un lien n'étant pas couvert par la règle qui l'impose
 * aux boutons.
 */
function NavAccountLink({ inPill = false }: { inPill?: boolean }) {
  const auth = useAuth();
  if (!auth.enabled) return null;
  if (!auth.user) {
    return (
      <Link
        href="/auth?next=%2Fmap"
        className={cn(
          "items-center px-3 text-sm font-medium text-muted transition-colors hover:text-foreground",
          inPill ? "flex h-9 whitespace-nowrap" : "hidden min-h-11 sm:flex",
        )}
      >
        Connexion
      </Link>
    );
  }
  const initials = (auth.displayName ?? "?").slice(0, 2).toUpperCase();
  return (
    <Link
      href="/compte"
      className={cn(
        "flex items-center gap-2 px-2 text-sm font-medium text-muted transition-colors hover:text-foreground",
        inPill ? "h-9" : "min-h-11",
      )}
      aria-label="Mon compte"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[image:var(--gradient-vi)] text-[11px] font-black text-white">
        {auth.avatarUrl ? (
          <SafeImage src={auth.avatarUrl} className="h-full w-full object-cover" referrerPolicy="no-referrer" fallback={<>{initials}</>} />
        ) : (
          initials
        )}
      </span>
      <span className={cn("whitespace-nowrap", !inPill && "hidden sm:inline")}>{auth.displayName}</span>
    </Link>
  );
}
