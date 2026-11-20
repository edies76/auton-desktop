// ============================================================
// Canales de notificación del orquestador
// ============================================================
// Dos entradas reales del producto: mensajes de workers/subagentes y avisos de
// agentes externos/otras sesiones. Un mensaje entrante NO se inyecta como
// mensaje del humano ni abre un turno: queda encolado como notificación con su
// canal, origen, hora y estado de lectura. El orquestador decide leer con una
// operación explícita; solo esa operación marca leído.

export const AUTON_CHANNELS = ["worker", "external"] as const;
export type AutonChannel = (typeof AUTON_CHANNELS)[number];

export interface AutonNotificationInput {
  channel: AutonChannel;
  /** Quién lo mandó: agente, sesión o tarea. */
  origin: string;
  text: string;
  at?: number;
  meta?: Readonly<Record<string, string>>;
}

export interface AutonNotification {
  id: string;
  channel: AutonChannel;
  origin: string;
  text: string;
  at: number;
  readAt?: number;
  meta?: Readonly<Record<string, string>>;
}

export interface AutonChannelSummary {
  channel: AutonChannel;
  unread: number;
  total: number;
}

export interface AutonNotificationRegistry {
  enqueue(input: AutonNotificationInput): AutonNotification;
  list(channel?: AutonChannel): readonly AutonNotification[];
  unread(channel?: AutonChannel): readonly AutonNotification[];
  /** Lectura explícita: devuelve y marca leído. Sin canal, lee los dos. */
  read(channel?: AutonChannel): readonly AutonNotification[];
  summaries(): readonly AutonChannelSummary[];
  subscribe(listener: (snapshot: readonly AutonNotification[]) => void): () => void;
}

export function channelLabel(channel: AutonChannel): string {
  return channel === "worker" ? "Workers" : "Agentes externos";
}

export function isAutonChannel(value: unknown): value is AutonChannel {
  return value === "worker" || value === "external";
}

let notificationSequence = 0;

function nextNotificationId(): string {
  notificationSequence += 1;
  return `auton-notification-${notificationSequence}`;
}

/** Reductor puro: agrega sin mutar la lista. */
export function enqueueNotification(
  list: readonly AutonNotification[],
  input: AutonNotificationInput,
  now: number,
  idFactory: () => string = nextNotificationId,
): readonly AutonNotification[] {
  const notification: AutonNotification = {
    id: idFactory(),
    channel: input.channel,
    origin: input.origin,
    text: input.text,
    at: input.at ?? now,
    ...(input.meta ? { meta: input.meta } : {}),
  };
  return [...list, notification];
}

/** Reductor puro: marca leídas las que correspondan al canal y las devuelve. */
export function readNotifications(
  list: readonly AutonNotification[],
  channel: AutonChannel | undefined,
  now: number,
): { list: readonly AutonNotification[]; read: readonly AutonNotification[] } {
  const read: AutonNotification[] = [];
  const next = list.map((notification) => {
    if (notification.readAt !== undefined) return notification;
    if (channel !== undefined && notification.channel !== channel) return notification;
    const updated: AutonNotification = { ...notification, readAt: now };
    read.push(updated);
    return updated;
  });
  return { list: next, read };
}

export function summarizeNotifications(
  list: readonly AutonNotification[],
): readonly AutonChannelSummary[] {
  return AUTON_CHANNELS.map((channel) => {
    const own = list.filter((notification) => notification.channel === channel);
    return {
      channel,
      unread: own.filter((notification) => notification.readAt === undefined).length,
      total: own.length,
    };
  });
}

export function createAutonNotificationRegistry(options?: {
  now?: () => number;
  idFactory?: () => string;
}): AutonNotificationRegistry {
  const now = options?.now ?? (() => Date.now());
  const idFactory = options?.idFactory ?? nextNotificationId;
  let list: readonly AutonNotification[] = [];
  const listeners = new Set<(snapshot: readonly AutonNotification[]) => void>();

  const emit = () => {
    for (const listener of listeners) listener(list);
  };
  const byChannel = (channel?: AutonChannel) =>
    channel === undefined ? list : list.filter((notification) => notification.channel === channel);

  return {
    enqueue(input) {
      list = enqueueNotification(list, input, now(), idFactory);
      emit();
      return list[list.length - 1]!;
    },
    list: byChannel,
    unread(channel) {
      return byChannel(channel).filter((notification) => notification.readAt === undefined);
    },
    read(channel) {
      const result = readNotifications(list, channel, now());
      list = result.list;
      if (result.read.length > 0) emit();
      return result.read;
    },
    summaries() {
      return summarizeNotifications(list);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const registries = new Map<string, AutonNotificationRegistry>();

/** Registro por sesión: las dos rutas y la lectura comparten esta instancia. */
export function autonNotificationRegistryFor(sessionId: string): AutonNotificationRegistry {
  const key = sessionId || "default";
  const existing = registries.get(key);
  if (existing) return existing;
  const created = createAutonNotificationRegistry();
  registries.set(key, created);
  return created;
}
