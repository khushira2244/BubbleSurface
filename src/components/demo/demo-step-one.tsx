import React from "react";
import Link from "next/link";
import { Icon } from "../landing/icons";
import { INITIAL_CAPABILITIES, REFERENCE_SYSTEMS, type DemoSystemPresentation } from "./demo-step-one.model";
import styles from "./demo.module.css";

export function DemoStepOne() {
  return <main className={styles.page}>
    <DemoHeader />
    <div className={styles.shell}>
      <section className={styles.architecture} aria-labelledby="setup-title">
        <div className={styles.intro}><span className={styles.eyebrow}>Demo setup</span>
          <h1 id="setup-title">Live systems <span>connected</span><br/>for this test</h1>
          <p>We connect real security systems to create a live environment. BubbleSurface derives the current capabilities and exposes them to the external agent through WebMCP.</p>
        </div>
        <div className={styles.providers}>{REFERENCE_SYSTEMS.map(system=><SystemConnectionCard system={system} key={system.id}/>)}</div>
        <BubbleSurfaceControlCard />
        <CapabilitySurfaceCard />
      </section>
      <section className={styles.enables} aria-labelledby="enables-title"><h2 id="enables-title">What this enables</h2><div className={styles.benefits}>
        <DemoBenefitCard icon="shield" title="Real evidence">Elastic provides real-time security events and activity for investigation.</DemoBenefitCard>
        <DemoBenefitCard icon="human" title="Real identity state">Auth0 provides current identity, privileges and sessions that can be acted upon.</DemoBenefitCard>
        <DemoBenefitCard icon="surface" title="Dynamic capabilities">BubbleSurface exposes the right tools at the right moment, nothing more.</DemoBenefitCard>
      </div></section>
      <section className={styles.nextBar} aria-label="Starting state and next step"><span className={styles.infoIcon}><Icon name="lock" size={26}/></span><div><strong>This is the starting state before any approval.</strong><p>Only investigation capabilities are available. Sensitive actions will appear after human approval.</p></div><Link href="/demo/test-case" className={styles.primaryButton}>Next: Define test case <span>→</span></Link></section>
    </div>
  </main>;
}

export function DemoHeader(){return <header className={styles.header}><div className={styles.headerInner}><Link href="/" className={styles.brand} aria-label="BubbleSurface demo home"><span className={styles.logoMark}>C</span><span>BubbleSurface<small>Demo</small></span></Link><Link href="/" className={styles.back}>← <span>Back to Home</span></Link></div></header>}

export function SystemConnectionCard({system}:{system:DemoSystemPresentation}){return <article className={`${styles.systemCard} ${styles[system.accent]}`} aria-label={`${system.name} reference integration`}><div className={styles.systemTop}><span className={`${styles.providerLogo} ${styles[system.id]}`} aria-hidden="true">{system.id==="elastic"?"✣":"★"}</span><div><h2>{system.name}</h2><span className={styles.status}>{system.status}</span></div></div><p>{system.purpose}</p><ul>{system.contributions.map(item=><li key={item}><span>✓</span>{item}</li>)}</ul></article>}

export function BubbleSurfaceControlCard(){return <article className={styles.controlCard}><div className={styles.controlTop}><span className={styles.controlLogo}>C</span><div><h2>BubbleSurface</h2><span className={styles.status}>Active</span></div></div><p>Derives current capabilities based on live state, policies and human approval.</p><div className={styles.enforced}><Icon name="shield" size={16}/> Server enforced</div><i className={`${styles.connector} ${styles.fromTop}`} aria-hidden="true"/><i className={`${styles.connector} ${styles.fromBottom}`} aria-hidden="true"/><i className={`${styles.connector} ${styles.toSurface}`} aria-hidden="true"/></article>}

export function CapabilitySurfaceCard(){return <article className={styles.capabilityCard}><h2>WebMCP Capability Surface</h2><p>Tools discovered for the agent</p><ul>{INITIAL_CAPABILITIES.map(tool=><li key={tool.name}><span className={styles.toolIcon}><Icon name={tool.icon==="sessions"?"human":tool.icon==="timeline"?"verify":tool.icon==="privilege"?"surface":"proposal"} size={20}/></span><div><code>{tool.name}</code><small>{tool.description}</small></div></li>)}</ul></article>}

export function DemoBenefitCard({icon,title,children}:{icon:"shield"|"human"|"surface";title:string;children:string}){return <article className={styles.benefit}><span><Icon name={icon} size={29}/></span><div><h3>{title}</h3><p>{children}</p></div></article>}
