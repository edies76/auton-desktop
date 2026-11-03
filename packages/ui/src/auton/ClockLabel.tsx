import { cn } from "@/components/lib/utils.js";
import { formatElapsed } from "./subagentChannel.js";
import { silenceMs } from "./clocks.js";

export interface ClockLabelProps {
  elapsedMs: number | null;
  lastSignalAt?: number | null;
  now?: number;
  silentAfterMs?: number;
  className?: string;
}

/**
 * Reloj presentacional: MM:SS o --:--, más aviso de silencio.
 * Sin estado propio: todo entra por props (datos del registro cuando exista).
 */
export function ClockLabel({
  elapsedMs,
  lastSignalAt = null,
  now,
  silentAfterMs = 30_000,
  className,
}: ClockLabelProps) {
  const label = elapsedMs === null ? "--:--" : formatElapsed(elapsedMs);
  const silence =
    lastSignalAt !== null && now !== undefined ? silenceMs(lastSignalAt, now) : null;
  const silent = silence !== null && silence > silentAfterMs;
  const silenceSecs = silent ? Math.floor(silence! / 1000) : 0;

  return (
    <span className={cn("shrink-0 tabular-nums text-foreground-subtle", className)}>
      {label}
      {silent ? <span> · sin señales hace {silenceSecs}s</span> : null}
    </span>
  );
}
