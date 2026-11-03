import { useEffect, useState } from "react";

/**
 * Reloj de la superficie: corre cada segundo para que los workers vivos no se
 * queden congelados. En pruebas se inyecta un valor fijo.
 */
export function useAutonClock(injected?: number): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (injected !== undefined) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [injected]);
  return injected ?? tick;
}
