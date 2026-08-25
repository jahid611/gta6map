import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AuthForm } from "@/components/auth/AuthForm";
import { MEDIA_CATALOG, clipFor } from "@/lib/media-catalog";

export const metadata: Metadata = {
  title: "Connexion / Créer un compte",
  description: "Créez un compte gratuit pour synchroniser votre progression GTA VI Map entre vos appareils.",
  robots: { index: false },
};

function safeNext(value: string | string[] | undefined): string {
  const v = typeof value === "string" ? value : "/map";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/map";
}

/** Visuels officiels du panneau : clip Lucia (ou Jason) + son affiche, artwork de secours. */
function pickVisuals(mode: "signin" | "signup") {
  const name = mode === "signup" ? "Lucia Caminos" : "Jason Duval";
  const clip = MEDIA_CATALOG.find((e) => e.kind === "clip" && e.group === name) ?? MEDIA_CATALOG.find((e) => e.kind === "clip" && e.group !== "GTAVI Official Cover Art Landscape");
  const still = MEDIA_CATALOG.find((e) => e.kind === "screenshot" && e.section === "People" && e.group === name);
  return { video: clip?.src ?? clipFor(name), poster: clip?.poster ?? still?.src ?? null, character: name };
}

export default async function AuthPage({ searchParams }: PageProps<"/auth">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const mode = params.mode === "signup" ? "signup" : "signin";
  const authError = params.auth === "error";
  const visuals = pickVisuals(mode);

  return (
    <main className="relative min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Formulaire */}
      <section className="relative flex flex-col px-6 py-8 sm:px-10 lg:px-16 lg:py-12">
        <Link href="/" className="mb-10 inline-flex w-fit items-center gap-3" aria-label="Accueil">
          <Image src="/brand/gta-vi-logo.svg" alt="" width={980} height={744} unoptimized className="h-9 w-auto" />
          <span className="vi-kicker text-muted">Interactive Map</span>
        </Link>
        <div className="my-auto w-full max-w-md">
          {authError && (
            <p role="alert" className="mb-4 rounded-xl border border-red/40 bg-red/10 px-3 py-2 text-sm">
              Le lien de connexion est invalide ou a expiré. Réessayez.
            </p>
          )}
          <AuthForm initialMode={mode} next={next} />
        </div>
      </section>

      {/* Panneau média : clip officiel en boucle (affiche sur mobile) */}
      <aside className="relative min-h-[38vh] overflow-hidden lg:min-h-0" aria-hidden>
        {visuals.video ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            src={visuals.video}
            poster={visuals.poster ?? undefined}
            autoPlay
            muted
            playsInline
            preload="metadata"
          />
        ) : visuals.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={visuals.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[image:var(--gradient-vi)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent lg:bg-gradient-to-r lg:from-background lg:via-background/10 lg:to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 lg:bottom-12 lg:left-12">
          <p className="vi-kicker text-accent-pale">Leonida, USA</p>
          <p className="font-display mt-2 max-w-md text-2xl font-extrabold leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-3xl">
            1 500 lieux, les plans des trailers, et votre progression qui vous suit partout.
          </p>
          <p className="mt-2 text-xs text-white/60">{visuals.character} — © Rockstar Games</p>
        </div>
      </aside>
    </main>
  );
}
