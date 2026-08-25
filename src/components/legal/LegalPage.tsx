import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL ?? "https://github.com/jahid611/gta6map/issues";
export const CONTACT_LABEL = process.env.NEXT_PUBLIC_CONTACT_URL ? "notre formulaire de contact" : "GitHub (issues du projet)";

/** Mise en page commune des pages légales (confidentialité, conditions). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/" className="mb-10 inline-flex items-center gap-3" aria-label="Accueil">
        <Image src="/brand/gta-vi-logo.svg" alt="" width={980} height={744} unoptimized className="h-8 w-auto" />
        <span className="vi-kicker text-muted">Interactive Map</span>
      </Link>
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted">Dernière mise à jour : {updated}</p>
      <article className="legal mt-8 flex flex-col gap-6 text-[15px] leading-relaxed text-foreground/90">{children}</article>
      <nav className="mt-12 flex flex-wrap gap-4 border-t border-border pt-6 text-sm text-muted">
        <Link href="/privacy" className="hover:text-foreground">Règles de confidentialité</Link>
        <Link href="/terms" className="hover:text-foreground">Conditions d&apos;utilisation</Link>
        <Link href="/map" className="hover:text-foreground">La carte</Link>
      </nav>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}
