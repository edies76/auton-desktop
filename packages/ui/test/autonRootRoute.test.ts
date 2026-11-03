import { describe, expect, it } from "vitest";
import { isAutonRoute } from "../src/auton/project-space/autonRoute.js";

describe("entrada de Auton en Root", () => {
  it("sin query y con ?auton=projects entra a la lista", () => {
    expect(isAutonRoute("")).toBe(true);
    expect(isAutonRoute("?auton=projects")).toBe(true);
  });

  it("?auton=zcode conserva el shell de ZCode", () => {
    expect(isAutonRoute("?auton=zcode")).toBe(false);
  });
});
