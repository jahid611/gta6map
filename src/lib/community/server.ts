import "server-only";

import { cache } from "react";
import type { ChatMessage, ChatPoll, ChatProfile, ChatReaction, CommunityBootstrap, PollVote, PublicProfile, SlimLocation } from "@/types/community";
import { getCategories, getLocations } from "@/lib/data/locations";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { frameUrl, photoUrl, wikiImageUrl } from "@/lib/media";

/** Nombre de messages chargés au premier rendu (les suivants arrivent en temps réel). */
export const INITIAL_MESSAGES = 60;

interface MessageRow {
  id: string;
  user_id: string;
  kind: ChatMessage["kind"];
  content: string;
  location_slug: string | null;
  reply_to: string | null;
  created_at: string;
  deleted_at: string | null;
}
interface ProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  banner_url: string | null;
}

export function mapMessage(r: MessageRow): ChatMessage {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    content: r.content,
    locationSlug: r.location_slug,
    replyTo: r.reply_to,
    createdAt: r.created_at,
    deletedAt: r.deleted_at,
  };
}

/** Lieux allégés (recherche + cartes partagées), image résolue côté serveur. */
export const getSlimLocations = cache(async (): Promise<SlimLocation[]> => {
  const locations = await getLocations();
  return locations.map((l) => ({
    slug: l.slug,
    name: l.name,
    area: l.area,
    categorySlug: l.categorySlug,
    image: frameUrl(l.media?.frame) ?? photoUrl(l.photos.ig) ?? wikiImageUrl(l.wiki) ?? null,
  }));
});

export const getCommunityBootstrap = cache(async (): Promise<CommunityBootstrap | null> => {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const [{ data: messageRows }, locations, categories] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("id, user_id, kind, content, location_slug, reply_to, created_at, deleted_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(INITIAL_MESSAGES),
    getSlimLocations(),
    getCategories(),
  ]);

  const messages = ((messageRows ?? []) as MessageRow[]).map(mapMessage).reverse();
  const ids = messages.map((m) => m.id);
  const replyIds = messages.map((m) => m.replyTo).filter((x): x is string => !!x && !ids.includes(x));

  const [{ data: reactionRows }, { data: pollRows }, { data: voteRows }, { data: quotedRows }] = await Promise.all([
    ids.length ? supabase.from("chat_reactions").select("message_id, user_id, emoji").in("message_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("chat_polls").select("message_id, question, options, ends_at, created_by").in("message_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("chat_poll_votes").select("poll_id, user_id, option_id").in("poll_id", ids) : Promise.resolve({ data: [] }),
    replyIds.length
      ? supabase.from("chat_messages").select("id, user_id, kind, content, location_slug, reply_to, created_at, deleted_at").in("id", replyIds)
      : Promise.resolve({ data: [] }),
  ]);

  const quoted = ((quotedRows ?? []) as MessageRow[]).map(mapMessage);
  const allMessages = [...quoted, ...messages];
  const userIds = [...new Set(allMessages.map((m) => m.userId))];
  const { data: profileRows } = userIds.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url, banner_url").in("id", userIds)
    : { data: [] };

  const profiles: Record<string, ChatProfile> = {};
  for (const p of (profileRows ?? []) as ProfileRow[]) {
    profiles[p.id] = { id: p.id, displayName: p.display_name || "Joueur", avatarUrl: p.avatar_url, bannerUrl: p.banner_url };
  }

  const reactions: ChatReaction[] = ((reactionRows ?? []) as { message_id: string; user_id: string; emoji: string }[]).map((r) => ({
    messageId: r.message_id,
    userId: r.user_id,
    emoji: r.emoji,
  }));
  const polls: ChatPoll[] = ((pollRows ?? []) as { message_id: string; question: string; options: ChatPoll["options"]; ends_at: string; created_by: string }[]).map(
    (p) => ({ messageId: p.message_id, question: p.question, options: p.options, endsAt: p.ends_at, createdBy: p.created_by }),
  );
  const votes: PollVote[] = ((voteRows ?? []) as { poll_id: string; user_id: string; option_id: string }[]).map((v) => ({
    pollId: v.poll_id,
    userId: v.user_id,
    optionId: v.option_id,
  }));

  return {
    messages: allMessages,
    reactions,
    polls,
    votes,
    profiles,
    locations,
    categories: categories.map((c) => ({ slug: c.slug, name: c.name, color: c.color })),
  };
});

interface PublicProfileRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  banner_url: string | null;
  member_since: string;
  found_count: number;
  custom_markers: number;
  messages_count: number;
  by_group: Record<string, number> | null;
}

export function mapPublicProfile(r: PublicProfileRow): PublicProfile {
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
  };
}

export const getPublicProfile = cache(async (id: string): Promise<PublicProfile | null> => {
  const supabase = await getSupabaseServerClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.rpc("public_profile", { uid: id });
  const row = (Array.isArray(data) ? data[0] : data) as PublicProfileRow | undefined;
  return row ? mapPublicProfile(row) : null;
});
