import { describe, expect, it } from "vitest";
import { isAutonRoute } from "../src/auton/project-space/autonRoute.js";

describe("entrada de Auton en Root", () => {
  it("sin query arranca en el home normal de ZCode", () => {
    expect(isAutonRoute("")).toBe(false);
    expect(isAutonRoute("?auton=zcode")).toBe(false);
  });

  it("?auton=projects abre la lista de proyectos", () => {
    expect(isAutonRoute("?auton=projects")).toBe(true);
  });
});
