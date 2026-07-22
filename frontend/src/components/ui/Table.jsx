import styles from "./Table.module.css";

export default function Table({ children, minWidth = 640 }) {
  return (
    <div className={styles.scroll}>
      <table className={styles.table} style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}
