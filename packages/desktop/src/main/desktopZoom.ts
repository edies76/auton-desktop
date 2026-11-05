export const DESKTOP_ZOOM_MIN_LEVEL = -3;
export const DESKTOP_ZOOM_MAX_LEVEL = 5;
// Poda Auton (reversible): la app abre un paso de zoom por encima del
// nivel neutro de ZCode. Volver a 0 restaura el tamaño anterior.
export const DESKTOP_ZOOM_DEFAULT_LEVEL = 1;
export const DESKTOP_ZOOM_FACTOR_STEP = 1.1;

export function clampDesktopZoomLevel(level: number) {
  return Math.min(DESKTOP_ZOOM_MAX_LEVEL, Math.max(DESKTOP_ZOOM_MIN_LEVEL, level));
}

export function resolveDesktopZoomFactorForLevel(level: number) {
  return Math.pow(DESKTOP_ZOOM_FACTOR_STEP, clampDesktopZoomLevel(level));
}

export function resolveDesktopZoomLevelFromFactor(zoomFactor: number) {
  if (!Number.isFinite(zoomFactor) || zoomFactor <= 0) {
    return 0;
  }

  return clampDesktopZoomLevel(
    Math.round(Math.log(zoomFactor) / Math.log(DESKTOP_ZOOM_FACTOR_STEP)),
  );
}
