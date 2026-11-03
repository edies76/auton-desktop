import { describe, expect, it } from "vitest";

import { desktopAutonEntryModule } from "./module.js";

describe("desktop-auton-entry contract", () => {
  it("declares its module manifest", () => {
    expect(desktopAutonEntryModule.id).toBe("desktop-auton-entry");
    expect(desktopAutonEntryModule.requires).toContain("ui-auton");
  });
});
