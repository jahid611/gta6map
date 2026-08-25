"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

export interface AuthResult {
  error: string | null;
  /** `true` quand Supabase exige une confirmation par email avant la première connexion. */
  needsEmailConfirmation?: boolean;
}

export interface AuthState {
  /** `false` si Supabase n'est pas configuré (mode local). */
  enabled: boolean;
  loading: boolean;
  user: User | null;
  session: Session | null;
  /** Pseudo (metadata `display_name`) ou début de l'email. */
  displayName: string | null;
  /** Photo de profil courante : avatar choisi (`avatar_url`) sinon photo Google (`picture`). */
  avatarUrl: string | null;
  /** Photo fournie par Google, si le compte est lié à Google. */
  googleAvatarUrl: string | null;
  /** Change la photo de profil (`null` = revenir à la photo Google / aux initiales). */
  updateAvatar: (url: string | null) => Promise<AuthResult>;
  signInWithGoogle: (next?: string) => Promise<void>;
  /** Lien magique (sans mot de passe). */
  signInWithEmail: (email: string, next?: string) => Promise<AuthResult>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string, displayName: string, next?: string) => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  updateDisplayName: (displayName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

/** Traduit les messages d'erreur Supabase les plus courants. */
function translateError(message: string | undefined): string | null {
  if (!message) return null;
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirmez votre email avant de vous connecter (vérifiez vos spams).";
  if (m.includes("user already registered")) return "Un compte existe déjà avec cet email.";
  if (m.includes("password should be at least")) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (m.includes("rate limit") || m.includes("too many requests")) return "Trop de tentatives, réessayez dans quelques minutes.";
  if (m.includes("invalid email")) return "Adresse email invalide.";
  return message;
}

function callbackUrl(next?: string): string {
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/map";
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;
}

export function useAuth(): AuthState {
  const enabled = isSupabaseConfigured();
  const [loading, setLoading] = useState(enabled);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async (next?: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl(next) } });
  }, []);

  const signInWithEmail = useCallback(async (email: string, next?: string): Promise<AuthResult> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase non configuré" };
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl(next) } });
    return { error: translateError(error?.message) };
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase non configuré" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: translateError(error?.message) };
  }, []);

  const signUpWithPassword = useCallback(
    async (email: string, password: string, displayName: string, next?: string): Promise<AuthResult> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Supabase non configuré" };
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName.trim() }, emailRedirectTo: callbackUrl(next) },
      });
      if (error) return { error: translateError(error.message) };
      // Session absente ⇒ confirmation par email activée côté Supabase.
      return { error: null, needsEmailConfirmation: !data.session };
    },
    [],
  );

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase non configuré" };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/auth/update-password")}`,
    });
    return { error: translateError(error?.message) };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase non configuré" };
    const { error } = await supabase.auth.updateUser({ password });
    return { error: translateError(error?.message) };
  }, []);

  const updateDisplayName = useCallback(async (displayName: string): Promise<AuthResult> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase non configuré" };
    const name = displayName.trim().slice(0, 40);
    const { error } = await supabase.auth.updateUser({ data: { display_name: name } });
    if (!error) {
      // Miroir dans `profiles` (table publique, RLS propriétaire).
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (userId) await supabase.from("profiles").upsert({ id: userId, display_name: name });
    }
    return { error: translateError(error?.message) };
  }, []);

  const updateAvatar = useCallback(async (url: string | null): Promise<AuthResult> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Supabase non configuré" };
    const current = (await supabase.auth.getUser()).data.user;
    const meta = (current?.user_metadata ?? {}) as { picture?: string };
    // `null` ⇒ retour à la photo Google si elle existe (sinon initiales).
    const next = url ?? meta.picture ?? null;
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: next } });
    if (!error && current) await supabase.from("profiles").upsert({ id: current.id, avatar_url: next });
    return { error: translateError(error?.message) };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const user = session?.user ?? null;
  const meta = (user?.user_metadata ?? {}) as {
    display_name?: string;
    full_name?: string;
    name?: string;
    avatar_url?: string | null;
    picture?: string;
  };
  const displayName = user ? (meta.display_name || meta.full_name || meta.name || user.email?.split("@")[0] || null) : null;
  const googleAvatarUrl = user ? (meta.picture ?? null) : null;
  const avatarUrl = user ? (meta.avatar_url ?? googleAvatarUrl) : null;

  return {
    enabled,
    loading,
    user,
    session,
    displayName,
    avatarUrl,
    googleAvatarUrl,
    updateAvatar,
    signInWithGoogle,
    signInWithEmail,
    signInWithPassword,
    signUpWithPassword,
    resetPassword,
    updatePassword,
    updateDisplayName,
    signOut,
  };
}
