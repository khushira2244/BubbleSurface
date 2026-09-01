import { DemoCTA, Hero, HumanAgentSection, Navbar, ProductBenefits, WorkflowSteps } from "@/components/landing";
import styles from "@/components/landing/landing.module.css";

export default function LandingPage() {
  return <main className={styles.page}>
    <Navbar />
    <div className={styles.shell}>
      <Hero />
      <ProductBenefits />
      <HumanAgentSection />
      <WorkflowSteps />
      <DemoCTA />
    </div>
  </main>;
}
