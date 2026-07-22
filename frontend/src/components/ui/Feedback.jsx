import styles from "./Feedback.module.css";

export function Spinner({ size = 22, className = "" }) {
  return (
    <span
      className={`${styles.spinner} ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Carregando"
    />
  );
}

export function Loading({ label = "Carregando…" }) {
  return (
    <div className={styles.loading}>
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }) {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      <h3 className={styles.emptyTitle}>{title}</h3>
      {children && <p className={styles.emptyText}>{children}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}
