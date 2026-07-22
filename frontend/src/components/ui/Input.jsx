import { useId } from "react";
import styles from "./Field.module.css";

export default function Input({ label, hint, error, icon, id, className = "", ...rest }) {
  const auto = useId();
  const fid = id || auto;
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={fid} className={styles.label}>
          {label}
        </label>
      )}
      <div
        className={[styles.control, icon && styles.hasIcon, error && styles.invalid]
          .filter(Boolean)
          .join(" ")}
      >
        {icon && <span className={styles.icon}>{icon}</span>}
        <input id={fid} className={`${styles.input} ${className}`} {...rest} />
      </div>
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}
