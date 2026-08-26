import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Primitives de message, reprises telles quelles du registre shadcn
 * (21st.dev, `shadcn/message`).
 *
 * Le paquet ne fournit aucune apparence : ce sont des conteneurs nus qui posent
 * la structure d'un fil de discussion — un groupe, un message aligné à gauche ou
 * à droite, un avatar collé au bas de la bulle, un en-tête, un corps, un pied.
 * Tout le reste (fond des bulles, couleurs, espacements) est habillé à l'appel,
 * dans notre charte.
 *
 * Les classes `cn-message-*` sont les accroches de thème de shadcn. Aucune règle
 * ne les définit chez nous, mais elles sont conservées pour que le composant
 * reste interchangeable avec celui d'origine.
 */
function MessageGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-group" className={cn("cn-message-group flex min-w-0 flex-col", className)} {...props} />;
}

function Message({ className, align = "start", ...props }: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn("cn-message group/message relative flex w-full min-w-0 data-[align=end]:flex-row-reverse", className)}
      {...props}
    />
  );
}

function MessageAvatar({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-avatar"
      className={cn("cn-message-avatar flex w-fit shrink-0 items-center justify-center self-end overflow-hidden rounded-full bg-surface-2", className)}
      {...props}
    />
  );
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-content" className={cn("cn-message-content flex w-full min-w-0 flex-col wrap-break-word", className)} {...props} />;
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="message-header" className={cn("cn-message-header flex max-w-full min-w-0 items-center", className)} {...props} />;
}

function MessageFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-footer"
      className={cn("cn-message-footer flex max-w-full min-w-0 items-center group-data-[align=end]/message:justify-end", className)}
      {...props}
    />
  );
}

export { MessageGroup, Message, MessageAvatar, MessageContent, MessageFooter, MessageHeader };
