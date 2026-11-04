/**
 * Poda del MVP de Auton.
 *
 * Mientras Auton no venda plugins, no programe tareas desde la app, no use
 * cuentas/facturación ni controle equipos remotos, estas superficies no deben
 * aparecer. La bandera deja el código intacto para poder restaurarlo con un
 * cambio de una línea; la eliminación definitiva va después de verificar que
 * la app abre y el chat funciona.
 */
export const AUTON_MVP = true;

/** Secciones de ajustes que no forman parte del producto que se presenta. */
export const AUTON_MVP_HIDDEN_SETTINGS_SECTIONS = [
  "automations",
  "plugin",
  "remoteDevices",
  "memory",
  "usage",
  "computerUse",
] as const;
