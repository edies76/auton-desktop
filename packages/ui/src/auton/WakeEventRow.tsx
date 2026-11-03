import { Activity, CheckCircle2, MessageCircleQuestion } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Fila de un evento que despierta al orquestador sin ser un mensaje del humano:
 * una pregunta de un programador, un cierre o el latido de estado.
 *
 * Va centrada en el hilo y con el mismo lenguaje visual que el resto: borde,
 * fondo secundario y tipografía de la app. No es un mensaje de usuario ni una
 * tarjeta de tool: es la crónica del trabajo por debajo.
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

// Mismo lenguaje visual que el resto del hilo: borde, fondo secundario y texto
// de la app. El tipo se distingue por el icono, no por un color nuevo.
const ROW_TONE = "border-border bg-secondary/40 text-foreground-subtle";

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
    <div className="my-2 flex w-full justify-center" data-testid="auton-wake-event" data-kind={kind}>
      <div
        className={`flex max-w-[85%] min-w-0 items-center gap-2 rounded-full border px-3 py-1.5 text-ui-sm ${ROW_TONE}`}
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
            className="shrink-0 rounded-full border border-border px-2 py-0.5 text-ui-xs text-foreground-subtle transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-border-focused"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
