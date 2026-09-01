import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DemoStepTwo } from "./demo-step-two";
import { DEMO_SCENARIO, GOLDEN_PATH } from "./demo-step-two.model";

describe("demo step two",()=>{
  const render=()=>renderToStaticMarkup(<DemoStepTwo/>);

  it("renders the affected user, reviewer, and external agent",()=>{
    const html=render();
    expect(html).toContain(DEMO_SCENARIO.affectedUser.name);
    expect(html).toContain(DEMO_SCENARIO.reviewer.name);
    expect(html).toContain(DEMO_SCENARIO.agent.name);
  });

  it("renders scenario facts from the presentation model",()=>{
    const html=render();
    for(const fact of [...DEMO_SCENARIO.affectedUser.facts,...DEMO_SCENARIO.conditions])expect(html).toContain(fact);
  });

  it("shows the exact golden-path tools",()=>{
    const html=render();
    for(const step of GOLDEN_PATH)expect(html).toContain(step.name);
  });

  it("describes hidden, approved, and post-execution authority",()=>{
    const html=render();
    expect(html).toContain("Before approval");expect(html).toContain("hidden");
    expect(html).toContain("After exact human approval");expect(html).toContain("available");
    expect(html).toContain("After execution");expect(html).toContain("verify_identity_state");
  });

  it("links back to step one and forward to the live placeholder",()=>{
    const html=render();
    expect(html).toContain('href="/demo"');
    expect(html).toContain('href="/demo/live"');
  });
});
