import type { Metadata } from "next";
import { getCommunityBootstrap } from "@/lib/community/server";
import { CommunityHub } from "@/components/community/CommunityHub";
import { CommunityBackdrop } from "@/components/community/CommunityBackdrop";

export const metadata: Metadata = {
  title: "Communauté",
  description: "Le chat global de GTA6MAP : partagez des lieux de la carte, répondez, réagissez, lancez des sondages.",
  alternates: { canonical: "/community" },
};
export const dynamic = "force-dynamic";

export default async function CommunityPage({ searchParams }: PageProps<"/community">) {
  const [bootstrap, params] = await Promise.all([getCommunityBootstrap(), searchParams]);
  const share = typeof params.share === "string" && /^[a-z0-9-]+$/.test(params.share) ? params.share : null;

  return (
    <div className="flex h-dvh flex-col pt-16">
      <CommunityBackdrop />
      <h1 className="sr-only">Communauté — chat global, lieux partagés, sondages</h1>

      {/* `relative z-10` : le fil passe devant le décor, qui est en z-0. */}
      <main className="relative z-10 min-h-0 flex-1">
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
