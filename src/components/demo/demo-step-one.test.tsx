import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemoCTA } from "../landing/demo-cta";
import { DemoStepOne } from "./demo-step-one";
import { INITIAL_CAPABILITIES } from "./demo-step-one.model";

describe("demo step one", () => {
  it("links the landing demo CTA to the setup route", () => {
    expect(renderToStaticMarkup(<DemoCTA />)).toContain('href="/demo"');
  });

  it("renders both reference provider cards", () => {
    const html = renderToStaticMarkup(<DemoStepOne />);
    expect(html).toContain("Elastic / SIEM");
    expect(html).toContain("Auth0");
  });

  it("shows the five initial investigation capabilities and no execution capability", () => {
    const html = renderToStaticMarkup(<DemoStepOne />);
    expect(INITIAL_CAPABILITIES).toHaveLength(5);
    for (const capability of INITIAL_CAPABILITIES) expect(html).toContain(capability.name);
    expect(html).not.toContain("revoke_approved_sessions");
    expect(html).not.toContain("remove_approved_privilege");
  });

  it("links to the test-case placeholder", () => {
    expect(renderToStaticMarkup(<DemoStepOne />)).toContain('href="/demo/test-case"');
  });
});
