"use client";

import { useState } from "react";
import { Cloud, CloudOff, LogIn, LogOut, Mail } from "lucide-react";
import type { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type AuthApi = ReturnType<typeof useAuth>;

/** Connexion Supabase (Google / magic link) pour synchroniser la progression. */
export function AuthButton({ auth }: { auth: AuthApi }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);

  if (!auth.enabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="grid h-9 w-9 place-items-center rounded-lg text-muted" aria-label="Mode local">
            <CloudOff className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Progression sauvegardée localement (Supabase non configuré)</TooltipContent>
      </Tooltip>
    );
  }

  if (auth.user) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={auth.signOut} aria-label="Se déconnecter">
            <Cloud className="h-4 w-4 text-success" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Synchronisé · {auth.user.email ?? "compte"} — cliquer pour se déconnecter <LogOut className="ml-1 inline h-3 w-3" />
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} disabled={auth.loading}>
        <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Connexion</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-border bg-surface p-3 shadow-2xl">
          <p className="mb-2 text-xs text-muted">Connectez-vous pour synchroniser votre progression entre appareils.</p>
          <Button className="w-full" variant="secondary" onClick={auth.signInWithGoogle}>
            Continuer avec Google
          </Button>
          <form
            className="mt-2 flex gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await auth.signInWithEmail(email);
              setSent(error ? `Erreur : ${error}` : "Lien envoyé ✔ vérifiez vos emails");
            }}
          >
            <Input
              type="email"
              required
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-8 text-xs"
            />
            <Button type="submit" size="sm" variant="outline" aria-label="Envoyer un lien magique">
              <Mail className="h-3.5 w-3.5" />
            </Button>
          </form>
          {sent && <p className="mt-2 text-xs text-muted">{sent}</p>}
        </div>
      )}
    </div>
  );
}
