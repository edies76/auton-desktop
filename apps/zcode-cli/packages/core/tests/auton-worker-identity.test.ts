import { describe, expect, it } from "vitest";
import { childAgentName } from "../src/subagent/worker-policy.js";

describe("auton worker identity", () => {
  it("los programmers auton se presentan como auton, no zcode", () => {
    expect(childAgentName("auton-worker")).toBe("auton-auton-worker");
  });

  it("los demas agentes conservan su prefijo", () => {
    expect(childAgentName("general-purpose")).toBe("zcode-general-purpose");
    expect(childAgentName("Explore")).toBe("zcode-Explore");
  });
});
