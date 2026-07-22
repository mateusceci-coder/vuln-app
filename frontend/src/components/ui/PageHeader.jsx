import styles from "./PageHeader.module.css";

export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
