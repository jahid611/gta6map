import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { MEDIA_CATALOG, clipFor } from "@/lib/media-catalog";
import { MediaMontage, type MontageItem } from "@/components/media/MediaMontage";

export const metadata: Metadata = {
  title: "Connexion / Créer un compte",
  description: "Créez un compte gratuit pour synchroniser votre progression GTA VI Map entre vos appareils.",
  robots: { index: false },
};

function safeNext(value: string | string[] | undefined): string {
  const v = typeof value === "string" ? value : "/map";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/map";
}

/**
 * Panneau média : tous les clips officiels à la suite (chacun joué une fois),
 * en commençant par Jason à la connexion, Lucia à l'inscription.
 */
function clipSequence(mode: "signin" | "signup"): MontageItem[] {
  const first = mode === "signup" ? "Lucia Caminos" : "Jason Duval";
  const clips = MEDIA_CATALOG.filter((e) => e.kind === "clip" && !/cover art/i.test(e.group));
  const ordered = [...clips.filter((c) => c.group === first), ...clips.filter((c) => c.group !== first)];
  return ordered.map((clip) => ({
    id: clip.id,
    kind: "video",
    src: clip.src,
    poster: clip.poster ?? clipFor(clip.group),
    title: "1 500 lieux, les plans des trailers, et votre progression qui vous suit partout.",
    subtitle: clip.group,
  }));
}

export default async function AuthPage({ searchParams }: PageProps<"/auth">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const mode = params.mode === "signup" ? "signup" : "signin";
  const authError = params.auth === "error";
  const sequence = clipSequence(mode);

  return (
    <main className="relative min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Formulaire */}
      <section className="relative flex flex-col px-6 pb-8 pt-24 sm:px-10 lg:px-16 lg:pb-12">
        <div className="my-auto w-full max-w-md">
          {authError && (
            <p role="alert" className="mb-4 rounded-xl border border-red/40 bg-red/10 px-3 py-2 text-sm">
              Le lien de connexion est invalide ou a expiré. Réessayez.
            </p>
          )}
          <AuthForm initialMode={mode} next={next} />
        </div>
      </section>

      {/* Panneau média : tous les clips officiels à la suite, chacun joué une fois */}
      <aside className="relative min-h-[38vh] overflow-hidden lg:sticky lg:top-0 lg:h-dvh lg:min-h-0" aria-label="Clips officiels">
        {sequence.length ? <MediaMontage items={sequence} fill /> : <div className="absolute inset-0 bg-[image:var(--gradient-vi)]" />}
      </aside>
    </main>
  );
}
