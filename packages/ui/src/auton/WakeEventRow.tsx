import { Activity, CheckCircle2, MessageCircleQuestion } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Fila de un evento que despierta al orquestador sin ser un mensaje del humano:
 * un aviso de un worker, un cierre o el latido de estado.
 *
 * Se pinta como una fila más del trabajo, con la tipografía y el espaciado de
 * ZCode. No es un mensaje de usuario ni una tarjeta de tool: es la crónica del
 * trabajo por debajo.
 */
export type WakeEventKind = "question" | "closed" | "heartbeat";

export interface WakeEventRowProps {
  kind: WakeEventKind;
  /** Qué pasó, en una línea. */
  title: string;
  /** Detalle opcional: el motivo, el resultado, el tiempo. */
  detail?: string;
  /** Quién lo provoca (nombre del programador), si aplica. */
  workerName?: string;
  /** Marca de tiempo ya formateada. */
  at?: string;
  /** Acción explícita: "Responder", "Abrir", etc. */
  actionLabel?: string;
  onAction?: () => void;
}

const KIND_ICONS: Record<WakeEventKind, ReactNode> = {
  question: <MessageCircleQuestion className="size-3.5 shrink-0" />,
  closed: <CheckCircle2 className="size-3.5 shrink-0" />,
  heartbeat: <Activity className="size-3.5 shrink-0" />,
};

export function WakeEventRow({
  kind,
  title,
  detail,
  workerName,
  at,
  actionLabel,
  onAction,
}: WakeEventRowProps) {
  const icon = KIND_ICONS[kind];

  return (
    <div
      className="flex min-w-0 items-center gap-2 py-1 text-ui-sm text-foreground-subtle"
      data-testid="auton-wake-event"
      data-kind={kind}
    >
      {icon}
      {workerName ? (
        <span className="shrink-0 font-medium text-foreground">{workerName}</span>
      ) : null}
      <span className="min-w-0 truncate text-foreground">{title}</span>
      {detail ? (
        <span className="min-w-0 truncate text-foreground-subtle">· {detail}</span>
      ) : null}
      {at ? <span className="shrink-0 text-foreground-subtlest">{at}</span> : null}
      {onAction && actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-md px-1.5 py-0.5 text-ui-xs text-foreground-subtle transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-border-focused"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
