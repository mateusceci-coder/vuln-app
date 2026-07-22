import { useId } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./Field.module.css";

export default function Select({
  label,
  hint,
  error,
  id,
  options = [],
  placeholder,
  className = "",
  children,
  ...rest
}) {
  const auto = useId();
  const fid = id || auto;
  return (
    <div className={styles.field}>
      {label && (
        <label htmlFor={fid} className={styles.label}>
          {label}
        </label>
      )}
      <div className={[styles.control, styles.selectWrap, error && styles.invalid].filter(Boolean).join(" ")}>
        <select id={fid} className={`${styles.input} ${styles.select} ${className}`} {...rest}>
          {placeholder && <option value="">{placeholder}</option>}
          {children ||
            options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </select>
        <ChevronDown className={styles.chevron} size={16} aria-hidden="true" />
      </div>
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}
