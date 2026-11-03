import { WakeEventRow, type WakeEventRowProps } from "./WakeEventRow.js";

/**
 * Fila despertadora tal como la pinta el hilo: el mapeo de filas produce el
 * evento y este componente lo dibuja. Es la pieza que usa `ConversationTurnGroup`,
 * no un componente suelto.
 */
export function WakeEventItem({
  event,
  onAction,
}: {
  event: WakeEventRowProps;
  onAction?: () => void;
}) {
  return <WakeEventRow {...event} {...(onAction ? { onAction } : {})} />;
}
