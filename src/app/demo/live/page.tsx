import Link from "next/link";
import styles from "@/components/demo/demo.module.css";

export default function LiveDemoPlaceholderPage() {
  return <main className={`${styles.page} ${styles.placeholderPage}`}><section className={styles.placeholderCard}>
    <span className={styles.eyebrow}>Live test workspace</span><h1>The governed test is next.</h1>
    <p>This route is reserved for the live incident workspace. No agent simulation, approval flow, or execution behavior has been added here yet.</p>
    <Link className={styles.secondaryButton} href="/demo/test-case">← Back to test case</Link>
  </section></main>;
}
