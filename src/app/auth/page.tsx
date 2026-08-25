import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = {
  title: "Connexion / Créer un compte",
  description: "Créez un compte gratuit pour synchroniser votre progression GTA VI Map entre vos appareils.",
  robots: { index: false },
};

function safeNext(value: string | string[] | undefined): string {
  const v = typeof value === "string" ? value : "/map";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/map";
}

export default async function AuthPage({ searchParams }: PageProps<"/auth">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const mode = params.mode === "signup" ? "signup" : "signin";
  const authError = params.auth === "error";

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="vi-halo pointer-events-none absolute inset-0 opacity-70" />
      <Link href="/" className="relative mb-8 flex items-center gap-3" aria-label="Accueil">
        <Image src="/brand/gta-vi-logo.svg" alt="" width={980} height={744} unoptimized className="h-10 w-auto" />
        <span className="vi-kicker text-muted">Interactive Map</span>
      </Link>
      <div className="relative w-full max-w-md">
        {authError && (
          <p role="alert" className="mb-3 rounded-xl border border-red/40 bg-red/10 px-3 py-2 text-sm">
            Le lien de connexion est invalide ou a expiré. Réessayez.
          </p>
        )}
        <AuthForm initialMode={mode} next={next} />
      </div>
    </main>
  );
}
