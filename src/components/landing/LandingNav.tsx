"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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
            href="/street"
            className="hidden min-h-11 items-center px-3 text-sm font-medium text-muted transition-colors hover:text-foreground sm:flex"
          >
            Mode piéton
          </Link>
          <Link
            href="/galerie"
            className="hidden min-h-11 items-center px-3 text-sm font-medium text-muted transition-colors hover:text-foreground sm:flex"
          >
            Galerie
          </Link>
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
