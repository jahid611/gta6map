import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getCommunityBootstrap } from "@/lib/community/server";
import { CommunityHub } from "@/components/community/CommunityHub";

export const metadata: Metadata = {
  title: "Communauté",
  description: "Le chat global de GTA VI Map : partagez des lieux de la carte, répondez, réagissez, lancez des sondages.",
  alternates: { canonical: "/community" },
};
export const dynamic = "force-dynamic";

export default async function CommunityPage({ searchParams }: PageProps<"/community">) {
  const [bootstrap, params] = await Promise.all([getCommunityBootstrap(), searchParams]);
  const share = typeof params.share === "string" && /^[a-z0-9-]+$/.test(params.share) ? params.share : null;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-4 sm:px-6">
        <Link href="/" className="inline-flex items-center gap-3" aria-label="Accueil">
          <Image src="/brand/gta-vi-logo.svg" alt="" width={980} height={744} unoptimized className="h-7 w-auto" />
          <span className="vi-kicker hidden text-muted sm:block">Interactive Map</span>
        </Link>
        <div className="ml-2 min-w-0">
          <h1 className="font-display truncate text-base font-extrabold leading-none">Communauté</h1>
          <p className="truncate text-[11px] text-muted">Chat global · lieux partagés · sondages</p>
        </div>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/galerie" className="hidden px-3 py-2 text-muted hover:text-foreground sm:block">Galerie</Link>
          <Link href="/compte" className="hidden px-3 py-2 text-muted hover:text-foreground sm:block">Mon compte</Link>
          <Link href="/map" className="rs-pill px-4 py-2 font-semibold">Ouvrir la carte</Link>
        </nav>
      </header>

      <main className="min-h-0 flex-1">
        {bootstrap ? (
          <CommunityHub bootstrap={bootstrap} initialShareSlug={share} />
        ) : (
          <div className="mx-auto max-w-md px-6 py-20 text-center text-sm text-muted">
            <p className="font-display text-xl font-extrabold text-foreground">Communauté indisponible</p>
            <p className="mt-2">La base de données n&apos;est pas configurée sur ce déploiement.</p>
          </div>
        )}
      </main>
    </div>
  );
}
