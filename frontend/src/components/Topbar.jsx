import { Link } from "react-router-dom";
import { Menu, Plus } from "lucide-react";
import Button from "./ui/Button";
import ThemeToggle from "./ThemeToggle";
import styles from "./Topbar.module.css";

export default function Topbar({ onMenu }) {
  return (
    <header className={styles.topbar}>
      <button className={styles.menu} onClick={onMenu} aria-label="Abrir menu">
        <Menu size={20} />
      </button>
      <div className={styles.spacer} />
      <ThemeToggle />
      <Button as={Link} to="/chamados/novo" variant="primary" size="sm">
        <Plus size={16} />
        Novo chamado
      </Button>
    </header>
  );
}
