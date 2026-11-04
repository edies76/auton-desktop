import { cn } from "@/components/lib/utils.js";

/**
 * Nombre histórico del módulo; el dibujo ya es la marca de Auton.
 * Queda como alias de `AutonLogo` para no romper imports del upstream.
 */
export function ZCodeAboutLogo({ className }: { className?: string }) {
  return <AutonLogo className={className} />;
}

/**
 * Nombre histórico; la firma dibujada dice AUTON con la A de la marca.
 * Sin uso actual en la UI: queda por compatibilidad de imports.
 */
export function ZCodeWordmarkLogo({ className }: { className?: string }) {
  return (
    <svg
      width="244"
      height="54"
      viewBox="0 0 244 54"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(0 3) scale(0.75)">
        <circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeWidth="5" />
        <path
          d="M20 45 L32 17 L44 45"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="25" y1="37" x2="39" y2="37" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      </g>
      <text x="62" y="38" fill="currentColor" fontSize="30" fontWeight="600" letterSpacing="6">
        AUTON
      </text>
    </svg>
  );
}

/**
 * Marca de Auton: la A dentro del círculo, la misma geometría que ya usan
 * los logos del proveedor Auton. Dibuja en `currentColor` para seguir el
 * tema; cuando exista un archivo de logo definitivo, este es el único
 * componente que hay que cambiar.
 */
export function AutonLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={cn("shrink-0 text-current", className)}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" strokeWidth="5" />
      <path
        d="M20 45 L32 17 L44 45"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="25" y1="37" x2="39" y2="37" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
