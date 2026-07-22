import styles from "./Aurora.module.css";

/**
 * Aurora backdrop — the brand signature.
 * variant="full"    → login (bold, drifting bands + starfield)
 * variant="ambient" → app shell (faint, behind the sidebar header / top edge)
 */
export default function Aurora({ variant = "ambient" }) {
  return (
    <div
      className={`${styles.aurora} ${variant === "full" ? styles.full : styles.ambient}`}
      aria-hidden="true"
    >
      <span className={`${styles.band} ${styles.teal}`} />
      <span className={`${styles.band} ${styles.violet}`} />
      <span className={`${styles.band} ${styles.green}`} />
      {variant === "full" && <span className={styles.stars} />}
    </div>
  );
}
