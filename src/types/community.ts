export type ChatKind = "text" | "location" | "poll";

/** Profil minimal affiché dans le chat. */
export interface ChatProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

/** Profil public enrichi (RPC `public_profile`). */
export interface PublicProfile extends ChatProfile {
  memberSince: string;
  foundCount: number;
  customMarkers: number;
  messagesCount: number;
  /** Lieux trouvés par groupe de catégories (`gameplay`, `landmark`, `media`). */
  byGroup: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  userId: string;
  kind: ChatKind;
  content: string;
  locationSlug: string | null;
  replyTo: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export interface ChatReaction {
  messageId: string;
  userId: string;
  emoji: string;
}

export interface PollOption {
  id: string;
  label: string;
}

export interface ChatPoll {
  messageId: string;
  question: string;
  options: PollOption[];
  endsAt: string;
  createdBy: string;
}

export interface PollVote {
  pollId: string;
  userId: string;
  optionId: string;
}

/** Lieu allégé pour la recherche / les cartes partagées dans le chat. */
export interface SlimLocation {
  slug: string;
  name: string;
  area: string | null;
  categorySlug: string;
  image: string | null;
}

export interface CommunityBootstrap {
  messages: ChatMessage[];
  reactions: ChatReaction[];
  polls: ChatPoll[];
  votes: PollVote[];
  profiles: Record<string, ChatProfile>;
  locations: SlimLocation[];
  categories: { slug: string; name: string; color: string }[];
}

/** Réactions rapides proposées sous chaque message. */
export const QUICK_EMOJIS = ["👍", "🔥", "❤️", "😂", "😮", "😢", "👀", "🎯"] as const;

/** Durées de sondage proposées (minutes). */
export const POLL_DURATIONS = [
  { minutes: 60, label: "1 heure" },
  { minutes: 6 * 60, label: "6 heures" },
  { minutes: 24 * 60, label: "24 heures" },
  { minutes: 3 * 24 * 60, label: "3 jours" },
  { minutes: 7 * 24 * 60, label: "1 semaine" },
] as const;
