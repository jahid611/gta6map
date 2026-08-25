"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

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
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" aria-label="GTA VI Map — accueil" className="-my-2 flex items-center gap-3 py-2">
          <Image
            src="/brand/gta-vi-logo.svg"
            alt=""
            width={980}
            height={744}
            unoptimized
            className="h-7 w-auto"
          />
          <span className="vi-kicker hidden text-muted sm:block">Interactive Map</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/galerie"
            className="hidden min-h-11 items-center px-3 text-sm font-medium text-muted transition-colors hover:text-foreground sm:flex"
          >
            Galerie
          </Link>
          <Link
            href="/community"
            className="hidden min-h-11 items-center px-3 text-sm font-medium text-muted transition-colors hover:text-foreground sm:flex"
          >
            Communauté
          </Link>
          <NavAccountLink />
          <Link
            href="/map"
            className="rs-pill flex min-h-11 items-center px-5 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Ouvrir la carte
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Lien compte de la nav landing : « Connexion » ou pseudo → /compte. Rien si la base n'est pas configurée. */
function NavAccountLink() {
  const auth = useAuth();
  if (!auth.enabled) return null;
  if (!auth.user) {
    return (
      <Link
        href="/auth?next=%2Fmap"
        className="hidden min-h-11 items-center px-3 text-sm font-medium text-muted transition-colors hover:text-foreground sm:flex"
      >
        Connexion
      </Link>
    );
  }
  const initials = (auth.displayName ?? "?").slice(0, 2).toUpperCase();
  return (
    <Link href="/compte" className="flex min-h-11 items-center gap-2 px-2 text-sm font-medium text-muted transition-colors hover:text-foreground" aria-label="Mon compte">
      <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-full bg-[image:var(--gradient-vi)] text-[11px] font-black text-white">
        {auth.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={auth.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          initials
        )}
      </span>
      <span className="hidden sm:inline">{auth.displayName}</span>
    </Link>
  );
}
