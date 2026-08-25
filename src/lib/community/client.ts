"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChatMessage, ChatPoll, ChatProfile, PollOption, PublicProfile } from "@/types/community";

export interface ActionResult<T = void> {
  data?: T;
  error: string | null;
}

function translate(message: string | undefined): string | null {
  if (!message) return null;
  if (/Trop rapide/.test(message)) return "Trop rapide : attendez 2 secondes entre deux messages.";
  if (/terminé/.test(message)) return "Ce sondage est terminé.";
  if (/row-level security|permission denied/i.test(message)) return "Connectez-vous pour participer.";
  return message;
}

export async function sendMessage(input: { userId: string; content: string; replyTo?: string | null; locationSlug?: string | null }): Promise<ActionResult<string>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase non configuré" };
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      user_id: input.userId,
      kind: input.locationSlug ? "location" : "text",
      content: input.content.trim().slice(0, 1000),
      location_slug: input.locationSlug ?? null,
      reply_to: input.replyTo ?? null,
    })
    .select("id")
    .single();
  return { data: (data as { id: string } | null)?.id, error: translate(error?.message) };
}

export async function createPoll(input: {
  userId: string;
  question: string;
  options: string[];
  minutes: number;
  replyTo?: string | null;
}): Promise<ActionResult<string>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase non configuré" };
  const options: PollOption[] = input.options
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((label, i) => ({ id: String.fromCharCode(97 + i), label: label.slice(0, 80) }));
  if (options.length < 2) return { error: "Un sondage a besoin d'au moins deux options." };

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ user_id: input.userId, kind: "poll", content: input.question.trim().slice(0, 200), reply_to: input.replyTo ?? null })
    .select("id")
    .single();
  if (error || !data) return { error: translate(error?.message) ?? "Erreur" };
  const messageId = (data as { id: string }).id;
  const endsAt = new Date(Date.now() + input.minutes * 60_000).toISOString();
  const { error: pollError } = await supabase.from("chat_polls").insert({
    message_id: messageId,
    question: input.question.trim().slice(0, 200),
    options,
    ends_at: endsAt,
    created_by: input.userId,
  });
  if (pollError) {
    await supabase.from("chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId);
    return { error: translate(pollError.message) };
  }
  return { data: messageId, error: null };
}

export async function toggleReaction(input: { messageId: string; userId: string; emoji: string; active: boolean }): Promise<ActionResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase non configuré" };
  const { error } = input.active
    ? await supabase.from("chat_reactions").delete().match({ message_id: input.messageId, user_id: input.userId, emoji: input.emoji })
    : await supabase.from("chat_reactions").insert({ message_id: input.messageId, user_id: input.userId, emoji: input.emoji });
  return { error: translate(error?.message) };
}

export async function votePoll(input: { pollId: string; userId: string; optionId: string }): Promise<ActionResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase non configuré" };
  const { error } = await supabase.from("chat_poll_votes").upsert({ poll_id: input.pollId, user_id: input.userId, option_id: input.optionId }, { onConflict: "poll_id,user_id" });
  return { error: translate(error?.message) };
}

export async function deleteMessage(id: string): Promise<ActionResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase non configuré" };
  const { error } = await supabase.from("chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  return { error: translate(error?.message) };
}

/** Profils manquants (nouveaux auteurs arrivés en temps réel). */
export async function fetchProfiles(ids: string[]): Promise<Record<string, ChatProfile>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !ids.length) return {};
  const { data } = await supabase.from("profiles").select("id, display_name, avatar_url, banner_url").in("id", ids);
  const out: Record<string, ChatProfile> = {};
  for (const p of (data ?? []) as { id: string; display_name: string; avatar_url: string | null; banner_url: string | null }[]) {
    out[p.id] = { id: p.id, displayName: p.display_name || "Joueur", avatarUrl: p.avatar_url, bannerUrl: p.banner_url };
  }
  return out;
}

const profileCache = new Map<string, Promise<PublicProfile | null>>();

/** Profil public + stats (mémoïsé le temps de la session). */
export function fetchPublicProfile(id: string): Promise<PublicProfile | null> {
  const cached = profileCache.get(id);
  if (cached) return cached;
  const p = (async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data } = await supabase.rpc("public_profile", { uid: id });
    const r = (Array.isArray(data) ? data[0] : data) as
      | { id: string; display_name: string; avatar_url: string | null; banner_url: string | null; member_since: string; found_count: number; custom_markers: number; messages_count: number; by_group: Record<string, number> | null }
      | undefined;
    if (!r) return null;
    return {
      id: r.id,
      displayName: r.display_name || "Joueur",
      avatarUrl: r.avatar_url,
      bannerUrl: r.banner_url,
      memberSince: r.member_since,
      foundCount: r.found_count ?? 0,
      customMarkers: r.custom_markers ?? 0,
      messagesCount: r.messages_count ?? 0,
      byGroup: r.by_group ?? {},
    } satisfies PublicProfile;
  })();
  profileCache.set(id, p);
  return p;
}

export async function fetchPoll(messageId: string): Promise<ChatPoll | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.from("chat_polls").select("message_id, question, options, ends_at, created_by").eq("message_id", messageId).maybeSingle();
  if (!data) return null;
  const p = data as { message_id: string; question: string; options: PollOption[]; ends_at: string; created_by: string };
  return { messageId: p.message_id, question: p.question, options: p.options, endsAt: p.ends_at, createdBy: p.created_by };
}

export async function fetchMessage(id: string): Promise<ChatMessage | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.from("chat_messages").select("id, user_id, kind, content, location_slug, reply_to, created_at, deleted_at").eq("id", id).maybeSingle();
  if (!data) return null;
  const r = data as { id: string; user_id: string; kind: ChatMessage["kind"]; content: string; location_slug: string | null; reply_to: string | null; created_at: string; deleted_at: string | null };
  return { id: r.id, userId: r.user_id, kind: r.kind, content: r.content, locationSlug: r.location_slug, replyTo: r.reply_to, createdAt: r.created_at, deletedAt: r.deleted_at };
}
