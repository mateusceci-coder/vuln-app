import styles from "./Button.module.css";

export default function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  as: Comp = "button",
  className = "",
  children,
  disabled,
  ...rest
}) {
  const cls = [styles.btn, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(" ");
  const isButton = Comp === "button";
  return (
    <Comp
      className={cls}
      disabled={isButton ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.spin} aria-hidden="true" />}
      {children}
    </Comp>
  );
}
