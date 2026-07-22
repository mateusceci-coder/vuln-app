import styles from "./Avatar.module.css";
import { initials } from "../../lib/format";

export default function Avatar({ nome = "", size = 36 }) {
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      title={nome}
    >
      {initials(nome)}
    </span>
  );
}
