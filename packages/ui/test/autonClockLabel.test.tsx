// packages/ui/test/autonClockLabel.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ClockLabel } from "../src/auton/ClockLabel.js";

describe("ClockLabel", () => {
  it("muestra 01:02 con 62s", () => {
    expect(renderToStaticMarkup(<ClockLabel elapsedMs={62_000} />)).toContain("01:02");
  });
  it("muestra --:-- sin tiempo", () => {
    expect(renderToStaticMarkup(<ClockLabel elapsedMs={null} />)).toContain("--:--");
  });
  it("avisa silencio de 90s", () => {
    const html = renderToStaticMarkup(<ClockLabel elapsedMs={120_000} lastSignalAt={1000} now={91_000} />);
    expect(html).toContain("sin se\u00f1ales hace 90s");
  });
  it("no avisa silencio reciente", () => {
    const html = renderToStaticMarkup(<ClockLabel elapsedMs={10_000} lastSignalAt={9000} now={10_000} />);
    expect(html).not.toContain("sin se\u00f1ales");
  });
});
