"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Choix d'un nouveau mot de passe après un lien de réinitialisation (session déjà ouverte par /auth/callback). */
export function UpdatePasswordForm() {
  const auth = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("8 caractères minimum.");
    if (password !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setBusy(true);
    const r = await auth.updatePassword(password);
    setBusy(false);
    if (r.error) return setError(r.error);
    setDone(true);
    setTimeout(() => router.replace("/map"), 1200);
  };

  return (
    <div className="rs-card rounded-3xl p-6 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Nouveau mot de passe</h1>
      {!auth.loading && !auth.user && (
        <p className="mt-2 text-sm text-muted">Le lien a expiré ou la session est absente : refaites une demande depuis la page de connexion.</p>
      )}
      {done ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-success">
          <Check className="h-4 w-4" /> Mot de passe mis à jour, redirection…
        </p>
      ) : (
        <form className="mt-6 flex flex-col gap-3" onSubmit={submit}>
          <Input type="password" required minLength={8} placeholder="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="h-11 rounded-xl" />
          <Input type="password" required minLength={8} placeholder="Confirmer" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="h-11 rounded-xl" />
          {error && <p role="alert" className="rounded-xl border border-red/40 bg-red/10 px-3 py-2 text-sm">{error}</p>}
          <Button type="submit" size="lg" className="w-full rounded-full font-bold" disabled={busy || !auth.user}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Enregistrer
          </Button>
        </form>
      )}
    </div>
  );
}
