import { useId } from "react";
import styles from "./Field.module.css";

export default function Textarea({ label, hint, error, id, className = "", rows = 4, ...rest }) {
  const auto = useId();
  const fid = id || auto;
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={fid} className={styles.label}>
          {label}
        </label>
      )}
      <div className={[styles.control, error && styles.invalid].filter(Boolean).join(" ")}>
        <textarea id={fid} rows={rows} className={`${styles.input} ${styles.textarea} ${className}`} {...rest} />
      </div>
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}
