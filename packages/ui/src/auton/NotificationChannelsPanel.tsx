// ============================================================
// Canales de notificación del orquestador (UI)
// ============================================================
// Dos canales de entrada que llegan como notificaciones encoladas: mensajes de
// workers y avisos de agentes externos/otras sesiones. El orquestador decide
// cuándo leerlos; aquí se ven el contador de no leídas y el detalle, y las filas
// pasan a leído cuando la operación real de lectura las marca.

import {
  AUTON_CHANNELS,
  channelLabel,
  summarizeNotifications,
  type AutonChannel,
  type AutonNotification,
} from "@zcode/shared/auton-notifications";

export interface NotificationChannelsPanelProps {
  notifications: readonly AutonNotification[];
  className?: string;
}

function stateLabel(notification: AutonNotification): string {
  return notification.readAt === undefined ? "nuevo" : "leído";
}

export function NotificationChannelsPanel({
  notifications,
  className,
}: NotificationChannelsPanelProps) {
  const summaries = summarizeNotifications(notifications);
  return (
    <section
      data-testid="auton-notification-channels"
      className={
        "flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-2 text-ui-sm text-foreground-subtle " +
        (className ?? "")
      }
    >
      {AUTON_CHANNELS.map((channel: AutonChannel) => {
        const summary = summaries.find((item) => item.channel === channel);
        const rows = notifications.filter((notification) => notification.channel === channel);
        return (
          <div key={channel} className="flex min-w-0 flex-col gap-1">
            <header className="flex min-w-0 items-center justify-between gap-2">
              <span className="font-medium text-foreground">{channelLabel(channel)}</span>
              <span
                data-testid={`auton-channel-unread-${channel}`}
                data-unread={summary?.unread ?? 0}
                className="rounded-full border border-border px-1.5 py-0.5 text-ui-xs"
              >
                {summary?.unread ?? 0}
              </span>
            </header>
            <ul className="flex min-w-0 flex-col gap-1" data-testid={`auton-channel-list-${channel}`}>
              {rows.length === 0 ? (
                <li className="text-ui-xs text-foreground-subtlest">Sin avisos</li>
              ) : (
                rows.map((notification) => (
                  <li
                    key={notification.id}
                    data-testid={`auton-notification-${notification.id}`}
                    data-read={notification.readAt === undefined ? "false" : "true"}
                    className="flex min-w-0 items-baseline gap-2"
                  >
                    <span className="shrink-0 text-ui-xs text-foreground-subtlest">
                      {notification.origin}
                    </span>
                    <span className="min-w-0 truncate text-foreground">{notification.text}</span>
                    <span className="shrink-0 text-ui-xs">{stateLabel(notification)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
