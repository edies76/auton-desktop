import { useMemo, useState } from "react";
import { BotIcon, BoxesIcon, ChevronDown } from "lucide-react";
import {
  AUTON_CHANNELS,
  channelLabel,
  summarizeNotifications,
  type AutonChannel,
  type AutonNotification,
} from "@zcode/shared/auton-notifications";
import { cn } from "@/components/lib/utils.js";

export interface NotificationChannelsPanelProps {
  notifications: readonly AutonNotification[];
  now?: () => number;
  className?: string;
}

/**
 * El texto de los avisos externos llega como envoltorio de tarea
 * (`<task-notification><summary>…`). Para la fila se muestra el hecho legible
 * —el `<summary>` si existe— y el texto crudo queda solo en el tooltip.
 */
export function notificationDisplayText(text: string): string {
  const raw = (text ?? "").trim();
  if (raw === "") return "";
  if (raw.includes("<task-notification>")) {
    const summary = /<summary>([\s\S]*?)<\/summary>/u.exec(raw)?.[1]?.trim();
    if (summary) return decodeEntities(summary);
  }
  const withoutTags = raw
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return decodeEntities(withoutTags);
}

function decodeEntities(value: string): string {
  let decoded = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded
      .replace(/&lt;/gu, "<")
      .replace(/&gt;/gu, ">")
      .replace(/&quot;/gu, '"')
      .replace(/&apos;/gu, "'")
      .replace(/&amp;/gu, "&");
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

export function formatNotificationClock(at: number): string {
  if (!Number.isFinite(at)) return "";
  const date = new Date(at);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function channelIcon(channel: AutonChannel) {
  return channel === "worker" ? BotIcon : BoxesIcon;
}

/**
 * Cola de los dos canales del orquestador dentro del dock de la conversación.
 * Misma receta que el resto de superficies: `rounded-xl border border-border
 * bg-card`, cabeceras en `foreground-subtlest` y filas de 28px como el panel de
 * workers. Los avisos se pintan aquí; el hilo no los duplica.
 */
export function NotificationChannelsPanel({
  notifications,
  now = Date.now,
  className,
}: NotificationChannelsPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const summaries = useMemo(
    () => new Map(summarizeNotifications(notifications).map((item) => [item.channel, item])),
    [notifications],
  );
  const totalUnread = AUTON_CHANNELS.reduce(
    (total, channel) => total + (summaries.get(channel)?.unread ?? 0),
    0,
  );

  return (
    <section
      data-testid="auton-notification-channels"
      className={cn("mb-3 w-full px-4 max-md:px-2", className)}
    >
      <div className="w-full overflow-hidden rounded-xl border border-border bg-card">
        <button
          type="button"
          data-testid="auton-notification-channels-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full min-w-0 items-center gap-1.5 px-3 py-2 text-left text-ui-base font-medium text-foreground-subtle transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-input-border-focused"
        >
          <ChevronDown
            className={cn("size-3.5 shrink-0 transition-transform", !expanded && "-rotate-90")}
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate">Canales del orquestador</span>
          <span
            className={cn(
              "shrink-0 text-ui-sm tabular-nums",
              totalUnread > 0 ? "text-foreground" : "text-foreground-subtlest",
            )}
            data-testid="auton-notification-channels-unread"
          >
            {totalUnread}
          </span>
        </button>
        {expanded ? (
          <div className="flex max-h-64 min-h-0 w-full flex-col gap-1 overflow-y-auto border-t border-border p-2">
            {AUTON_CHANNELS.map((channel) => {
              const rows = notifications.filter((item) => item.channel === channel);
              const unread = summaries.get(channel)?.unread ?? 0;
              const Icon = channelIcon(channel);
              return (
                <section key={channel} className="min-w-0" data-testid={`auton-channel-${channel}`}>
                  <header className="flex min-w-0 items-center justify-between gap-2 px-1.5 pb-0.5 pt-1">
                    <span className="min-w-0 truncate text-ui-sm font-medium text-foreground-subtle">
                      {channelLabel(channel)}
                    </span>
                    <span
                      data-testid={`auton-channel-unread-${channel}`}
                      data-unread={unread}
                      className={cn(
                        "shrink-0 text-ui-sm tabular-nums",
                        unread > 0 ? "text-foreground" : "text-foreground-subtlest",
                      )}
                    >
                      {unread}
                    </span>
                  </header>
                  {rows.length === 0 ? (
                    <p className="px-3 py-1 text-ui-sm text-foreground-subtlest">Sin avisos</p>
                  ) : (
                    <ul className="flex min-w-0 flex-col" data-testid={`auton-channel-list-${channel}`}>
                      {rows.map((notification) => {
                        const isUnread = notification.readAt === undefined;
                        const displayText = notificationDisplayText(notification.text);
                        return (
                          <li
                            key={notification.id}
                            data-testid={`auton-notification-${notification.id}`}
                            data-read={isUnread ? "false" : "true"}
                            className="flex min-h-7 w-full min-w-0 items-center gap-2 rounded-lg border border-transparent py-1 pl-2.5 pr-2"
                          >
                            <Icon
                              aria-hidden="true"
                              className={cn(
                                "size-3.5 shrink-0",
                                isUnread ? "text-foreground-subtle" : "text-foreground-subtlest",
                              )}
                            />
                            <span
                              className="min-w-0 flex-1 truncate text-ui-base text-foreground"
                              title={notification.text}
                            >
                              {displayText === "" ? "…" : displayText}
                            </span>
                            <span className="shrink-0 text-ui-xs text-foreground-subtle">
                              {notification.origin}
                            </span>
                            <span className="shrink-0 text-ui-xs tabular-nums text-foreground-subtlest">
                              {formatNotificationClock(notification.at)}
                            </span>
                            <span
                              className={cn(
                                "w-10 shrink-0 text-right text-ui-xs",
                                isUnread
                                  ? "font-medium text-foreground"
                                  : "text-foreground-subtlest",
                              )}
                            >
                              {isUnread ? "nuevo" : "leído"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
