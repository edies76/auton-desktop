/**
 * desktop-auton-entry 对外契约：lo único que el renderer necesita saber para
 * montar la superficie de Auton.
 */
export interface DesktopAutonEntryContract {
  /**
   * Monta la superficie en el contenedor dado.
   * Precondición: el contenedor existe en el DOM y está vacío.
   * Postcondición: la app de Auton queda renderizada; llamarlo dos veces sobre
   * el mismo contenedor es un error del llamador.
   */
  mount(container: HTMLElement): void;
}
