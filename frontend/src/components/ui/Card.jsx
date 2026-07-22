import styles from "./Card.module.css";

export default function Card({
  as: Comp = "div",
  padded = true,
  hover = false,
  className = "",
  children,
  ...rest
}) {
  const cls = [styles.card, padded && styles.padded, hover && styles.hover, className]
    .filter(Boolean)
    .join(" ");
  return (
    <Comp className={cls} {...rest}>
      {children}
    </Comp>
  );
}
