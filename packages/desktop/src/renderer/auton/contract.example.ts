/**
 * desktop-auton-entry 标准调用示例。
 */
import type { DesktopAutonEntryContract } from "./contract.js";

export function exampleDesktopAutonEntry(contract: DesktopAutonEntryContract): void {
  const container = document.createElement("div");
  contract.mount(container);
}
