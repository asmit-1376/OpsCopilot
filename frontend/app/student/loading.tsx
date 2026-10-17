import styles from "./dashboard.module.css";

export default function StudentLoading() {
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <span className={styles.srOnly}>Loading your student portal…</span>
      <div className={styles.loadingHeader} aria-hidden="true" />
      <div className={styles.loadingNav} aria-hidden="true" />
      <main className={styles.loadingContent} aria-hidden="true">
        <div className={styles.loadingHero} />
        <div className={styles.loadingMetrics}>
          <div className={styles.loadingMetric} />
          <div className={styles.loadingMetric} />
          <div className={styles.loadingMetric} />
          <div className={styles.loadingMetric} />
        </div>
        <div className={styles.loadingPanels}>
          <div className={styles.loadingPanel} />
          <div className={styles.loadingPanel} />
        </div>
      </main>
    </div>
  );
}
