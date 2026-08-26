"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronDown, CornerDownLeft, ExternalLink, Loader2, MapPin, Plus, Trophy, X } from "@/components/ui/icons";
import { useAuth } from "@/hooks/useAuth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createPoll,
  deleteMessage,
  fetchMessage,
  fetchPoll,
  fetchProfiles,
  fetchPublicProfile,
  sendMessage,
  toggleReaction,
  votePoll,
} from "@/lib/community/client";
import { CATEGORY_GROUP_LABELS } from "@/lib/data/categories";
import { pastel } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader } from "@/components/ui/message";
import { Action } from "@/components/ui/actions";
import {
  POLL_DURATIONS,
  QUICK_EMOJIS,
  type ChatMessage,
  type ChatPoll,
  type ChatProfile,
  type ChatReaction,
  type CommunityBootstrap,
  type PollVote,
  type PublicProfile,
  type SlimLocation,
} from "@/types/community";

/** Ressort de l ouverture du champ de saisie, repris de `easemize/ai-chat-input`. */
const COMPOSER_SPRING = "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)";

/* ────────────────────────────── utilitaires ────────────────────────────── */

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function remaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "terminé";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `${m} min restantes`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h restantes`;
  return `${Math.floor(h / 24)} j restants`;
}

function Avatar({ profile, size = 36, className }: { profile: ChatProfile | undefined; size?: number; className?: string }) {
  const initials = (profile?.displayName ?? "?").slice(0, 2).toUpperCase();
  return (
    <span
      className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-[image:var(--gradient-vi)] font-display text-[11px] font-black text-white", className)}
      style={{ width: size, height: size }}
    >
      {profile?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" loading="lazy" />
      ) : (
        initials
      )}
    </span>
  );
}

/* ────────────────────────────── carte profil au survol ────────────────────────────── */

function ProfileHoverCard({ userId, profile }: { userId: string; profile: ChatProfile | undefined }) {
  const [data, setData] = useState<PublicProfile | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    fetchPublicProfile(userId).then((p) => alive && setData(p));
    return () => {
      alive = false;
    };
  }, [userId]);
  const p = data ?? null;
  const groups = p ? Object.entries(p.byGroup).filter(([, n]) => n > 0) : [];
  return (
    <div className="rs-card w-72 overflow-hidden rounded-2xl text-left">
      <div className="relative h-20">
        {(p?.bannerUrl ?? profile?.bannerUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={(p?.bannerUrl ?? profile?.bannerUrl) as string} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[image:var(--gradient-vi)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#16161d] via-[rgba(22,22,29,0.35)] to-transparent" />
      </div>
      {/* `relative z-10` : sans ça, la bannière (positionnée) se peint par-dessus l'avatar. */}
      <div className="relative z-10 -mt-6 px-4 pb-4">
        <Avatar profile={p ?? profile} size={48} className="border-2 border-[#13131a]" />
        <p className="font-display mt-2 truncate text-base font-extrabold">{p?.displayName ?? profile?.displayName ?? "Joueur"}</p>
        {data === undefined ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Loader2 className="h-3 w-3 animate-spin" /> Chargement…</p>
        ) : p ? (
          <>
            <p className="text-[11px] text-muted">Membre depuis {new Date(p.memberSince).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><dt className="text-[10px] uppercase tracking-wide text-muted">Trouvés</dt><dd className="vi-num text-lg font-extrabold">{p.foundCount}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-wide text-muted">Marqueurs</dt><dd className="vi-num text-lg font-extrabold">{p.customMarkers}</dd></div>
              <div><dt className="text-[10px] uppercase tracking-wide text-muted">Messages</dt><dd className="vi-num text-lg font-extrabold">{p.messagesCount}</dd></div>
            </dl>
            {groups.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1">
                {groups.map(([g, n]) => (
                  <li key={g} className="rs-pill px-2 py-0.5 text-[10px]">
                    {CATEGORY_GROUP_LABELS[g as keyof typeof CATEGORY_GROUP_LABELS] ?? g} · <span className="vi-num">{n}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/u/${userId}`} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-2 hover:underline">
              Voir le profil <ExternalLink className="h-3 w-3" />
            </Link>
          </>
        ) : (
          <p className="mt-1 text-xs text-muted">Profil indisponible.</p>
        )}
      </div>
    </div>
  );
}

const HOVER_CARD_W = 288;
const HOVER_CARD_H = 300;

/**
 * Pseudo + avatar ; au survol, la carte profil est rendue dans un portail en
 * position fixe : sous le pseudo s'il reste de la place, sinon au-dessus, et
 * toujours ramenée dans l'écran — jamais rognée par le composer ni par la liste.
 */
function UserHandle({
  userId,
  profile,
  className,
  // Dans le fil, l'avatar est porté par `MessageAvatar`, collé au bas de la
  // bulle : le répéter dans l'en-tête ferait deux vignettes pour un message.
  hideAvatar = false,
}: {
  userId: string;
  profile: ChatProfile | undefined;
  className?: string;
  hideAvatar?: boolean;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const place = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 8;
    const below = r.bottom + margin + HOVER_CARD_H <= window.innerHeight - margin;
    const top = below ? r.bottom + margin : Math.max(margin, r.top - margin - HOVER_CARD_H);
    const left = Math.min(Math.max(margin, r.left), window.innerWidth - HOVER_CARD_W - margin);
    setPos({ top, left });
  };
  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(place, 350);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPos(null), 150);
  };
  // Un défilement ou un redimensionnement referme la carte (sa position ne serait plus juste).
  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  return (
    <span ref={anchorRef} className="relative inline-block" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <Link href={`/u/${userId}`} className={cn("inline-flex items-center gap-2 hover:underline", className)}>
        {!hideAvatar && <Avatar profile={profile} size={32} />}
        <span className="truncate font-semibold">{profile?.displayName ?? "Joueur"}</span>
      </Link>
      {pos &&
        createPortal(
          <div
            className="fixed z-[1200] animate-fade-in"
            style={{ top: pos.top, left: pos.left, width: HOVER_CARD_W }}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            <ProfileHoverCard userId={userId} profile={profile} />
          </div>,
          document.body,
        )}
    </span>
  );
}

/* ────────────────────────────── cartes lieu / sondage ────────────────────────────── */

function LocationCard({ location, categoryName, color }: { location: SlimLocation | undefined; categoryName: string | undefined; color: string | undefined }) {
  if (!location) return <p className="text-sm text-muted">Lieu introuvable.</p>;
  return (
    <div className="mt-2 flex max-w-md overflow-hidden rounded-2xl border border-white/10 bg-black/30">
      {location.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={location.image} alt="" className="h-28 w-32 shrink-0 object-cover sm:w-40" loading="lazy" />
      ) : (
        <div className="h-28 w-32 shrink-0 bg-[image:var(--gradient-vi)] sm:w-40" />
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: color ? pastel(color) : undefined }}>
            <MapPin className="h-3 w-3" /> {categoryName ?? "Lieu"}
          </p>
          <p className="font-display mt-0.5 truncate text-base font-extrabold">{location.name}</p>
          {location.area && <p className="truncate text-xs text-muted">{location.area}</p>}
        </div>
        <div className="mt-2 flex gap-3 text-xs">
          <Link href={`/map?l=${location.slug}`} className="inline-flex items-center gap-1 font-semibold text-accent-2 hover:underline">
            Voir sur la carte <ExternalLink className="h-3 w-3" />
          </Link>
          <Link href={`/location/${location.slug}`} className="text-muted hover:text-foreground">Fiche</Link>
        </div>
      </div>
    </div>
  );
}

function PollCard({ poll, votes, userId, onVote }: { poll: ChatPoll; votes: PollVote[]; userId: string | null; onVote: (optionId: string) => void }) {
  // Horloge en état (pas de `Date.now()` pendant le rendu) : rafraîchie toutes les 30 s.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const ended = new Date(poll.endsAt).getTime() <= now;
  const mine = votes.find((v) => v.userId === userId)?.optionId ?? null;
  const total = votes.length;
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v.optionId, (counts.get(v.optionId) ?? 0) + 1);
  const showResults = ended || mine !== null;
  return (
    <div className="mt-2 max-w-md rounded-2xl border border-white/10 bg-black/30 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-accent-pale">Sondage · {remaining(poll.endsAt)}</p>
      <p className="font-display mt-1 text-base font-extrabold">{poll.question}</p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {poll.options.map((o) => {
          const n = counts.get(o.id) ?? 0;
          const pct = total ? Math.round((n / total) * 100) : 0;
          const selected = mine === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                disabled={ended || !userId}
                onClick={() => onVote(o.id)}
                className={cn(
                  "relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                  selected ? "border-accent/60" : "border-white/10 hover:border-white/25",
                  ended || !userId ? "cursor-default" : "cursor-pointer",
                )}
                aria-pressed={selected}
              >
                {showResults && <span className="absolute inset-y-0 left-0 bg-accent/20" style={{ width: `${pct}%` }} aria-hidden />}
                <span className="relative flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    {selected && <Check className="h-3.5 w-3.5 text-accent" />}
                    {o.label}
                  </span>
                  {showResults && <span className="vi-num text-xs text-muted">{pct} % · {n}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] text-muted">
        <span className="vi-num">{total}</span> vote{total > 1 ? "s" : ""}
        {!userId && " · connectez-vous pour voter"}
      </p>
    </div>
  );
}

/* ────────────────────────────── message ────────────────────────────── */

interface MessageItemProps {
  message: ChatMessage;
  profile: ChatProfile | undefined;
  quoted: ChatMessage | undefined;
  quotedProfile: ChatProfile | undefined;
  reactions: ChatReaction[];
  poll: ChatPoll | undefined;
  votes: PollVote[];
  location: SlimLocation | undefined;
  category: { name: string; color: string } | undefined;
  userId: string | null;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onVote: (optionId: string) => void;
  onDelete: () => void;
}

function MessageItem({ message, profile, quoted, quotedProfile, reactions, poll, votes, location, category, userId, onReply, onReact, onVote, onDelete }: MessageItemProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const grouped = useMemo(() => {
    const m = new Map<string, { count: number; mine: boolean }>();
    for (const r of reactions) {
      const g = m.get(r.emoji) ?? { count: 0, mine: false };
      g.count += 1;
      if (r.userId === userId) g.mine = true;
      m.set(r.emoji, g);
    }
    return [...m.entries()];
  }, [reactions, userId]);

  const mine = !!userId && message.userId === userId;
  // La bulle n'habille que le texte. Une carte de lieu ou un sondage sont déjà
  // des cartes : les poser dans une bulle ferait une carte dans une carte.
  const bubbled = message.kind === "text" || (!!message.content && message.kind === "location");

  return (
    <Message
      id={`m-${message.id}`}
      align={mine ? "end" : "start"}
      className="items-end gap-2.5 px-1 py-1.5"
    >
      <MessageAvatar>
        <Avatar profile={profile} size={32} />
      </MessageAvatar>

      <MessageContent className={cn("gap-1", mine ? "items-end" : "items-start")}>
        <MessageHeader className={cn("gap-2 px-1 text-sm", mine && "flex-row-reverse")}>
          <UserHandle userId={message.userId} profile={profile} hideAvatar />
          <span className="text-[11px] text-muted">{timeAgo(message.createdAt)}</span>
        </MessageHeader>

        {quoted && (
          <a
            href={`#m-${quoted.id}`}
            className={cn(
              "flex max-w-[min(34rem,86%)] items-start gap-2 text-xs text-muted hover:text-foreground",
              // Le filet et la flèche de citation restent du côté de la bulle :
              // à gauche pour les autres, à droite pour soi.
              mine ? "flex-row-reverse border-r-2 border-accent/50 pr-3 text-right" : "border-l-2 border-accent/50 pl-3",
            )}
          >
            <CornerDownLeft className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-2">
              <span className="font-semibold text-foreground/80">{quotedProfile?.displayName ?? "Joueur"}</span> · {quoted.kind === "poll" ? `Sondage : ${quoted.content}` : quoted.kind === "location" ? `Lieu partagé${quoted.content ? ` — ${quoted.content}` : ""}` : quoted.content}
            </span>
          </a>
        )}

        {message.content && message.kind !== "poll" && (
          <p
            className={cn(
              "max-w-[min(34rem,86%)] whitespace-pre-wrap break-words text-[15px] leading-relaxed",
              bubbled &&
                cn(
                  "rounded-2xl border px-3.5 py-2.5",
                  mine
                    ? "rounded-br-md border-accent/35 bg-accent/15"
                    : "rounded-bl-md border-white/10 bg-white/[0.055]",
                ),
            )}
          >
            {message.content}
          </p>
        )}
        {message.kind === "location" && (
          <div className="max-w-[min(34rem,86%)]">
            <LocationCard location={location} categoryName={category?.name} color={category?.color} />
          </div>
        )}
        {message.kind === "poll" && (
          <div className="max-w-[min(34rem,86%)]">
            {poll ? <PollCard poll={poll} votes={votes} userId={userId} onVote={onVote} /> : <p className="mt-2 text-xs text-muted">Sondage…</p>}
          </div>
        )}

        {/* Une seule rangée sous la bulle : les réactions déjà posées avec leur
            compte, puis les gestes. Elle remplace à la fois les pastilles
            bordées et la barre flottante qui venait se poser sur le message.

            Les comptes se lisent en permanence ; les gestes n'apparaissent qu'au
            survol — et toujours au doigt, faute de survol pour les révéler. */}
        {(grouped.length > 0 || !!userId) && (
          <MessageFooter className="mt-0.5 flex-wrap gap-1">
            {grouped.map(([emoji, g]) => (
              <Action
                key={emoji}
                onClick={() => onReact(emoji)}
                disabled={!userId}
                aria-pressed={g.mine}
                tooltip={g.mine ? "Retirer ma réaction" : "Réagir"}
                className={cn("w-auto gap-1 px-2 text-sm", g.mine && "bg-accent/15 text-foreground")}
              >
                <span aria-hidden>{emoji}</span>
                <span className="vi-num text-[11px] text-muted">{g.count}</span>
              </Action>
            ))}

            {userId && (
              <span
                className={cn(
                  "flex items-center gap-0.5 transition-opacity",
                  // Un choix d'emoji ouvert ou une suppression en attente restent
                  // visibles même si la souris part : sinon la question
                  // disparaîtrait sans qu'on ait pu y répondre.
                  confirming || pickerOpen
                    ? "opacity-100"
                    : "opacity-0 focus-within:opacity-100 group-hover/message:opacity-100 [@media(pointer:coarse)]:opacity-100",
                )}
              >
                <Action onClick={() => setPickerOpen((v) => !v)} aria-expanded={pickerOpen} tooltip="Réagir">
                  <Plus className="h-3.5 w-3.5" />
                </Action>
                <Action onClick={onReply} tooltip="Répondre">
                  <CornerDownLeft className="h-3.5 w-3.5" />
                </Action>
                {/* Confirmation en place, jamais `window.confirm()` : la boîte
                    native gèle l'onglet entier, le temps réel compris. */}
                {message.userId === userId &&
                  (confirming ? (
                    <span className="flex items-center gap-2 px-1 text-xs">
                      <span className="text-muted">Supprimer ?</span>
                      <button type="button" onClick={onDelete} className="font-semibold text-red hover:underline cursor-pointer" autoFocus>
                        Oui
                      </button>
                      <button type="button" onClick={() => setConfirming(false)} className="text-muted hover:text-foreground hover:underline cursor-pointer">
                        Annuler
                      </button>
                    </span>
                  ) : (
                    <Action onClick={() => setConfirming(true)} tooltip="Supprimer" className="hover:text-red">
                      <X className="h-3.5 w-3.5" />
                    </Action>
                  ))}
              </span>
            )}
          </MessageFooter>
        )}

        {/* Le choix reste ouvert après un emoji : on peut en poser plusieurs
            d'affilée sur un même message, ce que l'ancien panneau interdisait en
            se refermant au premier clic. */}
        {pickerOpen && (
          <div className="mt-1 flex flex-wrap gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-1.5 backdrop-blur animate-fade-in">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => onReact(e)}
                className="rounded-full px-1 text-base leading-none transition-transform hover:scale-125 cursor-pointer"
                aria-label={`Réagir ${e}`}
              >
                {e}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              className="ml-1 grid place-items-center rounded-full px-1 text-muted hover:text-foreground cursor-pointer"
              aria-label="Fermer le choix d'emoji"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </MessageContent>

    </Message>
  );
}

/* ────────────────────────────── composer ────────────────────────────── */

type ComposerMode = "text" | "location" | "poll";

/* ────────────────────────────── hub ────────────────────────────── */

export function CommunityHub({ bootstrap, initialShareSlug = null }: { bootstrap: CommunityBootstrap; initialShareSlug?: string | null }) {
  const auth = useAuth();
  const router = useRouter();
  const userId = auth.user?.id ?? null;
  const [messages, setMessages] = useState<ChatMessage[]>(bootstrap.messages);
  const [reactions, setReactions] = useState<ChatReaction[]>(bootstrap.reactions);
  const [polls, setPolls] = useState<Record<string, ChatPoll>>(() => Object.fromEntries(bootstrap.polls.map((p) => [p.messageId, p])));
  const [votes, setVotes] = useState<PollVote[]>(bootstrap.votes);
  const [storedProfiles, setProfiles] = useState<Record<string, ChatProfile>>(bootstrap.profiles);
  // Le pseudo/avatar courant est reflété immédiatement, sans attendre la base (dérivé, pas d'effet).
  const profiles = useMemo<Record<string, ChatProfile>>(
    () =>
      auth.user
        ? { ...storedProfiles, [auth.user.id]: { id: auth.user.id, displayName: auth.displayName ?? "Joueur", avatarUrl: auth.avatarUrl, bannerUrl: auth.bannerUrl } }
        : storedProfiles,
    [storedProfiles, auth.user, auth.displayName, auth.avatarUrl, auth.bannerUrl],
  );
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  // Arrivée depuis une fiche lieu (`/community?share=slug`) : le lieu est déjà prêt à partager.
  const [mode, setMode] = useState<ComposerMode>(initialShareSlug ? "location" : "text");
  const [text, setText] = useState("");
  const [pickedLocation, setPickedLocation] = useState<SlimLocation | null>(
    () => (initialShareSlug ? (bootstrap.locations.find((l) => l.slug === initialShareSlug) ?? null) : null),
  );
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollMinutes, setPollMinutes] = useState<number>(POLL_DURATIONS[2].minutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  // Le champ démarre ouvert si l on arrive depuis la carte avec un lieu à partager.
  const [expanded, setExpanded] = useState(!!initialShareSlug);
  const composerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Armé à l'envoi : on descendra sur son propre message dès qu'il arrivera,
  // même si on lisait plus haut dans la conversation au moment d'écrire.
  const followOwnMessage = useRef(false);

  const locationBySlug = useMemo(() => new Map(bootstrap.locations.map((l) => [l.slug, l])), [bootstrap.locations]);
  const categories = useMemo(() => new Map(bootstrap.categories.map((c) => [c.slug, { name: c.name, color: c.color }])), [bootstrap.categories]);
  const messageById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const visible = useMemo(() => messages.filter((m) => !m.deletedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [messages]);

  const ensureProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter((id) => !profiles[id]);
    if (!missing.length) return;
    const found = await fetchProfiles(missing);
    setProfiles((p) => ({ ...p, ...found }));
  }, [profiles]);

  // Nettoie `?share=…` de l'URL et place le curseur dans le message d'accompagnement.
  useEffect(() => {
    if (!initialShareSlug) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("share")) {
      url.searchParams.delete("share");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    textareaRef.current?.focus();
  }, [initialShareSlug]);

  // Défilement : coller en bas quand l'utilisateur y est déjà.
  const scrollToBottom = useCallback((smooth = true) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  useEffect(() => {
    scrollToBottom(false);
  }, [scrollToBottom]);
  useEffect(() => {
    const last = visible[visible.length - 1];
    const mine = followOwnMessage.current && !!userId && last?.userId === userId;
    if (mine) followOwnMessage.current = false;
    if (atBottom || mine) scrollToBottom();
  }, [visible, atBottom, userId, scrollToBottom]);

  // Un message riche (aperçu de lieu, image) gagne de la hauteur APRÈS son
  // insertion : le défilement déclenché à l'arrivée du message visait alors un
  // bas de liste déjà périmé, et le dernier message restait sous le pli. On
  // resuit donc la hauteur réelle du contenu tant qu'on est collé en bas.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (atBottom) scrollToBottom(false);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [atBottom, scrollToBottom]);

  // Le champ grandit avec le texte jusqu'à 160 px, puis défile. On le remet à
  // zéro avant de lire `scrollHeight` : sans ça, il ne peut que grandir, jamais
  // se rétracter quand on efface des lignes.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text, expanded, mode]);

  // ── Temps réel ──
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("community")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, async (payload) => {
        const r = payload.new as { id: string; user_id: string; kind: ChatMessage["kind"]; content: string; location_slug: string | null; reply_to: string | null; created_at: string; deleted_at: string | null };
        const m: ChatMessage = { id: r.id, userId: r.user_id, kind: r.kind, content: r.content, locationSlug: r.location_slug, replyTo: r.reply_to, createdAt: r.created_at, deletedAt: r.deleted_at };
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        void ensureProfiles([m.userId]);
        if (m.replyTo && !messageById.has(m.replyTo)) {
          const q = await fetchMessage(m.replyTo);
          if (q) {
            setMessages((prev) => (prev.some((x) => x.id === q.id) ? prev : [q, ...prev]));
            void ensureProfiles([q.userId]);
          }
        }
        if (m.kind === "poll") {
          // Le sondage est inséré juste après le message : petite attente puis lecture.
          setTimeout(async () => {
            const p = await fetchPoll(m.id);
            if (p) setPolls((prev) => ({ ...prev, [p.messageId]: p }));
          }, 400);
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_messages" }, (payload) => {
        const r = payload.new as { id: string; deleted_at: string | null };
        setMessages((prev) => prev.map((m) => (m.id === r.id ? { ...m, deletedAt: r.deleted_at } : m)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_reactions" }, (payload) => {
        const r = payload.new as { message_id: string; user_id: string; emoji: string };
        setReactions((prev) => (prev.some((x) => x.messageId === r.message_id && x.userId === r.user_id && x.emoji === r.emoji) ? prev : [...prev, { messageId: r.message_id, userId: r.user_id, emoji: r.emoji }]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_reactions" }, (payload) => {
        const r = payload.old as { message_id?: string; user_id?: string; emoji?: string };
        if (!r.message_id) return;
        setReactions((prev) => prev.filter((x) => !(x.messageId === r.message_id && x.userId === r.user_id && x.emoji === r.emoji)));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_poll_votes" }, (payload) => {
        const r = (payload.new ?? payload.old) as { poll_id: string; user_id: string; option_id?: string };
        if (!r.poll_id) return;
        setVotes((prev) => {
          const rest = prev.filter((v) => !(v.pollId === r.poll_id && v.userId === r.user_id));
          return payload.eventType === "DELETE" || !r.option_id ? rest : [...rest, { pollId: r.poll_id, userId: r.user_id, optionId: r.option_id }];
        });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ensureProfiles, messageById]);

  // ── Actions ──
  const resetComposer = () => {
    setText("");
    setPickedLocation(null);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setReplyTo(null);
    setMode("text");
  };

  const submit = async () => {
    if (!userId) return setError("Connectez-vous pour écrire.");
    setError(null);
    setBusy(true);
    try {
      if (mode === "poll") {
        const r = await createPoll({ userId, question: pollQuestion, options: pollOptions, minutes: pollMinutes, replyTo: replyTo?.id ?? null });
        if (r.error) return setError(r.error);
      } else {
        if (mode === "location" && !pickedLocation) return setError("Choisissez un lieu à partager.");
        if (mode === "text" && !text.trim()) return;
        const r = await sendMessage({ userId, content: text, replyTo: replyTo?.id ?? null, locationSlug: mode === "location" ? pickedLocation?.slug : null });
        if (r.error) return setError(r.error);
      }
      resetComposer();
      followOwnMessage.current = true;
      setAtBottom(true);
    } finally {
      setBusy(false);
    }
  };

  const react = async (message: ChatMessage, emoji: string) => {
    if (!userId) return setError("Connectez-vous pour réagir.");
    const active = reactions.some((r) => r.messageId === message.id && r.userId === userId && r.emoji === emoji);
    // Optimiste : le temps réel confirme ensuite.
    setReactions((prev) => (active ? prev.filter((r) => !(r.messageId === message.id && r.userId === userId && r.emoji === emoji)) : [...prev, { messageId: message.id, userId, emoji }]));
    const r = await toggleReaction({ messageId: message.id, userId, emoji, active });
    if (r.error) setError(r.error);
  };

  const vote = async (poll: ChatPoll, optionId: string) => {
    if (!userId) return;
    setVotes((prev) => [...prev.filter((v) => !(v.pollId === poll.messageId && v.userId === userId)), { pollId: poll.messageId, userId, optionId }]);
    const r = await votePoll({ pollId: poll.messageId, userId, optionId });
    if (r.error) setError(r.error);
  };

  // La confirmation est demandée dans la ligne du message (cf. `MessageItem`).
  const remove = async (message: ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, deletedAt: new Date().toISOString() } : m)));
    const r = await deleteMessage(message.id);
    if (r.error) setError(r.error);
  };

  const canSubmit = mode === "poll" ? pollQuestion.trim().length > 1 && pollOptions.filter((o) => o.trim()).length >= 2 : mode === "location" ? !!pickedLocation : text.trim().length > 0;

  // Le champ reste ouvert tant qu'il a quelque chose à montrer : une réponse en
  // cours, un lieu à partager, un sondage en préparation. Et il l'est aussi
  // quand il ne sert qu'à afficher un message (base absente, non connecté).
  const composerWide = !auth.enabled || !userId || expanded || mode !== "text" || !!replyTo || !!pickedLocation;

  const openComposer = () => setExpanded(true);

  /** Refermé seulement si le focus quitte vraiment le bloc, et qu'il est vide. */
  const handleComposerBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (composerRef.current?.contains(e.relatedTarget as Node | null)) return;
    if (!text.trim() && !replyTo && !pickedLocation && mode === "text") setExpanded(false);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Liste */}
      <div
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
        }}
        // Le champ de saisie flotte au-dessus du fil : sans cette réserve en
        // pied, le dernier message se cacherait derrière lui.
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-36 pt-4 sm:px-4"
      >
        {visible.length === 0 && <p className="py-20 text-center text-sm text-muted">Personne n&apos;a encore parlé. Lancez la conversation !</p>}
        <div ref={contentRef} className="mx-auto flex max-w-3xl flex-col gap-3">
          {visible.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              profile={profiles[m.userId]}
              quoted={m.replyTo ? messageById.get(m.replyTo) : undefined}
              quotedProfile={m.replyTo ? profiles[messageById.get(m.replyTo)?.userId ?? ""] : undefined}
              reactions={reactions.filter((r) => r.messageId === m.id)}
              poll={polls[m.id]}
              votes={votes.filter((v) => v.pollId === m.id)}
              location={m.locationSlug ? locationBySlug.get(m.locationSlug) : undefined}
              category={m.locationSlug ? categories.get(locationBySlug.get(m.locationSlug)?.categorySlug ?? "") : undefined}
              userId={userId}
              onReply={() => {
                setReplyTo(m);
                textareaRef.current?.focus();
              }}
              onReact={(emoji) => react(m, emoji)}
              onVote={(optionId) => polls[m.id] && vote(polls[m.id], optionId)}
              onDelete={() => remove(m)}
            />
          ))}
        </div>
      </div>


      {/* Flotte juste au-dessus du champ de saisie. */}
      {!atBottom && (
        <button
          type="button"
          onClick={() => {
            setAtBottom(true);
            scrollToBottom();
          }}
          className="rs-pill absolute bottom-28 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-1 px-3 py-1.5 text-xs font-semibold cursor-pointer"
        >
          <ChevronDown className="h-3.5 w-3.5" /> Nouveaux messages
        </button>
      )}

      {/* ── Champ de saisie ──────────────────────────────────────────────────
          D'après `easemize/ai-chat-input` (21st.dev) : une pilule compacte qui
          s'ouvre en champ complet, et se referme quand on la quitte à vide.
          Tout l'appareillage d'assistant — choix du modèle, niveau d'effort,
          micro, pièces jointes — est écarté : ici on écrit à d'autres joueurs.

          Il flotte au-dessus du fil au lieu de le fermer par un bandeau : le
          décor continue derrière, et la conversation garde toute la hauteur. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-5 sm:px-4">
        <div
          className="pointer-events-auto mx-auto w-full"
          style={{ maxWidth: composerWide ? 768 : 380, transition: COMPOSER_SPRING }}
        >
          {!auth.enabled ? (
            <p className="rs-card rounded-3xl px-4 py-3 text-sm text-muted">
              Le chat nécessite la base de données (Supabase non configuré).
            </p>
          ) : !userId ? (
            <div className="rs-card flex flex-wrap items-center justify-between gap-3 rounded-3xl px-4 py-3 text-sm">
              <span className="text-muted">Connectez-vous pour participer à la conversation.</span>
              <Link href="/auth?next=%2Fcommunity" className="rs-pill rs-pill--accent px-4 py-2 font-semibold">
                Connexion
              </Link>
            </div>
          ) : (
            /* Un seul niveau de carte : la réponse en cours et le lieu à
               partager sont des rangées séparées par un filet, pas des cartes
               posées dans celle-ci. */
            <div ref={composerRef} onBlur={handleComposerBlur} className="rs-card overflow-hidden rounded-[26px]">
              {replyTo && (
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 text-xs animate-fade-in">
                  <CornerDownLeft className="h-3 w-3 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1 truncate">
                    Réponse à <span className="font-semibold">{profiles[replyTo.userId]?.displayName ?? "Joueur"}</span> ·{" "}
                    {replyTo.kind === "poll" ? replyTo.content : replyTo.content || "lieu partagé"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="text-muted hover:text-foreground cursor-pointer"
                    aria-label="Annuler la réponse"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {mode === "location" && pickedLocation && (
                <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2 text-sm animate-fade-in">
                  {pickedLocation.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pickedLocation.image} alt="" className="h-10 w-14 shrink-0 rounded-md object-cover" />
                  ) : (
                    <MapPin className="h-4 w-4 text-accent" />
                  )}
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-pale">Lieu à partager</span>
                    <br />
                    <span className="font-semibold">{pickedLocation.name}</span>
                    {pickedLocation.area ? <span className="text-muted"> · {pickedLocation.area}</span> : null}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPickedLocation(null);
                      setMode("text");
                    }}
                    className="text-muted hover:text-foreground cursor-pointer"
                    aria-label="Annuler le partage"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {mode === "poll" ? (
                <div className="flex flex-col gap-2 p-3">
                  <input
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    maxLength={200}
                    placeholder="Question du sondage"
                    className="h-10 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none placeholder:text-muted focus:border-accent"
                  />
                  {pollOptions.map((o, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={o}
                        onChange={(e) => setPollOptions((opts) => opts.map((x, j) => (j === i ? e.target.value : x)))}
                        maxLength={80}
                        placeholder={`Option ${i + 1}`}
                        className="h-9 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm outline-none placeholder:text-muted focus:border-accent"
                      />
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setPollOptions((opts) => opts.filter((_, j) => j !== i))}
                          className="grid h-9 w-9 place-items-center rounded-full text-muted hover:text-foreground cursor-pointer"
                          aria-label="Retirer l'option"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {pollOptions.length < 6 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions((o) => [...o, ""])}
                        className="rs-pill inline-flex items-center gap-1 px-3 py-1.5 font-semibold cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" /> Option
                      </button>
                    )}
                    <span className="ml-auto text-muted">Durée</span>
                    <select
                      value={pollMinutes}
                      onChange={(e) => setPollMinutes(Number(e.target.value))}
                      className="h-8 rounded-full border border-white/10 bg-black/30 px-3 text-xs outline-none cursor-pointer"
                    >
                      {POLL_DURATIONS.map((d) => (
                        <option key={d.minutes} value={d.minutes}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  {/* Replié, c'est ce bouton qu'on voit et qu'on clique. Le champ
                      est bien là dessous, mais son texte d'invite est effacé —
                      deux invites superposées pendant l'ouverture bavaient. */}
                  <button
                    type="button"
                    onClick={openComposer}
                    aria-label="Écrire un message"
                    className={cn(
                      "absolute inset-0 z-[1] flex items-center px-4 text-left text-sm font-medium text-muted transition-all duration-300 cursor-text",
                      expanded ? "pointer-events-none translate-y-1 opacity-0" : "translate-y-0 opacity-100",
                    )}
                  >
                    {mode === "location" ? "Un mot sur ce lieu ?" : "Écrire un message…"}
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onFocus={openComposer}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submit();
                      }
                    }}
                    maxLength={1000}
                    rows={1}
                    placeholder={mode === "location" ? "Un mot sur ce lieu ? (optionnel)" : "Écrire un message…"}
                    className={cn(
                      "block w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-[22px] outline-none",
                      expanded ? "placeholder:text-muted" : "placeholder:text-transparent",
                    )}
                  />
                </div>
              )}

              {error && (
                <p role="alert" className="px-4 pb-1 text-xs text-accent-pale">
                  {error}
                </p>
              )}

              {/* Les actions n'existent qu'une fois ouvert : repliée, la pilule
                  ne montre que l'invite. `h-0` et non `hidden` — la hauteur doit
                  se transitionner avec le reste. */}
              <div
                className={cn(
                  "flex items-center gap-2 overflow-hidden px-3 transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
                  composerWide ? "h-12 pb-3 opacity-100 blur-0" : "pointer-events-none h-0 pb-0 opacity-0 blur-sm",
                )}
              >
                {/* Le choix du lieu se fait sur la carte (mode partage) : chaque fiche a « Partager dans le chat ». */}
                <button
                  type="button"
                  onClick={() => router.push("/map?share=1")}
                  className={cn(
                    "rs-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer",
                    mode === "location" && "rs-pill--accent",
                  )}
                >
                  <MapPin className="h-3.5 w-3.5" /> {mode === "location" && pickedLocation ? "Changer de lieu" : "Partager un lieu"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode(mode === "poll" ? "text" : "poll")}
                  className={cn(
                    "rs-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer",
                    mode === "poll" && "rs-pill--accent",
                  )}
                >
                  <Trophy className="h-3.5 w-3.5" /> Sondage
                </button>
                <span className="ml-auto vi-num text-[11px] text-muted">{mode === "text" ? `${text.length}/1000` : ""}</span>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy || !canSubmit}
                  aria-label={mode === "poll" ? "Lancer le sondage" : "Envoyer"}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-accent text-sm font-bold text-white transition-all disabled:opacity-40 cursor-pointer",
                    mode === "poll" ? "px-4" : "w-9 justify-center",
                  )}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "poll" ? "Lancer le sondage" : /* Le jeu d icônes n a pas de flèche vers le haut, et en ajouter une
                       demanderait de regénérer tout le lot : celle de droite, pivotée. */
                    <ArrowRight aria-hidden className="h-4 w-4 -rotate-90" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
