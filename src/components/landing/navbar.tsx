import Link from "next/link";
import styles from "./landing.module.css";
export function Navbar() { return <header className={styles.navbar}><div className={styles.navInner}><Link className={styles.brand} href="/" aria-label="BubbleSurface home"><span className={styles.brandMark} aria-hidden="true">●<i>●</i><b>●</b></span><span>BubbleSurface</span></Link><nav aria-label="Main navigation"><a href="#product">Product</a><a href="#how-it-works">How it works</a><a href="#demo">Demo</a><a href="#docs">Docs</a></nav></div></header>; }
