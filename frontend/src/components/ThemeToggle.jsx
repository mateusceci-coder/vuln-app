import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme";
import styles from "./Topbar.module.css";

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      className={styles.iconBtn}
      onClick={toggle}
      aria-label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
