import Link from "next/link";
import { HeroSurfaceIllustration } from "./hero-surface-illustration";
import { Icon } from "./icons";
import styles from "./landing.module.css";
export function Hero() { return <section className={styles.hero} aria-labelledby="hero-title"><div className={styles.heroCopy}><span className={styles.eyebrow}><Icon name="shield" size={16}/> WebMCP for cybersecurity workflows</span><h1 id="hero-title">Bubble<span>Surface</span></h1><h2>A dynamic WebMCP surface for cybersecurity applications</h2><p>BubbleSurface lets a cybersecurity product expose the right agent capabilities at the right moment—while keeping sensitive actions under human and server-side control.</p><div className={styles.actions}><Link className={styles.primaryButton} href="/demo">Explore demo <span>→</span></Link><a className={styles.secondaryButton} href="#how-it-works">See integration flow <span>↓</span></a></div></div><HeroSurfaceIllustration /></section>; }
