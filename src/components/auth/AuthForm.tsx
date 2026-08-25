"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Mail } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "forgot" | "magic";

interface AuthFormProps {
  initialMode?: Mode;
  /** Page de retour après connexion (`/map` par défaut). */
  next?: string;
}

const TITLES: Record<Mode, { title: string; subtitle: string }> = {
  signin: { title: "Bon retour à Leonida", subtitle: "Retrouvez votre progression sur tous vos appareils." },
  signup: { title: "Rejoindre la carte", subtitle: "Gratuit. Progression, notes et marqueurs synchronisés, avatar GTA au choix." },
  forgot: { title: "Mot de passe oublié", subtitle: "Nous vous envoyons un lien pour le réinitialiser." },
  magic: { title: "Lien magique", subtitle: "Connexion sans mot de passe, par email." },
};

/** Formulaire de connexion / inscription — email + mot de passe, Google, lien magique. */
export function AuthForm({ initialMode = "signin", next = "/map" }: AuthFormProps) {
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (auth.user && !success) router.replace(next);
  }, [auth.user, next, router, success]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setSuccess(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        const r = await auth.signInWithPassword(email, password);
        if (r.error) setError(r.error);
        else router.replace(next);
      } else if (mode === "signup") {
        if (password.length < 8) {
          setError("Le mot de passe doit contenir au moins 8 caractères.");
          return;
        }
        const r = await auth.signUpWithPassword(email, password, displayName || email.split("@")[0], next);
        if (r.error) setError(r.error);
        else if (r.needsEmailConfirmation) setSuccess("Compte créé ! Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.");
        else router.replace(next);
      } else if (mode === "forgot") {
        const r = await auth.resetPassword(email);
        if (r.error) setError(r.error);
        else setSuccess("Email envoyé : suivez le lien pour choisir un nouveau mot de passe.");
      } else {
        const r = await auth.signInWithEmail(email, next);
        if (r.error) setError(r.error);
        else setSuccess("Lien envoyé ✔ ouvrez-le depuis votre boîte mail pour vous connecter.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!auth.enabled) {
    return (
      <div className="text-sm">
        <h1 className="font-display text-2xl font-extrabold">Comptes non activés</h1>
        <p className="mt-2 text-muted">
          La base de données n&apos;est pas connectée : votre progression est sauvegardée localement dans ce navigateur.
        </p>
        <Link href="/map" className="rs-pill mt-5 inline-flex items-center gap-2 px-4 py-2 font-semibold">
          <ArrowLeft className="h-4 w-4" /> Retour à la carte
        </Link>
      </div>
    );
  }

  const { title, subtitle } = TITLES[mode];
  const inputClass = "h-12 rounded-xl border-white/10 bg-white/[0.06] text-[15px] placeholder:text-white/35 focus-visible:ring-accent";

  return (
    <div>
      {(mode === "signin" || mode === "signup") && (
        <div className="mb-7 grid grid-cols-2 rounded-full bg-white/[0.06] p-1 text-sm font-semibold">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={cn(
                "rounded-full py-2.5 transition-colors cursor-pointer",
                mode === m ? "bg-accent text-white shadow-[0_0_24px_rgba(249,118,176,0.4)]" : "text-muted hover:text-foreground",
              )}
              aria-pressed={mode === m}
            >
              {m === "signin" ? "Connexion" : "Créer un compte"}
            </button>
          ))}
        </div>
      )}

      <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight">{title}</h1>
      <p className="mt-2 text-[15px] text-muted">{subtitle}</p>

      {success ? (
        <div className="mt-7 flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p>{success}</p>
        </div>
      ) : (
        <form className="mt-7 flex flex-col gap-3" onSubmit={submit} noValidate>
          {mode === "signup" && (
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              Pseudo
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Lucia_C" maxLength={40} autoComplete="nickname" className={inputClass} />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            Email
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" autoComplete="email" className={inputClass} />
          </label>
          {(mode === "signin" || mode === "signup") && (
            <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
              Mot de passe
              <span className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "8 caractères minimum" : "••••••••"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className={cn(inputClass, "pr-12")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-foreground cursor-pointer"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-red/40 bg-red/10 px-3 py-2 text-sm text-accent-pale">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-2 h-12 w-full rounded-full text-base font-bold" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "signin" && "Se connecter"}
            {mode === "signup" && "Créer mon compte"}
            {mode === "forgot" && "Envoyer le lien"}
            {mode === "magic" && "Recevoir un lien magique"}
          </Button>

          {mode === "signin" && (
            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => switchMode("forgot")} className="text-muted hover:text-foreground cursor-pointer">
                Mot de passe oublié ?
              </button>
              <button type="button" onClick={() => switchMode("magic")} className="inline-flex items-center gap-1 text-muted hover:text-foreground cursor-pointer">
                <Mail className="h-3.5 w-3.5" /> Lien magique
              </button>
            </div>
          )}
        </form>
      )}

      {(mode === "signin" || mode === "signup") && (
        <>
          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-2">
            <span className="h-px flex-1 bg-white/10" /> ou <span className="h-px flex-1 bg-white/10" />
          </div>
          <button
            type="button"
            onClick={() => auth.signInWithGoogle(next)}
            className="rs-pill flex h-12 w-full items-center justify-center gap-3 px-4 text-sm font-semibold cursor-pointer"
          >
            <GoogleMark /> Continuer avec Google
          </button>
        </>
      )}

      {(mode === "forgot" || mode === "magic" || success) && (
        <button type="button" onClick={() => switchMode("signin")} className="mt-6 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground cursor-pointer">
          <ArrowLeft className="h-3.5 w-3.5" /> Retour à la connexion
        </button>
      )}

      <p className="mt-8 text-[11px] leading-relaxed text-muted-2">
        Carte non officielle, sans lien avec Rockstar Games. En continuant, vous acceptez les{" "}
        <Link href="/terms" className="underline hover:text-foreground">conditions d&apos;utilisation</Link> et les{" "}
        <Link href="/privacy" className="underline hover:text-foreground">règles de confidentialité</Link>.
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12S6.6 21.8 12 21.8c5.6 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
