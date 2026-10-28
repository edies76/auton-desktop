import { describe, expect, it } from "vitest";
import { createChildSessionId } from "../src/subagent/runner.js";

describe("auton worker session namespace", () => {
  it("los programmers auton usan prefijo propio, no subagent_", () => {
    const id = createChildSessionId("auton-worker", "abc123");
    expect(id.startsWith("sess_auton_")).toBe(true);
    expect(id).toContain("abc123");
  });

  it("los demas agentes conservan el prefijo original", () => {
    expect(createChildSessionId("general-purpose", "abc123").startsWith("sess_subagent_")).toBe(true);
    expect(createChildSessionId("Explore", "abc123").startsWith("sess_subagent_")).toBe(true);
  });
});
