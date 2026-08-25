"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "@/components/ui/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Connexion Google via Google Identity Services (flux « ID token »).
 *
 * Contrairement à `signInWithOAuth`, l'écran de consentement Google affiche
 * notre identité (gta6map.pro) et non l'URL du projet Supabase. Le jeton ID
 * renvoyé par Google est ensuite échangé contre une session Supabase.
 *
 * Nonce : on génère 32 octets aléatoires (base64url). Google reçoit le SHA-256
 * hexadécimal (`initialize({ nonce })`), Supabase reçoit la valeur BRUTE
 * (`signInWithIdToken({ nonce })`) — l'inverse est l'erreur classique.
 */

const GSI_SRC = "https://accounts.google.com/gsi/client";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface CredentialResponse {
  credential: string;
}
interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (r: CredentialResponse) => void; nonce?: string; ux_mode?: "popup" | "redirect"; use_fedcm_for_prompt?: boolean }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
  cancel?: () => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  return { raw, hashed };
}

let scriptPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Impossible de charger Google Identity Services"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function GoogleSignInButton({ next = "/map", onError }: { next?: string; onError?: (message: string) => void }) {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "signing" | "unavailable">("loading");

  useEffect(() => {
    if (!CLIENT_ID) {
      setState("unavailable");
      return;
    }
    let cancelled = false;
    let rawNonce = "";

    (async () => {
      try {
        const [, nonce] = await Promise.all([loadGsi(), makeNonce()]);
        if (cancelled || !hostRef.current || !window.google) return;
        rawNonce = nonce.raw;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: nonce.hashed,
          ux_mode: "popup",
          use_fedcm_for_prompt: true,
          callback: async (response) => {
            setState("signing");
            const supabase = getSupabaseBrowserClient();
            if (!supabase) return onError?.("Supabase non configuré");
            const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: response.credential, nonce: rawNonce });
            if (error) {
              setState("ready");
              onError?.(error.message);
              return;
            }
            router.push(next);
            router.refresh();
          },
        });
        hostRef.current.replaceChildren();
        window.google.accounts.id.renderButton(hostRef.current, {
          theme: "filled_black",
          shape: "pill",
          text: "continue_with",
          size: "large",
          locale: "fr",
          width: Math.min(400, hostRef.current.clientWidth || 360),
          logo_alignment: "left",
        });
        setState("ready");
      } catch (err) {
        if (!cancelled) {
          setState("unavailable");
          onError?.(err instanceof Error ? err.message : "Google indisponible");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [next, onError, router]);

  if (state === "unavailable") return null;

  return (
    <div className="relative flex min-h-11 w-full items-center justify-center">
      {/* Google rend son propre bouton ici (thème sombre, pilule, « Continuer avec Google »). */}
      <div ref={hostRef} className={state === "signing" ? "pointer-events-none opacity-40" : ""} aria-busy={state !== "ready"} />
      {state !== "ready" && (
        <span className="absolute inset-0 grid place-items-center text-xs text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      )}
    </div>
  );
}
