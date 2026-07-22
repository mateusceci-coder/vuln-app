import styles from "./Badge.module.css";
import { STATUS, PRIORIDADE, PAPEL } from "../../lib/format";

export function Badge({ color = "var(--text-muted)", dot = true, soft = true, className = "", children }) {
  return (
    <span
      className={[styles.badge, soft && styles.soft, className].filter(Boolean).join(" ")}
      style={{ "--c": color }}
    >
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  const m = STATUS[status] || { label: status, color: "var(--text-muted)" };
  return <Badge color={m.color}>{m.label}</Badge>;
}

export function PrioridadeBadge({ prioridade }) {
  const m = PRIORIDADE[prioridade] || { label: prioridade, color: "var(--text-muted)" };
  return <Badge color={m.color}>{m.label}</Badge>;
}

const PAPEL_COR = {
  cliente: "var(--st-fechado)",
  agente: "var(--aurora-teal)",
  admin: "var(--aurora-violet)",
};

export function PapelBadge({ papel }) {
  const m = PAPEL[papel] || { label: papel };
  return <Badge color={PAPEL_COR[papel] || "var(--text-muted)"}>{m.label}</Badge>;
}
