import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@/components/ui/icons";

/**
 * Bloc de bascule vers la carte, sur une image in-game en fond.
 *
 * Même règle d'empilement que le hero : `isolate` + z positifs uniquement.
 * `globals.css` pose un fond sur `html` ET sur `body`, donc celui de `body` ne
 * se propage pas au canvas et recouvrirait tout descendant en z négatif.
 */
export function ClosingCta({ total }: { total: number }) {
  return (
    <section className="relative mx-auto max-w-6xl px-5 pb-24 pt-8">
      <div className="vi-reveal relative isolate overflow-hidden rounded-[2rem]">
        <Image
          src="/brand/vice-sunset.webp"
          alt=""
          aria-hidden
          width={1920}
          height={1080}
          sizes="(max-width: 1200px) 100vw, 1152px"
          className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        />

        {/* Voiles volontairement légers : l'intérêt de ce bloc est le coucher de
            soleil, l'assombrir le réduisait à un aplat brun. La lisibilité du
            texte est assurée par ses propres ombres portées plutôt qu'en tuant
            l'image. Le dégradé se densifie vers le bas, là où le ciel est le
            plus clair et où tombent le sous-titre et le bouton. */}
        <div
          aria-hidden
          className="absolute inset-0 z-[1] bg-gradient-to-b from-black/15 via-black/25 to-black/55"
        />
        <div
          aria-hidden
          className="absolute inset-0 z-[2] bg-[radial-gradient(ellipse_62%_58%_at_50%_52%,rgba(9,6,16,0.42)_0%,rgba(9,6,16,0.16)_60%,transparent_100%)]"
        />

        <div className="relative z-10 px-8 py-28 text-center sm:px-16 sm:py-36">
          <h2 className="vi-display text-[clamp(2rem,6vw,4rem)] text-white [text-shadow:0_2px_28px_rgba(0,0,0,0.75)]">
            Leonida vous attend
          </h2>
          <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-white/90 [text-shadow:0_1px_14px_rgba(0,0,0,0.8)] sm:text-base">
            {total.toLocaleString("fr-FR")} points, zéro inscription requise. Ouvrez la carte et commencez.
          </p>
          <Link
            href="/map"
            className="group mt-9 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-semibold text-[#0f0617] shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          >
            Ouvrir la carte
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
