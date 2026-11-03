/**
 * Decisión de entrada de la app. Función pura para probar la rama real de
 * `Root` sin montar el shell completo.
 */
export function isAutonRoute(search: string): boolean {
  return new URLSearchParams(search).get("auton") === "projects";
}
